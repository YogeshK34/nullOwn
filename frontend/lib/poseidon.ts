import { buildPoseidon, type Poseidon } from "circomlibjs";

/**
 * Poseidon hashing, matched bit-for-bit to the circuit.
 *
 * `circuits/poseidon/poseidon.circom` and this module must agree exactly — the
 * Merkle root computed here is the public signal the on-chain verifier checks
 * against a proof built by the circuit. circomlibjs implements the same
 * permutation and round constants circomlib compiles into the R1CS, which is
 * what makes that hold.
 *
 * Initialisation is expensive (it derives constants and sets up field
 * arithmetic), so the instance is built once and shared. Concurrent callers
 * await the same in-flight promise rather than racing to build several.
 */

/** BN254 scalar field modulus — the field every signal lives in. */
export const BN254_FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

let poseidonPromise: Promise<Poseidon> | undefined;

/** Shared Poseidon instance, built on first use. */
export async function getPoseidon(): Promise<Poseidon> {
  poseidonPromise ??= buildPoseidon();
  return poseidonPromise;
}

/**
 * Hash field elements to a single field element.
 *
 * Inputs are reduced into the field first: a value at or above the modulus
 * would be silently wrapped by the circuit, and a mismatch between what JS
 * hashes and what the circuit hashes shows up only as an unprovable witness.
 */
export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  if (inputs.length === 0) {
    throw new Error("poseidonHash requires at least one input.");
  }

  const poseidon = await getPoseidon();
  const reduced = inputs.map(toField);
  return BigInt(poseidon.F.toString(poseidon(reduced)));
}

/** Two-input Poseidon — the Merkle node and nullifier shape. */
export async function poseidonHash2(left: bigint, right: bigint): Promise<bigint> {
  return poseidonHash([left, right]);
}

/** Reduce any integer into the BN254 scalar field, handling negatives. */
export function toField(value: bigint): bigint {
  const reduced = value % BN254_FIELD_MODULUS;
  return reduced < 0n ? reduced + BN254_FIELD_MODULUS : reduced;
}

/** Whether a value is already a canonical field element. */
export function isFieldElement(value: bigint): boolean {
  return value >= 0n && value < BN254_FIELD_MODULUS;
}

/**
 * Fold a byte string into the field.
 *
 * Used to turn a 32-byte spend key into `spendKeyHash`. A raw 256-bit key can
 * exceed the field modulus, so it is reduced rather than truncated — reduction
 * preserves the full input's influence on the result.
 */
export function bytesToField(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return toField(value);
}

/** Parse a `0x`-prefixed hex string into a field element. */
export function hexToField(hex: string): bigint {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return toField(clean.length === 0 ? 0n : BigInt(`0x${clean}`));
}

/** Render a field element as a 32-byte hex string, for `bytes32` calldata. */
export function fieldToHex32(value: bigint): `0x${string}` {
  return `0x${toField(value).toString(16).padStart(64, "0")}`;
}
