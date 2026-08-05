import { describe, it, expect } from "vitest";
import type { Groth16Proof } from "snarkjs";

import {
  deriveSpendKeyHash,
  computeNullifier,
  formatProofForSolidity,
  formatPublicSignals,
  ProverError,
} from "../zkProver";
import { BN254_FIELD_MODULUS, poseidonHash2 } from "../poseidon";

/**
 * Covers the pure parts of the prover: input derivation and Solidity encoding.
 * Actual proof generation needs the compiled circuit artifacts and is exercised
 * end-to-end only after `npm run circuits:setup`.
 */

const SPEND_KEY = `0x${"11".repeat(32)}`;

describe("spend key hash", () => {
  it("is deterministic", async () => {
    expect(await deriveSpendKeyHash(SPEND_KEY)).toBe(await deriveSpendKeyHash(SPEND_KEY));
  });

  it("differs for different keys", async () => {
    expect(await deriveSpendKeyHash(SPEND_KEY)).not.toBe(
      await deriveSpendKeyHash(`0x${"22".repeat(32)}`),
    );
  });

  it("lands inside the BN254 field", async () => {
    const hash = await deriveSpendKeyHash(`0x${"ff".repeat(32)}`);

    expect(hash).toBeGreaterThanOrEqual(0n);
    expect(hash).toBeLessThan(BN254_FIELD_MODULUS);
  });

  it("accepts a key with or without the 0x prefix", async () => {
    expect(await deriveSpendKeyHash(SPEND_KEY)).toBe(await deriveSpendKeyHash("11".repeat(32)));
  });

  it("rejects a key that is not 32 bytes", async () => {
    await expect(deriveSpendKeyHash("0x1234")).rejects.toThrow(ProverError);
  });
});

describe("nullifier", () => {
  it("matches Poseidon(spendKeyHash, tokenId), as the circuit computes it", async () => {
    const spendKeyHash = await deriveSpendKeyHash(SPEND_KEY);

    expect(await computeNullifier(spendKeyHash, 42n)).toBe(
      await poseidonHash2(spendKeyHash, 42n),
    );
  });

  it("is stable for the same key and token", async () => {
    const spendKeyHash = await deriveSpendKeyHash(SPEND_KEY);

    // Stability is what makes on-chain replay protection work at all.
    expect(await computeNullifier(spendKeyHash, 42n)).toBe(
      await computeNullifier(spendKeyHash, 42n),
    );
  });

  it("differs across tokens", async () => {
    const spendKeyHash = await deriveSpendKeyHash(SPEND_KEY);

    expect(await computeNullifier(spendKeyHash, 1n)).not.toBe(
      await computeNullifier(spendKeyHash, 2n),
    );
  });

  it("differs across holders for the same token", async () => {
    const mine = await deriveSpendKeyHash(SPEND_KEY);
    const theirs = await deriveSpendKeyHash(`0x${"33".repeat(32)}`);

    expect(await computeNullifier(mine, 42n)).not.toBe(await computeNullifier(theirs, 42n));
  });
});

describe("Solidity proof encoding", () => {
  // Distinct sentinel values throughout, including the projective coordinates,
  // so every positional assertion below is unambiguous.
  const proof: Groth16Proof = {
    pi_a: ["1", "2", "901"],
    pi_b: [
      ["3", "4"],
      ["5", "6"],
      ["902", "903"],
    ],
    pi_c: ["7", "8", "904"],
    protocol: "groth16",
    curve: "bn128",
  };

  it("flattens to eight field elements", () => {
    expect(formatProofForSolidity(proof)).toHaveLength(8);
  });

  it("swaps the G2 coordinate pairs the way the generated verifier expects", () => {
    const flat = formatProofForSolidity(proof);

    // pi_a passes through unchanged.
    expect(flat[0]).toBe(1n);
    expect(flat[1]).toBe(2n);

    // pi_b inner pairs are reversed: [0][1] before [0][0].
    expect(flat[2]).toBe(4n);
    expect(flat[3]).toBe(3n);
    expect(flat[4]).toBe(6n);
    expect(flat[5]).toBe(5n);

    // pi_c passes through unchanged, dropping the projective coordinate.
    expect(flat[6]).toBe(7n);
    expect(flat[7]).toBe(8n);
  });

  it("drops the projective coordinates of every point", () => {
    const flat = formatProofForSolidity(proof);

    // 901/902/903/904 are the third coordinates; none belongs in calldata.
    for (const projective of [901n, 902n, 903n, 904n]) {
      expect(flat).not.toContain(projective);
    }
  });

  it("produces exactly the expected calldata", () => {
    expect(formatProofForSolidity(proof)).toEqual([1n, 2n, 4n, 3n, 6n, 5n, 7n, 8n]);
  });
});

describe("public signal encoding", () => {
  it("converts three decimal strings to bigints in order", () => {
    expect(formatPublicSignals(["100", "200", "300"])).toEqual([100n, 200n, 300n]);
  });

  it("rejects the wrong number of signals", () => {
    expect(() => formatPublicSignals(["1", "2"])).toThrow(ProverError);
    expect(() => formatPublicSignals(["1", "2", "3", "4"])).toThrow(ProverError);
  });

  it("handles full-width field elements", () => {
    const large = (BN254_FIELD_MODULUS - 1n).toString();
    expect(formatPublicSignals([large, "1", large])[0]).toBe(BN254_FIELD_MODULUS - 1n);
  });
});
