import { expect } from "chai";
import { ethers } from "hardhat";
import { TIPLSetup } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// External contract addresses (Base Mainnet)
const TIPL_TREASURY = "0xF698340aa648DCF6bAbDeb93B0878A08755Bcd69";
const POOL_MANAGER = "0x498581fF718922c3f8e6A244956aF099B2652b2b";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Safe ABI fragments for querying the deployed proxy
const SAFE_ABI = [
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
];

// ERC20 ABI fragment
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

// ERC721 ABI fragment (for LP NFT ownership check)
const ERC721_ABI = [
  "function balanceOf(address) view returns (uint256)",
];

const POSITION_MANAGER = "0x7C5f5A4bBd8fD63184577525326123B519429bDc";

describe("TIPLSetup", function () {
  let setup: TIPLSetup;
  let deployer: SignerWithAddress;
  let secondSigner: SignerWithAddress;
  let other: SignerWithAddress;

  beforeEach(async function () {
    [deployer, secondSigner, other] = await ethers.getSigners();
    const SetupFactory = await ethers.getContractFactory("TIPLSetup");
    setup = await SetupFactory.deploy();
  });

  describe("Safe multisig creation", function () {
    it("should create a 1-of-1 multisig when secondSigner is zero address", async function () {
      const tx = await setup.setupTIPL("TEST", "Test Token", ethers.ZeroAddress, ethers.ZeroAddress, false);
      const receipt = await tx.wait();

      // Extract multisig address from event
      const event = receipt!.logs.find((log) => {
        try {
          return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
        } catch { return false; }
      });
      const parsed = setup.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
      const multisigAddr = parsed!.args.multisig;

      const safe = new ethers.Contract(multisigAddr, SAFE_ABI, ethers.provider);
      const owners = await safe.getOwners();
      const threshold = await safe.getThreshold();

      expect(owners).to.have.lengthOf(1);
      expect(owners[0]).to.equal(deployer.address);
      expect(threshold).to.equal(1n);
    });

    it("should create a 2-of-2 multisig when secondSigner is provided", async function () {
      const tx = await setup.setupTIPL("TEST", "Test Token", ethers.ZeroAddress, secondSigner.address, false);
      const receipt = await tx.wait();

      const event = receipt!.logs.find((log) => {
        try {
          return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
        } catch { return false; }
      });
      const parsed = setup.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
      const multisigAddr = parsed!.args.multisig;

      const safe = new ethers.Contract(multisigAddr, SAFE_ABI, ethers.provider);
      const owners = await safe.getOwners();
      const threshold = await safe.getThreshold();

      expect(owners).to.have.lengthOf(2);
      expect(owners).to.include(deployer.address);
      expect(owners).to.include(secondSigner.address);
      expect(threshold).to.equal(2n);
    });
  });

  describe("firstSigner parameter", function () {
    it("should use firstSigner as sole owner in 1-of-1 multisig", async function () {
      const tx = await setup.setupTIPL("TEST", "Test Token", other.address, ethers.ZeroAddress, false);
      const receipt = await tx.wait();

      const event = receipt!.logs.find((log) => {
        try {
          return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
        } catch { return false; }
      });
      const parsed = setup.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
      const multisigAddr = parsed!.args.multisig;

      const safe = new ethers.Contract(multisigAddr, SAFE_ABI, ethers.provider);
      const owners = await safe.getOwners();
      const threshold = await safe.getThreshold();

      expect(owners).to.have.lengthOf(1);
      expect(owners[0]).to.equal(other.address);
      expect(threshold).to.equal(1n);
    });

    it("should use firstSigner and secondSigner as owners in 2-of-2 multisig", async function () {
      const tx = await setup.setupTIPL("TEST", "Test Token", other.address, secondSigner.address, false);
      const receipt = await tx.wait();

      const event = receipt!.logs.find((log) => {
        try {
          return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
        } catch { return false; }
      });
      const parsed = setup.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
      const multisigAddr = parsed!.args.multisig;

      const safe = new ethers.Contract(multisigAddr, SAFE_ABI, ethers.provider);
      const owners = await safe.getOwners();
      const threshold = await safe.getThreshold();

      expect(owners).to.have.lengthOf(2);
      expect(owners).to.include(other.address);
      expect(owners).to.include(secondSigner.address);
      expect(threshold).to.equal(2n);
    });

    it("should default to msg.sender when firstSigner is address(0)", async function () {
      const tx = await setup.setupTIPL("TEST", "Test Token", ethers.ZeroAddress, ethers.ZeroAddress, false);
      const receipt = await tx.wait();

      const event = receipt!.logs.find((log) => {
        try {
          return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
        } catch { return false; }
      });
      const parsed = setup.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
      const multisigAddr = parsed!.args.multisig;

      const safe = new ethers.Contract(multisigAddr, SAFE_ABI, ethers.provider);
      const owners = await safe.getOwners();
      const threshold = await safe.getThreshold();

      expect(owners).to.have.lengthOf(1);
      expect(owners[0]).to.equal(deployer.address);
      expect(threshold).to.equal(1n);
    });
  });

  describe("Token creation & distribution", function () {
    it("should create token with correct name, symbol, and 18 decimals", async function () {
      const tx = await setup.setupTIPL("ACME", "Acme Corp TIPL", ethers.ZeroAddress, ethers.ZeroAddress, false);
      const receipt = await tx.wait();

      const event = receipt!.logs.find((log) => {
        try {
          return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
        } catch { return false; }
      });
      const parsed = setup.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
      const tokenAddr = parsed!.args.token;

      const token = new ethers.Contract(tokenAddr, ERC20_ABI, ethers.provider);
      expect(await token.name()).to.equal("Acme Corp TIPL");
      expect(await token.symbol()).to.equal("ACME");
      expect(await token.decimals()).to.equal(18n);
    });

    it("should mint exactly 1,000,000 tokens total supply", async function () {
      const tx = await setup.setupTIPL("TEST", "Test Token", ethers.ZeroAddress, ethers.ZeroAddress, false);
      const receipt = await tx.wait();

      const event = receipt!.logs.find((log) => {
        try {
          return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
        } catch { return false; }
      });
      const parsed = setup.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
      const tokenAddr = parsed!.args.token;

      const token = new ethers.Contract(tokenAddr, ERC20_ABI, ethers.provider);
      expect(await token.totalSupply()).to.equal(ethers.parseEther("1000000"));
    });

    it("should send 50,000 tokens (5%) to TIPL treasury", async function () {
      const tx = await setup.setupTIPL("TEST", "Test Token", ethers.ZeroAddress, ethers.ZeroAddress, false);
      const receipt = await tx.wait();

      const event = receipt!.logs.find((log) => {
        try {
          return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
        } catch { return false; }
      });
      const parsed = setup.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
      const tokenAddr = parsed!.args.token;

      const token = new ethers.Contract(tokenAddr, ERC20_ABI, ethers.provider);
      expect(await token.balanceOf(TIPL_TREASURY)).to.equal(ethers.parseEther("50000"));
    });

    it("should leave 0 tokens in the TIPLSetup contract", async function () {
      const tx = await setup.setupTIPL("TEST", "Test Token", ethers.ZeroAddress, ethers.ZeroAddress, false);
      const receipt = await tx.wait();

      const event = receipt!.logs.find((log) => {
        try {
          return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
        } catch { return false; }
      });
      const parsed = setup.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
      const tokenAddr = parsed!.args.token;

      const token = new ethers.Contract(tokenAddr, ERC20_ABI, ethers.provider);
      const setupAddr = await setup.getAddress();
      expect(await token.balanceOf(setupAddr)).to.equal(0n);
    });
  });

  describe("Without swap (createSwap = false)", function () {
    it("should return poolId = bytes32(0) when no swap", async function () {
      const tx = await setup.setupTIPL("TEST", "Test Token", ethers.ZeroAddress, ethers.ZeroAddress, false);
      const receipt = await tx.wait();

      const event = receipt!.logs.find((log) => {
        try {
          return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
        } catch { return false; }
      });
      const parsed = setup.interface.parseLog({ topics: event!.topics as string[], data: event!.data });

      expect(parsed!.args.poolId).to.equal(ethers.ZeroHash);
    });

    it("should send 950,000 tokens to multisig (1M - 50K)", async function () {
      const tx = await setup.setupTIPL("TEST", "Test Token", ethers.ZeroAddress, ethers.ZeroAddress, false);
      const receipt = await tx.wait();

      const event = receipt!.logs.find((log) => {
        try {
          return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
        } catch { return false; }
      });
      const parsed = setup.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
      const tokenAddr = parsed!.args.token;
      const multisigAddr = parsed!.args.multisig;

      const token = new ethers.Contract(tokenAddr, ERC20_ABI, ethers.provider);
      expect(await token.balanceOf(multisigAddr)).to.equal(ethers.parseEther("950000"));
    });
  });

  describe("With swap (createSwap = true)", function () {
    it("should initialize a pool and return a non-zero poolId", async function () {
      const tx = await setup.setupTIPL("TEST", "Test Token", ethers.ZeroAddress, ethers.ZeroAddress, true);
      const receipt = await tx.wait();

      const event = receipt!.logs.find((log) => {
        try {
          return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
        } catch { return false; }
      });
      const parsed = setup.interface.parseLog({ topics: event!.topics as string[], data: event!.data });

      expect(parsed!.args.poolId).to.not.equal(ethers.ZeroHash);
    });

    it("should mint LP NFT owned by multisig", async function () {
      const tx = await setup.setupTIPL("TEST", "Test Token", ethers.ZeroAddress, ethers.ZeroAddress, true);
      const receipt = await tx.wait();

      const event = receipt!.logs.find((log) => {
        try {
          return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
        } catch { return false; }
      });
      const parsed = setup.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
      const multisigAddr = parsed!.args.multisig;

      const positionManager = new ethers.Contract(POSITION_MANAGER, ERC721_ABI, ethers.provider);
      const nftBalance = await positionManager.balanceOf(multisigAddr);
      expect(nftBalance).to.be.gte(1n);
    });

    it("should send ~750,000 tokens to multisig (1M - 50K - ~200K LP)", async function () {
      const tx = await setup.setupTIPL("TEST", "Test Token", ethers.ZeroAddress, ethers.ZeroAddress, true);
      const receipt = await tx.wait();

      const event = receipt!.logs.find((log) => {
        try {
          return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
        } catch { return false; }
      });
      const parsed = setup.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
      const tokenAddr = parsed!.args.token;
      const multisigAddr = parsed!.args.multisig;

      const token = new ethers.Contract(tokenAddr, ERC20_ABI, ethers.provider);
      const setupAddr = await setup.getAddress();

      // Setup contract should hold 0
      expect(await token.balanceOf(setupAddr)).to.equal(0n);
      // Treasury gets 50K
      expect(await token.balanceOf(TIPL_TREASURY)).to.equal(ethers.parseEther("50000"));
      // Multisig gets the remainder after LP (~200K consumed with 0.1% haircut)
      const multisigBalance = await token.balanceOf(multisigAddr);
      // LP consumes ~199,800 tokens (200K with 0.1% haircut), so multisig gets ~750,200
      expect(multisigBalance).to.be.lte(ethers.parseEther("751000"));
      expect(multisigBalance).to.be.gte(ethers.parseEther("749000"));
    });
  });

  describe("Event emission", function () {
    it("should emit TIPLSetupComplete with correct args", async function () {
      const tx = await setup.setupTIPL("ACME", "Acme Corp TIPL", ethers.ZeroAddress, ethers.ZeroAddress, false);
      const receipt = await tx.wait();

      const event = receipt!.logs.find((log) => {
        try {
          return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
        } catch { return false; }
      });
      expect(event).to.not.be.undefined;

      const parsed = setup.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
      expect(parsed!.args.name).to.equal("Acme Corp TIPL");
      expect(parsed!.args.symbol).to.equal("ACME");
      expect(parsed!.args.token).to.be.properAddress;
      expect(parsed!.args.multisig).to.be.properAddress;
      expect(parsed!.args.poolId).to.equal(ethers.ZeroHash);
    });

    it("should emit non-zero poolId when createSwap is true", async function () {
      const tx = await setup.setupTIPL("ACME", "Acme Corp TIPL", ethers.ZeroAddress, ethers.ZeroAddress, true);
      const receipt = await tx.wait();

      const event = receipt!.logs.find((log) => {
        try {
          return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
        } catch { return false; }
      });
      const parsed = setup.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
      expect(parsed!.args.poolId).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Edge cases", function () {
    it("should allow multiple independent setups", async function () {
      const tx1 = await setup.setupTIPL("AAA", "Token A", ethers.ZeroAddress, ethers.ZeroAddress, false);
      const receipt1 = await tx1.wait();

      // Use a different block.timestamp by mining a block
      await ethers.provider.send("evm_mine", []);

      const tx2 = await setup.setupTIPL("BBB", "Token B", ethers.ZeroAddress, secondSigner.address, false);
      const receipt2 = await tx2.wait();

      const getEvent = (receipt: any) => {
        const log = receipt.logs.find((log: any) => {
          try {
            return setup.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "TIPLSetupComplete";
          } catch { return false; }
        });
        return setup.interface.parseLog({ topics: log.topics as string[], data: log.data });
      };

      const event1 = getEvent(receipt1);
      const event2 = getEvent(receipt2);

      // Different tokens
      expect(event1!.args.token).to.not.equal(event2!.args.token);
      // Different multisigs
      expect(event1!.args.multisig).to.not.equal(event2!.args.multisig);
    });
  });
});
