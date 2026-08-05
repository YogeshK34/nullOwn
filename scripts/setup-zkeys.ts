import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";

/**
 * Compiles `ownership_proof.circom` and runs the Groth16 trusted setup, then
 * places the artifacts where the rest of the repo expects them:
 *
 *   contracts/zk/Groth16Verifier.sol       <- deployed by scripts/deploy.ts
 *   frontend/public/circuits/*.wasm|.zkey  <- loaded by the browser prover
 *   circuits/build/verification_key.json   <- off-chain verification
 *
 * Requires `circom` on PATH (https://docs.circom.io/getting-started/installation).
 * SnarkJS comes from devDependencies.
 *
 * The Powers of Tau file is downloaded, not generated. Phase 1 is a universal
 * ceremony; re-running it locally would produce a setup nobody should trust.
 * Phase 2 below is a single-contributor setup, which is fine for a testnet but
 * NOT acceptable for mainnet — see the warning printed at the end.
 */

const ROOT = path.join(__dirname, "..");
const CIRCUITS = path.join(ROOT, "circuits");
const BUILD = path.join(CIRCUITS, "build");
const PUBLIC_CIRCUITS = path.join(ROOT, "frontend", "public", "circuits");

const CIRCUIT = "ownership_proof";

// Depth 20 puts the circuit comfortably under 2^17 constraints.
const PTAU = "powersOfTau28_hez_final_17.ptau";
const PTAU_URL = `https://storage.googleapis.com/zkevm/ptau/${PTAU}`;

function run(command: string, args: string[], cwd: string = ROOT): void {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
}

function snarkjs(args: string[]): void {
  run("npx", ["snarkjs", ...args]);
}

function main(): void {
  mkdirSync(BUILD, { recursive: true });
  mkdirSync(PUBLIC_CIRCUITS, { recursive: true });

  // --- 1. Compile the circuit ----------------------------------------------
  // `-l node_modules` resolves the `circomlib/circuits/...` includes.
  run("circom", [
    path.join("circuits", `${CIRCUIT}.circom`),
    "--r1cs",
    "--wasm",
    "--sym",
    "-o",
    path.join("circuits", "build"),
    "-l",
    "node_modules",
    "-l",
    "circuits",
  ]);

  // --- 2. Powers of Tau (phase 1, universal) -------------------------------
  const ptauPath = path.join(BUILD, PTAU);
  if (!existsSync(ptauPath)) {
    console.log(`\nDownloading ${PTAU} (~300 MB, one time)...`);
    run("curl", ["-L", "-o", ptauPath, PTAU_URL]);
  } else {
    console.log(`\nReusing existing ${PTAU}`);
  }

  // --- 3. Groth16 setup (phase 2, circuit specific) ------------------------
  const r1cs = path.join(BUILD, `${CIRCUIT}.r1cs`);
  const zkey0 = path.join(BUILD, `${CIRCUIT}_0000.zkey`);
  const zkeyFinal = path.join(BUILD, `${CIRCUIT}_final.zkey`);

  snarkjs(["groth16", "setup", r1cs, ptauPath, zkey0]);
  snarkjs([
    "zkey",
    "contribute",
    zkey0,
    zkeyFinal,
    "--name=NullOwn testnet contribution",
    "-v",
    `-e=${randomEntropy()}`,
  ]);

  // --- 4. Export artifacts -------------------------------------------------
  snarkjs(["zkey", "export", "verificationkey", zkeyFinal, path.join(BUILD, "verification_key.json")]);
  snarkjs([
    "zkey",
    "export",
    "solidityverifier",
    zkeyFinal,
    path.join("contracts", "zk", "Groth16Verifier.sol"),
  ]);

  // --- 5. Publish what the browser prover needs ----------------------------
  copyFileSync(
    path.join(BUILD, `${CIRCUIT}_js`, `${CIRCUIT}.wasm`),
    path.join(PUBLIC_CIRCUITS, `${CIRCUIT}.wasm`),
  );
  copyFileSync(zkeyFinal, path.join(PUBLIC_CIRCUITS, `${CIRCUIT}_final.zkey`));
  copyFileSync(
    path.join(BUILD, "verification_key.json"),
    path.join(PUBLIC_CIRCUITS, "verification_key.json"),
  );

  console.log(`
Done.

  contracts/zk/Groth16Verifier.sol            generated
  frontend/public/circuits/${CIRCUIT}.wasm     published
  frontend/public/circuits/${CIRCUIT}_final.zkey published
  frontend/public/circuits/verification_key.json published

WARNING: phase 2 ran with a single local contribution. That is acceptable for a
testnet, but a mainnet deployment needs a multi-party ceremony — a single
contributor who retains their toxic waste can forge proofs.
`);
}

/** Entropy for the phase-2 contribution. Not a substitute for a real ceremony. */
function randomEntropy(): string {
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join("");
}

main();
