import { poseidonHash2, toField } from "./poseidon";

/**
 * Poseidon Merkle tree, built to match `circuits/merkle_inclusion.circom`.
 *
 * ---------------------------------------------------------------------------
 * Why it is sparse
 * ---------------------------------------------------------------------------
 * The circuit fixes depth at 20, i.e. 1,048,576 leaf slots. Materialising all
 * of them would mean a million Poseidon hashes for a wallet holding three
 * tokens. Instead, empty subtrees collapse into a precomputed chain of zero
 * hashes: `zero[0] = 0`, `zero[i+1] = Poseidon(zero[i], zero[i])`. Only the
 * populated prefix is ever hashed, and the root is identical to what the dense
 * tree would produce.
 *
 * ---------------------------------------------------------------------------
 * Leaf encoding
 * ---------------------------------------------------------------------------
 *   leaf = Poseidon(tokenId, quantity)
 *
 * Both fields are committed so the circuit's `quantity >= threshold` check is
 * binding — see the DATA MODEL NOTE in `circuits/ownership_proof.circom`.
 * ERC-721 holdings use quantity 1; ERC-1155 holdings use the real balance.
 *
 * Path index convention matches `OrderedPair`: bit 0 means the running node is
 * the *left* child at that level.
 */

/** Depth baked into `component main = OwnershipProof(20)`. */
export const MERKLE_DEPTH = 20;

/** Value filling unused leaf slots. */
export const ZERO_LEAF = 0n;

/** A single RWA position committed to the tree. */
export interface TokenHolding {
  tokenId: bigint;
  /** 1 for ERC-721; the balance for ERC-1155. */
  quantity: bigint;
}

export interface MerkleTree {
  root: bigint;
  depth: number;
  /** Leaf hashes in insertion order. */
  leaves: bigint[];
  /** `layers[0]` are the leaves; `layers[depth][0]` is the root. */
  layers: bigint[][];
}

export interface MerkleProof {
  leaf: bigint;
  leafIndex: number;
  /** Sibling hash at each level, bottom-up. Always `depth` entries. */
  pathElements: bigint[];
  /** 0 = node is the left child, 1 = right. Always `depth` entries. */
  pathIndices: number[];
  root: bigint;
}

export class MerkleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MerkleError";
  }
}

/** Zero hashes are depth-dependent only, so they are worth caching. */
const zeroHashCache = new Map<number, bigint[]>();

/**
 * `zero[i]` = root of an empty subtree of height `i`.
 * Returns `depth + 1` entries.
 */
export async function zeroHashes(depth: number = MERKLE_DEPTH): Promise<bigint[]> {
  const cached = zeroHashCache.get(depth);
  if (cached) return cached;

  const hashes: bigint[] = [ZERO_LEAF];
  for (let level = 0; level < depth; level++) {
    const previous = hashes[level]!;
    hashes.push(await poseidonHash2(previous, previous));
  }

  zeroHashCache.set(depth, hashes);
  return hashes;
}

/** `leaf = Poseidon(tokenId, quantity)`. */
export async function computeLeaf(tokenId: bigint, quantity: bigint): Promise<bigint> {
  return poseidonHash2(toField(tokenId), toField(quantity));
}

/** Leaf hashes for a list of holdings, preserving order. */
export async function computeLeaves(holdings: TokenHolding[]): Promise<bigint[]> {
  const leaves: bigint[] = [];
  for (const holding of holdings) {
    leaves.push(await computeLeaf(holding.tokenId, holding.quantity));
  }
  return leaves;
}

/**
 * Build the tree over a set of holdings.
 *
 * Hashing is sequential rather than `Promise.all`-parallel: circomlibjs runs
 * synchronously on one WASM instance, so concurrency would add scheduling
 * overhead without any real parallelism.
 */
export async function buildMerkleTree(
  holdings: TokenHolding[],
  depth: number = MERKLE_DEPTH,
): Promise<MerkleTree> {
  if (holdings.length > 2 ** Math.min(depth, 30)) {
    throw new MerkleError(`Too many holdings for a depth-${depth} tree.`);
  }

  const zeros = await zeroHashes(depth);
  const leaves = await computeLeaves(holdings);
  const layers: bigint[][] = [leaves];

  for (let level = 0; level < depth; level++) {
    const current = layers[level]!;
    const next: bigint[] = [];

    for (let i = 0; i < current.length; i += 2) {
      const left = current[i]!;
      // An odd tail pairs with the empty-subtree hash for this level.
      const right = current[i + 1] ?? zeros[level]!;
      next.push(await poseidonHash2(left, right));
    }

    layers.push(next);
  }

  // An empty tree still has a well-defined root: the all-zero subtree.
  const root = layers[depth]?.[0] ?? zeros[depth]!;

  return { root, depth, leaves, layers };
}

/** Inclusion proof for the leaf at `leafIndex`. */
export async function getMerkleProof(tree: MerkleTree, leafIndex: number): Promise<MerkleProof> {
  if (!Number.isInteger(leafIndex) || leafIndex < 0 || leafIndex >= tree.leaves.length) {
    throw new MerkleError(
      `Leaf index ${leafIndex} is out of range (tree holds ${tree.leaves.length} leaves).`,
    );
  }

  const zeros = await zeroHashes(tree.depth);
  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];

  let index = leafIndex;
  for (let level = 0; level < tree.depth; level++) {
    const layer = tree.layers[level] ?? [];
    const siblingIndex = index ^ 1;

    pathElements.push(layer[siblingIndex] ?? zeros[level]!);
    pathIndices.push(index & 1);

    index >>= 1;
  }

  return {
    leaf: tree.leaves[leafIndex]!,
    leafIndex,
    pathElements,
    pathIndices,
    root: tree.root,
  };
}

/** Locate a holding's leaf index, or -1 when absent. */
export async function findLeafIndex(
  tree: MerkleTree,
  tokenId: bigint,
  quantity: bigint,
): Promise<number> {
  const target = await computeLeaf(tokenId, quantity);
  return tree.leaves.findIndex((leaf) => leaf === target);
}

/**
 * Recompute the root from a proof.
 *
 * Worth running before submitting a transaction: a mismatch here means the
 * witness will fail in the prover, and catching it locally is far cheaper than
 * discovering it after a minute of proving.
 */
export async function verifyMerkleProof(proof: MerkleProof): Promise<boolean> {
  if (proof.pathElements.length !== proof.pathIndices.length) return false;

  let current = proof.leaf;
  for (let level = 0; level < proof.pathElements.length; level++) {
    const sibling = proof.pathElements[level]!;
    const isRightChild = proof.pathIndices[level] === 1;

    current = isRightChild
      ? await poseidonHash2(sibling, current)
      : await poseidonHash2(current, sibling);
  }

  return current === proof.root;
}
