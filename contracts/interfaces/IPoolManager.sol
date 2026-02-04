// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Currency} from "./CurrencyLibrary.sol";

interface IHooks {
    // Minimal hook interface - used as type reference
}

interface IPoolManager {
    struct PoolKey {
        Currency currency0;
        Currency currency1;
        uint24 fee;
        int24 tickSpacing;
        IHooks hooks;
    }

    function initialize(
        PoolKey memory key,
        uint160 sqrtPriceX96
    ) external returns (int24 tick);
}
