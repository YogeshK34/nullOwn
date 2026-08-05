import type { Groth16Proof, PublicSignals, VerificationKey } from "snarkjs";

import type { MerkleProof } from "./merkle";
import { MERKLE_DEPTH } from "./merkle";
import { poseidonHash, poseidonHash2, bytesToField, toField } from "./poseidon";

/**
 * Client-side Groth16 proving.
 *
 * ---------------------------------------------------------------------------
 * This runs in the browser, and only in the browser
 * ---------------------------------------------------------------------------
 * ARCHITECTURE.md §13 constraint 3: proof generation must never move to a
 * server. The witness contains the token id, the quantity, and the spend key
 * hash — handing that to a backend would surrender exactly the privacy the
 * system exists to provide. Every entry point here refuses to run outside a
 * browser rather than silently degrading.
 *
 * ---------------------------------------------------------------------------
 * Artifacts
 * ---------------------------------------------------------------------------
 * Proving needs two files served from `/public/circuits/`, both produced by
 * `npm run circuits:setup`:
 *
 *   ownership_proof.wasm         witness generator (~1 MB)
 *   ownership_proof_final.zkey   proving key (tens of MB)
 *
 * They are not in the repository — the zkey is far too large for git, and both
 * are build outputs of a circom toolchain that is not a runtime dependency.
 * When they are absent, `generateOwnershipProof` throws a specific, actionable
 * error. It never returns a placeholder proof: a fake proof that the UI treated
 * as real would be worse than no proof at all.
 */

const WASM_URL = "/circuits/ownership_proof.wasm";
const ZKEY_URL = "/circuits/ownership_proof_final.zkey";
const VERIFICATION_KEY_URL = "/circuits/verification_key.json";

/** Groth16 proof flattened for `OwnershipVerifier.verifyOwnership`. */
export type SolidityProof = readonly [
  bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
];

/** Public signals in circuit order: `[merkleRoot, threshold, nullifier]`. */
export type SolidityPublicSignals = readonly [bigint, bigint, bigint];

export interface OwnershipProofInputs {
  tokenId: bigint;
  quantity: bigint;
  /** Poseidon hash of the spend key — see `deriveSpendKeyHash`. */
  spendKeyHash: bigint;
  /** Inclusion proof for `Poseidon(tokenId, quantity)`. */
  merkleProof: MerkleProof;
  /** Minimum quantity being attested. Must be ≤ `quantity`. */
  threshold: bigint;
}

export interface OwnershipProofResult {
  proof: Groth16Proof;
  publicSignals: PublicSignals;
  /** Calldata-ready form for the verifier contract. */
  solidityProof: SolidityProof;
  solidityPublicSignals: SolidityPublicSignals;
  /** Nullifier as `bytes32`, for checking replay before submitting. */
  nullifier: `0x${string}`;
  /** Wall-clock proving time, surfaced in the UI. */
  provingTimeMs: number;
}

export class ProverError extends Error {
  constructor(
    message: string,
    /** Set when the failure is missing build artifacts rather than bad input. */
    readonly missingArtifacts = false,
  ) {
    super(message);
    this.name = "ProverError";
  }
}

const ARTIFACTS_MISSING_MESSAGE = [
  "Circuit artifacts are not available.",
  "",
  "Proof generation needs ownership_proof.wasm and ownership_proof_final.zkey in",
  "frontend/public/circuits/. Both are build outputs, not repository files.",
  "",
  "Generate them with:  npm run circuits:setup   (requires circom on PATH)",
].join("\n");

function assertBrowser(): void {
  if (typeof window === "undefined") {
    throw new ProverError(
      "Proof generation is browser-only. Private witness data must never reach a server.",
    );
  }
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

/**
 * `spendKeyHash = Poseidon(spendKey)`.
 *
 * The raw key is reduced into the BN254 scalar field first — a 256-bit key can
 * exceed the modulus, and the circuit would wrap it silently. Hashing rather
 * than using the key directly keeps the key itself out of the witness.
 */
export async function deriveSpendKeyHash(spendPrivateKey: string): Promise<bigint> {
  const clean = spendPrivateKey.startsWith("0x") ? spendPrivateKey.slice(2) : spendPrivateKey;
  if (clean.length !== 64) {
    throw new ProverError("Spend private key must be 32 bytes.");
  }

  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }

  return poseidonHash([bytesToField(bytes)]);
}

/** `nullifier = Poseidon(spendKeyHash, tokenId)` — must match `nullifier.circom`. */
export async function computeNullifier(spendKeyHash: bigint, tokenId: bigint): Promise<bigint> {
  return poseidonHash2(toField(spendKeyHash), toField(tokenId));
}

// ---------------------------------------------------------------------------
// Artifact availability
// ---------------------------------------------------------------------------

/**
 * Whether the circuit artifacts are actually served.
 *
 * Uses HEAD requests so the multi-megabyte zkey is not downloaded just to check.
 * Next.js returns the HTML 404 page with a 404 status for missing public files,
 * so the status check is sufficient.
 */
export async function areCircuitArtifactsAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const responses = await Promise.all([
      fetch(WASM_URL, { method: "HEAD" }),
      fetch(ZKEY_URL, { method: "HEAD" }),
    ]);
    return responses.every((response) => response.ok);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Proving
// ---------------------------------------------------------------------------

/**
 * Generate a Groth16 ownership proof.
 *
 * Blocks the main thread for several seconds at depth 20 — callers should
 * render a busy state before awaiting. Moving this into a Web Worker is
 * tracked as technical debt; it changes responsiveness, not correctness.
 */
export async function generateOwnershipProof(
  inputs: OwnershipProofInputs,
): Promise<OwnershipProofResult> {
  assertBrowser();
  validateInputs(inputs);

  if (!(await areCircuitArtifactsAvailable())) {
    throw new ProverError(ARTIFACTS_MISSING_MESSAGE, true);
  }

  const nullifier = await computeNullifier(inputs.spendKeyHash, inputs.tokenId);

  const circuitInputs = {
    tokenId: toField(inputs.tokenId).toString(),
    quantity: toField(inputs.quantity).toString(),
    spendKeyHash: toField(inputs.spendKeyHash).toString(),
    merklePathElements: inputs.merkleProof.pathElements.map((element) => element.toString()),
    merklePathIndices: inputs.merkleProof.pathIndices.map((index) => index.toString()),
    merkleRoot: toField(inputs.merkleProof.root).toString(),
    threshold: toField(inputs.threshold).toString(),
    nullifier: nullifier.toString(),
  };

  // Imported lazily: snarkjs is large and pulls in WASM glue that has no place
  // in the server bundle.
  const { groth16 } = await import("snarkjs");

  const startedAt = performance.now();
  let proof: Groth16Proof;
  let publicSignals: PublicSignals;

  try {
    ({ proof, publicSignals } = await groth16.fullProve(circuitInputs, WASM_URL, ZKEY_URL));
  } catch (error) {
    // The usual cause is an unsatisfiable witness — a threshold above the real
    // quantity, or a Merkle path that does not reach the advertised root.
    throw new ProverError(
      `Proof generation failed: ${error instanceof Error ? error.message : String(error)}. ` +
        "Check that the threshold does not exceed the holding and that the Merkle proof matches the root.",
    );
  }

  const provingTimeMs = performance.now() - startedAt;

  return {
    proof,
    publicSignals,
    solidityProof: formatProofForSolidity(proof),
    solidityPublicSignals: formatPublicSignals(publicSignals),
    nullifier: `0x${nullifier.toString(16).padStart(64, "0")}`,
    provingTimeMs,
  };
}

function validateInputs(inputs: OwnershipProofInputs): void {
  const { merkleProof, threshold, quantity } = inputs;

  if (merkleProof.pathElements.length !== MERKLE_DEPTH) {
    throw new ProverError(
      `Merkle path must have ${MERKLE_DEPTH} elements, received ${merkleProof.pathElements.length}.`,
    );
  }
  if (merkleProof.pathIndices.length !== MERKLE_DEPTH) {
    throw new ProverError(
      `Merkle indices must have ${MERKLE_DEPTH} entries, received ${merkleProof.pathIndices.length}.`,
    );
  }
  if (threshold < 0n || quantity < 0n) {
    throw new ProverError("Quantity and threshold must be non-negative.");
  }
  if (threshold > quantity) {
    // The circuit would reject this anyway, after a minute of proving.
    throw new ProverError(
      `Cannot attest a threshold of ${threshold} against a holding of ${quantity}.`,
    );
  }
  // Matches QUANTITY_BITS in ownership_proof.circom.
  const maxQuantity = 1n << 128n;
  if (quantity >= maxQuantity || threshold >= maxQuantity) {
    throw new ProverError("Quantity and threshold must each fit in 128 bits.");
  }
}

// ---------------------------------------------------------------------------
// Solidity encoding
// ---------------------------------------------------------------------------

/**
 * Flatten a proof into the `uint256[8]` the verifier expects.
 *
 * The G2 coordinate swap is the subtle part. SnarkJS stores `pi_b` in the
 * order the pairing library uses internally, while the generated Solidity
 * verifier expects the two field components of each G2 coordinate reversed —
 * which is why `exportSolidityCallData` emits `[pi_b[0][1], pi_b[0][0]]`. Doing
 * it here, once, keeps every caller from having to know. Applying the swap a
 * second time downstream produces a proof that fails verification with no
 * useful error.
 */
export function formatProofForSolidity(proof: Groth16Proof): SolidityProof {
  return [
    BigInt(proof.pi_a[0]),
    BigInt(proof.pi_a[1]),
    BigInt(proof.pi_b[0][1]),
    BigInt(proof.pi_b[0][0]),
    BigInt(proof.pi_b[1][1]),
    BigInt(proof.pi_b[1][0]),
    BigInt(proof.pi_c[0]),
    BigInt(proof.pi_c[1]),
  ] as const;
}

/** Convert public signals to `uint256[3]`, asserting the expected count. */
export function formatPublicSignals(publicSignals: PublicSignals): SolidityPublicSignals {
  if (publicSignals.length !== 3) {
    throw new ProverError(
      `Expected 3 public signals [merkleRoot, threshold, nullifier], received ${publicSignals.length}.`,
    );
  }
  return [
    BigInt(publicSignals[0]!),
    BigInt(publicSignals[1]!),
    BigInt(publicSignals[2]!),
  ] as const;
}

// ---------------------------------------------------------------------------
// Off-chain verification
// ---------------------------------------------------------------------------

/**
 * Verify a proof locally against the exported verification key.
 *
 * Cheap relative to proving, and it catches a bad proof before the user pays
 * gas to have the chain reject it.
 */
export async function verifyProofOffChain(
  proof: Groth16Proof,
  publicSignals: PublicSignals,
): Promise<boolean> {
  assertBrowser();

  const response = await fetch(VERIFICATION_KEY_URL);
  if (!response.ok) {
    throw new ProverError(ARTIFACTS_MISSING_MESSAGE, true);
  }

  const verificationKey = (await response.json()) as VerificationKey;
  const { groth16 } = await import("snarkjs");
  return groth16.verify(verificationKey, publicSignals, proof);
}
