import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ethers, network, artifacts } from "hardhat";

/**
 * Deploys the NullOwn contract suite and writes the resulting addresses to
 * `deployments/<network>.json` for the frontend to consume.
 *
 * The generated Groth16 verifier must exist before this runs — see
 * `scripts/setup-zkeys.ts`. Deploying `OwnershipVerifier` against anything other
 * than the real generated verifier would produce a system that accepts
 * unverified proofs, so this script stops rather than substituting a stand-in.
 */

const GENERATED_VERIFIER = path.join(__dirname, "..", "contracts", "zk", "Groth16Verifier.sol");

async function main(): Promise<void> {
  if (!existsSync(GENERATED_VERIFIER)) {
    throw new Error(
      [
        "contracts/zk/Groth16Verifier.sol is missing.",
        "",
        "It is generated from the compiled circuit, never written by hand. Run:",
        "  npm run circuits:setup",
        "",
        "See contracts/zk/README.md for the manual snarkjs equivalent.",
      ].join("\n"),
    );
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No signer available. Set PRIVATE_KEY in .env for public networks.");
  }

  const deployerAddress = await deployer.getAddress();
  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployerAddress))} ETH\n`);

  // --- Layer 1: stealth address protocol -----------------------------------
  const registry = await (await ethers.getContractFactory("ERC6538Registry")).deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`ERC6538Registry    -> ${registryAddress}`);

  const announcer = await (await ethers.getContractFactory("ERC5564Announcer")).deploy();
  await announcer.waitForDeployment();
  const announcerAddress = await announcer.getAddress();
  console.log(`ERC5564Announcer   -> ${announcerAddress}`);

  // --- Layer 2: zero-knowledge ownership proofs ----------------------------
  const groth16 = await (await ethers.getContractFactory("Groth16Verifier")).deploy();
  await groth16.waitForDeployment();
  const groth16Address = await groth16.getAddress();
  console.log(`Groth16Verifier    -> ${groth16Address}`);

  const verifier = await (await ethers.getContractFactory("OwnershipVerifier")).deploy(groth16Address);
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log(`OwnershipVerifier  -> ${verifierAddress}`);

  // --- Layer 3: compliance bridge ------------------------------------------
  const compliance = await (await ethers.getContractFactory("ComplianceModule")).deploy(deployerAddress);
  await compliance.waitForDeployment();
  const complianceAddress = await compliance.getAddress();
  console.log(`ComplianceModule   -> ${complianceAddress}`);

  const deploymentBlock = await ethers.provider.getBlockNumber();

  const record = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployerAddress,
    // The scanner needs this: replaying announcements from block 0 is rejected
    // by most public RPC providers.
    deploymentBlock,
    contracts: {
      ERC6538Registry: registryAddress,
      ERC5564Announcer: announcerAddress,
      Groth16Verifier: groth16Address,
      OwnershipVerifier: verifierAddress,
      ComplianceModule: complianceAddress,
    },
  };

  const outDir = path.join(__dirname, "..", "deployments");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, `${network.name}.json`), `${JSON.stringify(record, null, 2)}\n`);

  console.log(`\nSaved deployments/${network.name}.json`);
  console.log("\nAdd to frontend/.env.local:\n");
  console.log(`NEXT_PUBLIC_ERC6538_ADDRESS=${registryAddress}`);
  console.log(`NEXT_PUBLIC_ERC5564_ADDRESS=${announcerAddress}`);
  console.log(`NEXT_PUBLIC_VERIFIER_ADDRESS=${verifierAddress}`);
  console.log(`NEXT_PUBLIC_COMPLIANCE_ADDRESS=${complianceAddress}`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=${record.chainId}`);
  console.log(`NEXT_PUBLIC_ANNOUNCEMENT_START_BLOCK=${deploymentBlock}`);

  await exportAbis();
}

/**
 * Mirrors compiled ABIs into the frontend so `lib/abis` never drifts from the
 * contracts. Only the ABI fragment is copied — bytecode is irrelevant there.
 */
async function exportAbis(): Promise<void> {
  const names = [
    "ERC6538Registry",
    "ERC5564Announcer",
    "OwnershipVerifier",
    "ComplianceModule",
  ] as const;

  const outDir = path.join(__dirname, "..", "frontend", "lib", "abis", "generated");
  mkdirSync(outDir, { recursive: true });

  for (const name of names) {
    const artifact = await artifacts.readArtifact(name);
    writeFileSync(
      path.join(outDir, `${name}.json`),
      `${JSON.stringify(artifact.abi, null, 2)}\n`,
    );
  }

  console.log(`\nExported ${names.length} ABIs to frontend/lib/abis/generated/`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
