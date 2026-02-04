import { ethers } from "hardhat";

async function main() {
  const factory = await ethers.getContractAt(
    "TokenFactory",
    process.env.TOKEN_FACTORY_ADDRESS!
  );

  const name = "Test TIPL token construction";
  const symbol = "TEST7777";
  const recipient = "0x843CD0fb7b8f317fad967356c6377F8C3725d190";

  console.log(`Creating token: ${name} (${symbol})`);
  console.log(`Recipient: ${recipient}`);

  const tx = await factory.createToken(name, symbol, recipient);
  const receipt = await tx.wait();

  const event = receipt?.logs
    .map((log) => {
      try {
        return factory.interface.parseLog({ topics: [...log.topics], data: log.data });
      } catch {
        return null;
      }
    })
    .find((e) => e?.name === "TokenCreated");

  const tokenAddress = event?.args?.tokenAddress;
  console.log("Token deployed to:", tokenAddress);
  console.log("Tx hash:", receipt?.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
