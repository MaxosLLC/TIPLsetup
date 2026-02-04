import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const Factory = await ethers.getContractFactory("TokenFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  const address = await factory.getAddress();
  console.log("TokenFactory deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
