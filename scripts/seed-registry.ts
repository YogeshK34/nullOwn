import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";

/**
 * Registers a stealth meta-address for the first signer so the app has
 * something to read on a fresh local chain.
 *
 * The keys minted here are throwaway development keys generated from local
 * randomness and printed to the console. Real stealth keys are derived in the
 * browser and never touch a script or a server — see
 * `frontend/lib/stealth.ts`.
 */

function loadRegistryAddress(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ERC6538_ADDRESS;
  if (fromEnv) return fromEnv;

  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!existsSync(file)) {
    throw new Error(
      `No registry address. Deploy first (npm run deploy:local) or set NEXT_PUBLIC_ERC6538_ADDRESS.`,
    );
  }

  const record = JSON.parse(readFileSync(file, "utf8")) as {
    contracts: { ERC6538Registry: string };
  };
  return record.contracts.ERC6538Registry;
}

async function main(): Promise<void> {
  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No signer available.");

  const registryAddress = loadRegistryAddress();
  const registry = await ethers.getContractAt("ERC6538Registry", registryAddress, signer);

  // Two independent secp256k1 keys: one to spend, one to scan.
  const spendPrivateKey = ethers.hexlify(ethers.randomBytes(32));
  const viewPrivateKey = ethers.hexlify(ethers.randomBytes(32));

  const spendPublicKey = new ethers.SigningKey(spendPrivateKey).compressedPublicKey;
  const viewPublicKey = new ethers.SigningKey(viewPrivateKey).compressedPublicKey;

  // Meta-address = spendPubKey || viewPubKey (33 + 33 bytes).
  const metaAddress = ethers.concat([spendPublicKey, viewPublicKey]);

  const tx = await registry.registerKeys(metaAddress);
  await tx.wait();

  console.log(`Registered meta-address for ${await signer.getAddress()}`);
  console.log(`  registry:    ${registryAddress}`);
  console.log(`  metaAddress: ${ethers.hexlify(metaAddress)}`);
  console.log(`
Development keys — import these into the app to scan for the seeded account.
DO NOT reuse them anywhere real:

  spend private key: ${spendPrivateKey}
  view  private key: ${viewPrivateKey}
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
