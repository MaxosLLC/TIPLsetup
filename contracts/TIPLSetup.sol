// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TIPLToken.sol";
import "./interfaces/ISafeProxyFactory.sol";
import "./interfaces/ISafe.sol";
import "./interfaces/IPoolManager.sol";
import "./interfaces/IPositionManager.sol";
import "./interfaces/IAllowanceTransfer.sol";
import "./interfaces/CurrencyLibrary.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TIPLSetup {
    // ── External contract addresses (Base Mainnet) ──────────────────────
    address constant SAFE_PROXY_FACTORY = 0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2;
    address constant SAFE_SINGLETON    = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    address constant FALLBACK_HANDLER  = 0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4;
    address constant POOL_MANAGER      = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address constant POSITION_MANAGER  = 0x7C5f5A4bBd8fD63184577525326123B519429bDc;
    address constant PERMIT2           = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant USDC              = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant TIPL_TREASURY     = 0xF698340aa648DCF6bAbDeb93B0878A08755Bcd69;

    // ── Uniswap V4 pool parameters ─────────────────────────────────────
    uint24  constant POOL_FEE       = 10000;   // 1.00%
    int24   constant TICK_SPACING   = 200;

    // Pre-computed tick values for $0.01–$1,000 range (rounded to tickSpacing=200)
    // TIPL has 18 decimals, USDC has 6 decimals.
    //
    // If TIPL < USDC (TIPL is currency0):
    //   P = USDC_raw / TIPL_raw
    //   $0.01 → tick ≈ -322,400; $1000 → tick ≈ -207,400
    int24 constant TICK_LOWER_TIPL_IS_C0 = -322400;
    int24 constant TICK_UPPER_TIPL_IS_C0 = -207400;

    // If USDC < TIPL (USDC is currency0):
    //   P = TIPL_raw / USDC_raw
    //   $1000 → tick ≈ 207,400; $0.01 → tick ≈ 322,400
    int24 constant TICK_LOWER_USDC_IS_C0 = 207400;
    int24 constant TICK_UPPER_USDC_IS_C0 = 322400;

    // sqrtPriceX96 at tick bounds — used for computing liquidity from LP_AMOUNT
    uint160 constant SQRT_PRICE_LOWER_TIPL_C0 = 7_914_118_485_757_900_357_632;       // tick -322400
    uint160 constant SQRT_PRICE_UPPER_TIPL_C0 = 2_485_827_413_564_259_143_490_240;     // tick -207400
    uint160 constant SQRT_PRICE_LOWER_USDC_C0 = 2_525_155_890_201_713_880_629_425_236_587_124;   // tick 207400
    uint160 constant SQRT_PRICE_UPPER_USDC_C0 = 793_152_347_588_122_760_560_699_178_810_867_712; // tick 322400

    // sqrtPriceX96 for pool initialization — MUST be outside LP range
    // to ensure single-sided (TIPL-only) position.
    //
    // If TIPL is currency0: current tick must be < tickLower (-322400)
    //   Position is 100% token0 (TIPL) since current tick < tickLower
    uint160 constant SQRT_PRICE_TIPL_IS_C0 = 7_844_248_069;

    // If USDC is currency0: current tick must be >= tickUpper (322400)
    //   Position is 100% token1 (TIPL) since current tick >= tickUpper
    uint160 constant SQRT_PRICE_USDC_IS_C0 = 800_204_841_393_899_936_140_808_698_470_000_000;

    // ── Constants ─────────────────────────────────────────────────────────
    uint256 constant Q96 = 2**96;

    // ── Uniswap V4 PositionManager action constants (from Actions.sol) ──
    uint8 constant ACTION_MINT_POSITION = 2;    // Actions.MINT_POSITION
    uint8 constant ACTION_SETTLE_PAIR   = 13;   // Actions.SETTLE_PAIR

    // ── Distribution amounts ────────────────────────────────────────────
    uint256 constant TREASURY_SHARE = 50_000 * 1e18;   // 5%
    uint256 constant LP_AMOUNT      = 200_000 * 1e18;  // 200K tokens for LP

    // ── Events ──────────────────────────────────────────────────────────
    event TIPLSetupComplete(
        address indexed token,
        address indexed multisig,
        string name,
        string symbol,
        bytes32 poolId
    );

    /**
     * @notice Single-call orchestrator: Safe multisig → token mint → fee distribution
     *         → optional Uniswap V4 pool → treasury transfer.
     */
    function setupTIPL(
        string memory symbol,
        string memory name,
        address firstSigner,
        address secondSigner,
        bool createSwap
    ) external returns (address token, address multisig, bytes32 poolId) {
        // 1. Create Safe multisig
        multisig = _createMultisig(firstSigner, secondSigner);

        // 2. Create token (mints 1M to this contract)
        TIPLToken tiplToken = new TIPLToken(address(this), symbol, name);
        token = address(tiplToken);

        // 3. Send 5% to TIPL treasury
        tiplToken.transfer(TIPL_TREASURY, TREASURY_SHARE);

        // 4. (Optional) Create Uniswap V4 pool
        if (createSwap) {
            poolId = _createPool(token, multisig);
        }

        // 5. Send remaining tokens to multisig
        uint256 remaining = tiplToken.balanceOf(address(this));
        if (remaining > 0) {
            tiplToken.transfer(multisig, remaining);
        }

        // 6. Emit event
        emit TIPLSetupComplete(token, multisig, name, symbol, poolId);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Internal helpers
    // ═══════════════════════════════════════════════════════════════════

    function _createMultisig(address firstSigner, address secondSigner) internal returns (address) {
        address owner1 = firstSigner == address(0) ? msg.sender : firstSigner;
        address[] memory owners;
        uint256 threshold;

        if (secondSigner == address(0)) {
            owners = new address[](1);
            owners[0] = owner1;
            threshold = 1;
        } else {
            owners = new address[](2);
            owners[0] = owner1;
            owners[1] = secondSigner;
            threshold = 2;
        }

        bytes memory initializer = abi.encodeWithSelector(
            ISafe.setup.selector,
            owners,
            threshold,
            address(0),
            "",
            FALLBACK_HANDLER,
            address(0),
            0,
            address(0)
        );

        uint256 nonce = uint256(
            keccak256(abi.encodePacked(msg.sender, block.timestamp))
        );

        return ISafeProxyFactory(SAFE_PROXY_FACTORY).createProxyWithNonce(
            SAFE_SINGLETON,
            initializer,
            nonce
        );
    }

    function _buildPoolKey(address tokenAddr) internal pure returns (IPoolManager.PoolKey memory) {
        bool tiplIsC0 = uint160(tokenAddr) < uint160(USDC);
        return IPoolManager.PoolKey({
            currency0: tiplIsC0 ? Currency.wrap(tokenAddr) : Currency.wrap(USDC),
            currency1: tiplIsC0 ? Currency.wrap(USDC) : Currency.wrap(tokenAddr),
            fee: POOL_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });
    }

    function _getTicksAndPrice(address tokenAddr)
        internal
        pure
        returns (int24 tickLower, int24 tickUpper, uint160 sqrtPriceX96)
    {
        if (uint160(tokenAddr) < uint160(USDC)) {
            return (TICK_LOWER_TIPL_IS_C0, TICK_UPPER_TIPL_IS_C0, SQRT_PRICE_TIPL_IS_C0);
        } else {
            return (TICK_LOWER_USDC_IS_C0, TICK_UPPER_USDC_IS_C0, SQRT_PRICE_USDC_IS_C0);
        }
    }

    function _createPool(
        address tokenAddr,
        address multisig
    ) internal returns (bytes32) {
        IPoolManager.PoolKey memory poolKey = _buildPoolKey(tokenAddr);
        (int24 tickLower, int24 tickUpper, uint160 sqrtPriceX96) = _getTicksAndPrice(tokenAddr);

        // Initialize pool
        IPoolManager(POOL_MANAGER).initialize(poolKey, sqrtPriceX96);

        // Approve TIPL tokens for Permit2 flow
        TIPLToken(tokenAddr).approve(PERMIT2, type(uint256).max);
        IAllowanceTransfer(PERMIT2).approve(
            tokenAddr,
            POSITION_MANAGER,
            type(uint160).max,
            type(uint48).max
        );

        // Approve USDC for Permit2 (SETTLE_PAIR checks allowance even with 0 delta)
        IERC20(USDC).approve(PERMIT2, type(uint256).max);
        IAllowanceTransfer(PERMIT2).approve(
            USDC,
            POSITION_MANAGER,
            type(uint160).max,
            type(uint48).max
        );

        // Compute liquidity from desired LP_AMOUNT
        uint128 liquidity = _computeLiquidity(tokenAddr);

        // Mint LP position
        _mintPosition(poolKey, tickLower, tickUpper, liquidity, multisig, tokenAddr);

        return keccak256(abi.encode(poolKey));
    }

    function _computeLiquidity(address tokenAddr) internal pure returns (uint128) {
        bool tiplIsC0 = uint160(tokenAddr) < uint160(USDC);
        uint256 rawLiquidity;

        if (tiplIsC0) {
            // TIPL is currency0: L = amount0 * sqrtA * sqrtB / (Q96 * (sqrtB - sqrtA))
            uint256 sqrtA = uint256(SQRT_PRICE_LOWER_TIPL_C0);
            uint256 sqrtB = uint256(SQRT_PRICE_UPPER_TIPL_C0);
            uint256 intermediate = (sqrtA * sqrtB) / Q96;
            rawLiquidity = (LP_AMOUNT * intermediate) / (sqrtB - sqrtA);
        } else {
            // TIPL is currency1: L = amount1 * Q96 / (sqrtB - sqrtA)
            uint256 sqrtA = uint256(SQRT_PRICE_LOWER_USDC_C0);
            uint256 sqrtB = uint256(SQRT_PRICE_UPPER_USDC_C0);
            rawLiquidity = (LP_AMOUNT * Q96) / (sqrtB - sqrtA);
        }

        // Apply 0.1% haircut to account for rounding differences
        return uint128(rawLiquidity * 999 / 1000);
    }

    function _mintPosition(
        IPoolManager.PoolKey memory poolKey,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        address recipient,
        address tokenAddr
    ) internal {
        bool tiplIsC0 = Currency.unwrap(poolKey.currency0) == tokenAddr;

        // amountMax: LP_AMOUNT on TIPL side, 0 on USDC side
        uint128 amount0Max = tiplIsC0 ? uint128(LP_AMOUNT) : 0;
        uint128 amount1Max = tiplIsC0 ? 0 : uint128(LP_AMOUNT);

        // MINT_POSITION(2) + SETTLE_PAIR(13)
        bytes memory actions = abi.encodePacked(
            ACTION_MINT_POSITION,
            ACTION_SETTLE_PAIR
        );

        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(
            poolKey,
            tickLower,
            tickUpper,
            uint256(liquidity),
            amount0Max,
            amount1Max,
            recipient,
            bytes("")
        );
        // SETTLE_PAIR: (currency0, currency1)
        params[1] = abi.encode(
            Currency.unwrap(poolKey.currency0),
            Currency.unwrap(poolKey.currency1)
        );

        IPositionManager(POSITION_MANAGER).modifyLiquidities(
            abi.encode(actions, params),
            block.timestamp + 300
        );
    }
}
