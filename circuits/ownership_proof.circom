pragma circom 2.0.0;

include "merkle_inclusion.circom";
include "nullifier.circom";
include "poseidon/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

/*
 * OwnershipProof
 * ==============
 * Proves "I hold at least `threshold` units of some token committed to in the
 * tree rooted at `merkleRoot`" while revealing neither the token nor the holder.
 *
 * Public signals (order is load-bearing — `OwnershipVerifier` reads
 * `pubSignals[2]` as the nullifier and `pubSignals[0]` as the root):
 *
 *   [0] merkleRoot
 *   [1] threshold
 *   [2] nullifier
 *
 *
 * DATA MODEL NOTE — leaf construction
 * -----------------------------------
 * ARCHITECTURE.md sketches `merkleCheck.leaf <== tokenId` and marks the
 * threshold constraint as "implementation depends on data model". Committing
 * only the tokenId leaves `quantity` free, and an unconstrained `quantity`
 * would make the `>= threshold` check prove nothing at all — a prover could
 * assert any amount. This circuit therefore commits both fields:
 *
 *   leaf = Poseidon(tokenId, quantity)
 *
 * That keeps constraint 3 sound and covers both supported token standards:
 * ERC-721 leaves carry quantity = 1, ERC-1155 leaves carry the real balance.
 * `frontend/lib/merkle.ts` builds leaves the same way.
 *
 *
 * NOT ENFORCED HERE — stealth address binding
 * -------------------------------------------
 * ARCHITECTURE.md lists as assertion #1 that `spendKeyHash` derives the stealth
 * address holding `tokenId`. That requires secp256k1 scalar multiplication
 * inside the circuit, which the document's own circuit sketch does not attempt
 * and which would add millions of constraints. The link between key and holding
 * is currently established when the tree is built, not proven in zero knowledge.
 * See IMPLEMENTATION_REPORT.md ("Technical Debt").
 */
template OwnershipProof(merkleDepth) {
    // --- Private inputs ---
    signal input tokenId;
    signal input quantity;
    signal input spendKeyHash;
    signal input merklePathElements[merkleDepth];
    signal input merklePathIndices[merkleDepth];

    // --- Public inputs ---
    signal input merkleRoot;
    signal input threshold;
    signal input nullifier;

    // Width used for the quantity comparison. Both operands are range-checked
    // below, which is what makes GreaterEqThan sound.
    var QUANTITY_BITS = 128;

    // ---------------------------------------------------------------------
    // Constraint 1: nullifier = Poseidon(spendKeyHash, tokenId)
    // Ties the attestation to one key/token pair so it cannot be replayed.
    // ---------------------------------------------------------------------
    component nullifierCheck = NullifierDerivation();
    nullifierCheck.spendKeyHash <== spendKeyHash;
    nullifierCheck.tokenId <== tokenId;
    nullifierCheck.out === nullifier;

    // ---------------------------------------------------------------------
    // Constraint 2: the (tokenId, quantity) commitment is in the tree.
    // ---------------------------------------------------------------------
    component leafHasher = Poseidon(2);
    leafHasher.inputs[0] <== tokenId;
    leafHasher.inputs[1] <== quantity;

    component merkleCheck = MerkleInclusion(merkleDepth);
    merkleCheck.leaf <== leafHasher.out;
    merkleCheck.root <== merkleRoot;
    for (var i = 0; i < merkleDepth; i++) {
        merkleCheck.pathElements[i] <== merklePathElements[i];
        merkleCheck.pathIndices[i] <== merklePathIndices[i];
    }

    // ---------------------------------------------------------------------
    // Constraint 3: quantity >= threshold
    //
    // Range-check both operands first. Without this, field wraparound lets a
    // prover satisfy the comparator with an out-of-range quantity.
    // ---------------------------------------------------------------------
    component quantityBits = Num2Bits(QUANTITY_BITS);
    quantityBits.in <== quantity;

    component thresholdBits = Num2Bits(QUANTITY_BITS);
    thresholdBits.in <== threshold;

    component atLeastThreshold = GreaterEqThan(QUANTITY_BITS);
    atLeastThreshold.in[0] <== quantity;
    atLeastThreshold.in[1] <== threshold;
    atLeastThreshold.out === 1;
}

component main {public [merkleRoot, threshold, nullifier]} = OwnershipProof(20);
