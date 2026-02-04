import { expect } from "chai";
import { ethers } from "hardhat";
import { TokenFactory, TIPLToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("TokenFactory", function () {
  let factory: TokenFactory;
  let owner: SignerWithAddress;
  let recipient: SignerWithAddress;
  let other: SignerWithAddress;

  beforeEach(async function () {
    [owner, recipient, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TokenFactory");
    factory = await Factory.deploy();
  });

  describe("Deployment", function () {
    it("should deploy with zero tokens", async function () {
      expect(await factory.getDeployedTokenCount()).to.equal(0);
      expect(await factory.getDeployedTokens()).to.deep.equal([]);
    });
  });

  describe("createToken", function () {
    it("should deploy a token and return its address", async function () {
      const tx = await factory.createToken("TestToken", "TT", recipient.address);
      const receipt = await tx.wait();

      const count = await factory.getDeployedTokenCount();
      expect(count).to.equal(1);

      const tokenAddress = await factory.deployedTokens(0);
      expect(tokenAddress).to.be.properAddress;
    });

    it("should emit TokenCreated event with correct args", async function () {
      await expect(factory.createToken("TestToken", "TT", recipient.address))
        .to.emit(factory, "TokenCreated")
        .withArgs(
          // tokenAddress is dynamic, match any address
          (addr: string) => ethers.isAddress(addr),
          "TestToken",
          "TT",
          recipient.address
        );
    });

    it("should track token in deployedTokens array", async function () {
      await factory.createToken("TestToken", "TT", recipient.address);

      const tokens = await factory.getDeployedTokens();
      expect(tokens.length).to.equal(1);
      expect(tokens[0]).to.be.properAddress;

      const singleToken = await factory.deployedTokens(0);
      expect(singleToken).to.equal(tokens[0]);
    });

    it("should revert on zero-address recipient", async function () {
      await expect(
        factory.createToken("TestToken", "TT", ethers.ZeroAddress)
      ).to.be.revertedWith("Recipient cannot be zero address");
    });

    it("should deploy multiple independent tokens", async function () {
      await factory.createToken("Token1", "T1", recipient.address);
      await factory.createToken("Token2", "T2", other.address);

      expect(await factory.getDeployedTokenCount()).to.equal(2);

      const tokens = await factory.getDeployedTokens();
      expect(tokens[0]).to.not.equal(tokens[1]);
    });
  });

  describe("TIPLToken properties", function () {
    let token: TIPLToken;

    beforeEach(async function () {
      await factory.createToken("TestToken", "TT", recipient.address);
      const tokenAddress = await factory.deployedTokens(0);
      token = await ethers.getContractAt("TIPLToken", tokenAddress);
    });

    it("should have correct name, symbol, and 18 decimals", async function () {
      expect(await token.name()).to.equal("TestToken");
      expect(await token.symbol()).to.equal("TT");
      expect(await token.decimals()).to.equal(18);
    });

    it("should mint exactly 1,000,000 tokens to recipient", async function () {
      const expectedSupply = ethers.parseEther("1000000");
      expect(await token.totalSupply()).to.equal(expectedSupply);
      expect(await token.balanceOf(recipient.address)).to.equal(expectedSupply);
    });
  });

  describe("ERC20Burnable", function () {
    let token: TIPLToken;

    beforeEach(async function () {
      await factory.createToken("TestToken", "TT", recipient.address);
      const tokenAddress = await factory.deployedTokens(0);
      token = await ethers.getContractAt("TIPLToken", tokenAddress);
    });

    it("should allow burning tokens (reduces balance and supply)", async function () {
      const burnAmount = ethers.parseEther("100");
      const initialSupply = await token.totalSupply();

      await token.connect(recipient).burn(burnAmount);

      expect(await token.totalSupply()).to.equal(initialSupply - burnAmount);
      expect(await token.balanceOf(recipient.address)).to.equal(
        initialSupply - burnAmount
      );
    });
  });

  describe("ERC20Permit", function () {
    let token: TIPLToken;

    beforeEach(async function () {
      await factory.createToken("TestToken", "TT", recipient.address);
      const tokenAddress = await factory.deployedTokens(0);
      token = await ethers.getContractAt("TIPLToken", tokenAddress);
    });

    it("should support ERC20Permit (DOMAIN_SEPARATOR and nonces)", async function () {
      const domainSeparator = await token.DOMAIN_SEPARATOR();
      expect(domainSeparator).to.be.a("string");
      expect(domainSeparator).to.have.lengthOf(66); // 0x + 64 hex chars

      const nonce = await token.nonces(recipient.address);
      expect(nonce).to.equal(0);
    });
  });

  describe("ERC20 transfers", function () {
    let token: TIPLToken;

    beforeEach(async function () {
      await factory.createToken("TestToken", "TT", recipient.address);
      const tokenAddress = await factory.deployedTokens(0);
      token = await ethers.getContractAt("TIPLToken", tokenAddress);
    });

    it("should support standard ERC20 transfers", async function () {
      const transferAmount = ethers.parseEther("500");

      await token.connect(recipient).transfer(other.address, transferAmount);

      expect(await token.balanceOf(other.address)).to.equal(transferAmount);
      expect(await token.balanceOf(recipient.address)).to.equal(
        ethers.parseEther("1000000") - transferAmount
      );
    });
  });
});
