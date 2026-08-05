import { describe, it, expect } from "vitest";

import {
  buildMerkleTree,
  getMerkleProof,
  verifyMerkleProof,
  computeLeaf,
  findLeafIndex,
  zeroHashes,
  MerkleError,
  MERKLE_DEPTH,
  type TokenHolding,
} from "../merkle";
import { BN254_FIELD_MODULUS, poseidonHash2 } from "../poseidon";

const holdings: TokenHolding[] = [
  { tokenId: 1n, quantity: 1n },
  { tokenId: 42n, quantity: 100n },
  { tokenId: 7n, quantity: 5n },
  { tokenId: 999n, quantity: 1n },
];

describe("leaf construction", () => {
  it("commits both tokenId and quantity", async () => {
    const a = await computeLeaf(42n, 100n);
    const b = await computeLeaf(42n, 101n);

    // If quantity were not committed, the circuit's >= check would be vacuous.
    expect(a).not.toBe(b);
  });

  it("is deterministic", async () => {
    expect(await computeLeaf(42n, 100n)).toBe(await computeLeaf(42n, 100n));
  });

  it("matches Poseidon(tokenId, quantity) exactly", async () => {
    expect(await computeLeaf(42n, 100n)).toBe(await poseidonHash2(42n, 100n));
  });

  it("stays inside the BN254 field", async () => {
    const leaf = await computeLeaf(BN254_FIELD_MODULUS - 1n, 2n ** 120n);
    expect(leaf).toBeGreaterThanOrEqual(0n);
    expect(leaf).toBeLessThan(BN254_FIELD_MODULUS);
  });
});

describe("tree construction", () => {
  it("builds a depth-20 tree by default", async () => {
    const tree = await buildMerkleTree(holdings);

    expect(tree.depth).toBe(MERKLE_DEPTH);
    expect(tree.layers).toHaveLength(MERKLE_DEPTH + 1);
    expect(tree.leaves).toHaveLength(holdings.length);
  });

  it("gives an empty tree the all-zero root", async () => {
    const tree = await buildMerkleTree([]);
    const zeros = await zeroHashes(MERKLE_DEPTH);

    expect(tree.root).toBe(zeros[MERKLE_DEPTH]);
  });

  it("changes the root when a holding changes", async () => {
    const original = await buildMerkleTree(holdings);
    const mutated = await buildMerkleTree([
      ...holdings.slice(0, 1),
      { tokenId: 42n, quantity: 101n },
      ...holdings.slice(2),
    ]);

    expect(mutated.root).not.toBe(original.root);
  });

  it("is order sensitive", async () => {
    const forward = await buildMerkleTree(holdings);
    const reversed = await buildMerkleTree([...holdings].reverse());

    expect(reversed.root).not.toBe(forward.root);
  });

  it("handles an odd leaf count by padding with the zero subtree", async () => {
    const tree = await buildMerkleTree(holdings.slice(0, 3));
    expect(tree.leaves).toHaveLength(3);
    expect(tree.root).toBeGreaterThan(0n);
  });

  it("handles a single holding", async () => {
    const tree = await buildMerkleTree([{ tokenId: 1n, quantity: 1n }]);
    const proof = await getMerkleProof(tree, 0);

    expect(await verifyMerkleProof(proof)).toBe(true);
  });
});

describe("inclusion proofs", () => {
  it("verifies for every leaf", async () => {
    const tree = await buildMerkleTree(holdings);

    for (let index = 0; index < holdings.length; index++) {
      const proof = await getMerkleProof(tree, index);
      expect(await verifyMerkleProof(proof)).toBe(true);
    }
  });

  it("returns exactly `depth` path elements and indices", async () => {
    const tree = await buildMerkleTree(holdings);
    const proof = await getMerkleProof(tree, 1);

    expect(proof.pathElements).toHaveLength(MERKLE_DEPTH);
    expect(proof.pathIndices).toHaveLength(MERKLE_DEPTH);
  });

  it("emits only binary path indices", async () => {
    const tree = await buildMerkleTree(holdings);
    const proof = await getMerkleProof(tree, 2);

    for (const index of proof.pathIndices) {
      expect([0, 1]).toContain(index);
    }
  });

  it("encodes the leaf index in the path bits", async () => {
    const tree = await buildMerkleTree(holdings);

    for (let index = 0; index < holdings.length; index++) {
      const proof = await getMerkleProof(tree, index);
      const rebuilt = proof.pathIndices.reduce(
        (acc, bit, level) => acc | (bit << level),
        0,
      );
      expect(rebuilt).toBe(index);
    }
  });

  it("fails verification against a tampered sibling", async () => {
    const tree = await buildMerkleTree(holdings);
    const proof = await getMerkleProof(tree, 1);

    const tampered = {
      ...proof,
      pathElements: [proof.pathElements[0]! + 1n, ...proof.pathElements.slice(1)],
    };

    expect(await verifyMerkleProof(tampered)).toBe(false);
  });

  it("fails verification against a flipped path bit", async () => {
    const tree = await buildMerkleTree(holdings);
    const proof = await getMerkleProof(tree, 1);

    const tampered = {
      ...proof,
      pathIndices: [proof.pathIndices[0] === 0 ? 1 : 0, ...proof.pathIndices.slice(1)],
    };

    expect(await verifyMerkleProof(tampered)).toBe(false);
  });

  it("fails verification against a substituted leaf", async () => {
    const tree = await buildMerkleTree(holdings);
    const proof = await getMerkleProof(tree, 1);

    // Claiming quantity 1000 for a holding of 100 must not verify.
    const forged = { ...proof, leaf: await computeLeaf(42n, 1000n) };
    expect(await verifyMerkleProof(forged)).toBe(false);
  });

  it("rejects an out-of-range leaf index", async () => {
    const tree = await buildMerkleTree(holdings);

    await expect(getMerkleProof(tree, 99)).rejects.toThrow(MerkleError);
    await expect(getMerkleProof(tree, -1)).rejects.toThrow(MerkleError);
  });
});

describe("lookup", () => {
  it("finds a holding by tokenId and quantity", async () => {
    const tree = await buildMerkleTree(holdings);
    expect(await findLeafIndex(tree, 42n, 100n)).toBe(1);
  });

  it("returns -1 for a holding that is not present", async () => {
    const tree = await buildMerkleTree(holdings);

    expect(await findLeafIndex(tree, 42n, 999n)).toBe(-1);
    expect(await findLeafIndex(tree, 12345n, 1n)).toBe(-1);
  });
});

describe("zero hashes", () => {
  it("returns depth + 1 entries starting at the zero leaf", async () => {
    const zeros = await zeroHashes(MERKLE_DEPTH);

    expect(zeros).toHaveLength(MERKLE_DEPTH + 1);
    expect(zeros[0]).toBe(0n);
  });

  it("chains each level from the one below", async () => {
    const zeros = await zeroHashes(4);

    for (let level = 0; level < 4; level++) {
      expect(zeros[level + 1]).toBe(await poseidonHash2(zeros[level]!, zeros[level]!));
    }
  });
});
