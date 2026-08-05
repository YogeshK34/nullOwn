pragma circom 2.0.0;

include "poseidon/poseidon.circom";

/*
 * OrderedPair
 * -----------
 * Orders two node hashes according to a single path bit, without branching.
 *
 *   selector = 0  ->  (left, right) = (current, sibling)
 *   selector = 1  ->  (left, right) = (sibling, current)
 *
 * `selector` is constrained to be boolean here rather than at the call site;
 * an unconstrained selector would let a prover mix the two orderings and forge
 * an inclusion path.
 */
template OrderedPair() {
    signal input current;
    signal input sibling;
    signal input selector;

    signal output left;
    signal output right;

    // Booleanity: selector ∈ {0, 1}.
    selector * (selector - 1) === 0;

    // Swap via linear interpolation. Written as one intermediate product so the
    // whole template stays at a single constraint beyond the boolean check.
    signal delta;
    delta <== (sibling - current) * selector;

    left <== current + delta;
    right <== sibling - delta;
}

/*
 * MerkleInclusion
 * ---------------
 * Proves that `leaf` sits at the position described by `pathIndices` in a
 * Poseidon Merkle tree whose root is `root`.
 *
 * Internal nodes are Poseidon(left, right). Depth is a template parameter so
 * the tree can be resized without touching the body.
 */
template MerkleInclusion(depth) {
    signal input leaf;
    signal input root;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    component ordering[depth];
    component hashers[depth];

    // Running hash, starting at the leaf and climbing one level per iteration.
    signal levels[depth + 1];
    levels[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        ordering[i] = OrderedPair();
        ordering[i].current <== levels[i];
        ordering[i].sibling <== pathElements[i];
        ordering[i].selector <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== ordering[i].left;
        hashers[i].inputs[1] <== ordering[i].right;

        levels[i + 1] <== hashers[i].out;
    }

    // The climb must land exactly on the advertised root.
    levels[depth] === root;
}
