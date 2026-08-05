pragma circom 2.0.0;

include "poseidon/poseidon.circom";

/*
 * NullifierDerivation
 * -------------------
 * Binds a proof to one (spend key, token) pair exactly once.
 *
 *   nullifier = Poseidon(spendKeyHash, tokenId)
 *
 * The value is deterministic, so the same holder proving the same token always
 * produces the same nullifier — which is what lets `OwnershipVerifier` reject
 * replays. It is also one-way: observers learn nothing about `spendKeyHash` or
 * `tokenId` from seeing it on-chain.
 *
 * Note the privacy trade-off this implies: repeated attestations over the same
 * token are linkable to each other (though still not to any wallet). Attesting
 * the same holding twice therefore requires a fresh token or an epoch input.
 */
template NullifierDerivation() {
    signal input spendKeyHash;
    signal input tokenId;

    signal output out;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== spendKeyHash;
    hasher.inputs[1] <== tokenId;

    out <== hasher.out;
}
