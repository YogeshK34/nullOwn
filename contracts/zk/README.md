# `contracts/zk/`

## `Groth16Verifier.sol` is intentionally absent

This directory does **not** contain `Groth16Verifier.sol`, and it must never be
hand-written. The file is a build artifact emitted by SnarkJS from the compiled
proving key:

```bash
snarkjs zkey export solidityverifier \
  circuits/build/ownership_proof_final.zkey \
  contracts/zk/Groth16Verifier.sol
```

`scripts/setup-zkeys.ts` runs the full pipeline (compile → Powers of Tau →
Groth16 setup → contribute → export verifier + verification key) and drops the
file here.

Until that step is run, `scripts/deploy.ts` will stop with a clear error rather
than deploying a partial system.

## Why `OwnershipVerifier` is separate

The generated verifier is stateless — it only performs the BN254 pairing check
and returns a boolean. It cannot detect proof replay.

[`OwnershipVerifier.sol`](./OwnershipVerifier.sol) wraps it and adds the parts
the architecture requires:

- `mapping(bytes32 => bool) public usedNullifiers` with a revert on reuse
- the `VerifiedOwnership(nullifier, merkleRoot, timestamp)` event
- unpacking of the flattened `uint256[8]` proof into G1/G2 points

Regenerating the circuit therefore replaces `Groth16Verifier.sol` only;
`OwnershipVerifier.sol` is stable application code and is safe to edit.

## Proof encoding

`verifyOwnership` takes the proof flattened as:

```
[a[0], a[1], b[0][0], b[0][1], b[1][0], b[1][1], c[0], c[1]]
```

Note that SnarkJS emits G2 coordinates in reversed order relative to the raw
`pi_b` field. The frontend handles this in
`frontend/lib/zkProver.ts::formatProofForSolidity` — do not apply the swap twice.
