import { ethers, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying TIPLSetup with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const SetupFactory = await ethers.getContractFactory("TIPLSetup");
  const setup = await SetupFactory.deploy();
  await setup.waitForDeployment();

  const address = await setup.getAddress();
  console.log("TIPLSetup deployed to:", address);

  // Verify on BaseScan
  console.log("Verifying on BaseScan...");
  try {
    await run("verify:verify", {
      address: address,
      constructorArguments: [],
    });
    console.log("Verified successfully on BaseScan");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("Contract already verified");
    } else {
      console.error("Verification failed:", error.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
