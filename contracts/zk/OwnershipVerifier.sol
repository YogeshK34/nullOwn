// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IOwnershipVerifier} from "../interfaces/IOwnershipVerifier.sol";
import {IGroth16Verifier} from "../interfaces/IGroth16Verifier.sol";

/// @title OwnershipVerifier
/// @notice Accepts ZK ownership attestations and enforces single-use nullifiers.
/// @dev This is the contract users interact with. It wraps the SnarkJS-generated
///      `Groth16Verifier`, which performs the raw BN254 pairing check but is
///      stateless and therefore cannot prevent proof replay on its own.
///
///      Nothing about the prover is revealed: `msg.sender` is not recorded, and
///      the only public signals are the Merkle root, the threshold being
///      attested, and the nullifier.
contract OwnershipVerifier is IOwnershipVerifier {
    /// @notice The SnarkJS-generated pairing verifier for `ownership_proof.circom`.
    IGroth16Verifier public immutable groth16Verifier;

    /// @notice Nullifiers already consumed, preventing proof replay.
    mapping(bytes32 nullifier => bool used) public usedNullifiers;

    /// @notice Total number of accepted attestations.
    uint256 public verifiedCount;

    /// @notice Thrown when the verifier address supplied at deployment is zero.
    error ZeroVerifierAddress();

    /// @notice Thrown when a nullifier has already been consumed.
    error NullifierAlreadyUsed(bytes32 nullifier);

    /// @notice Thrown when the Groth16 pairing check fails.
    error InvalidProof();

    /// @param groth16Verifier_ Address of the deployed generated Groth16 verifier.
    constructor(address groth16Verifier_) {
        if (groth16Verifier_ == address(0)) revert ZeroVerifierAddress();
        groth16Verifier = IGroth16Verifier(groth16Verifier_);
    }

    /// @inheritdoc IOwnershipVerifier
    function verifyOwnership(
        uint256[8] calldata proof,
        uint256[3] calldata pubSignals
    ) external returns (bool) {
        // pubSignals layout is fixed by the circuit: [merkleRoot, threshold, nullifier].
        bytes32 nullifier = bytes32(pubSignals[2]);
        if (usedNullifiers[nullifier]) revert NullifierAlreadyUsed(nullifier);

        // Unpack the flattened proof into the G1/G2 point shape the generated
        // verifier expects. The caller is responsible for supplying G2
        // coordinates in the order SnarkJS emits them.
        bool ok = groth16Verifier.verifyProof(
            [proof[0], proof[1]],
            [[proof[2], proof[3]], [proof[4], proof[5]]],
            [proof[6], proof[7]],
            pubSignals
        );
        if (!ok) revert InvalidProof();

        // Consume the nullifier only after the proof is known to be valid, so a
        // failed submission cannot burn a legitimate one.
        usedNullifiers[nullifier] = true;
        unchecked {
            ++verifiedCount;
        }

        emit VerifiedOwnership(nullifier, bytes32(pubSignals[0]), block.timestamp);
        return true;
    }

    /// @notice Check whether a nullifier has already been consumed.
    /// @param nullifier The nullifier to test.
    /// @return True when the nullifier can no longer be used.
    function isNullifierUsed(bytes32 nullifier) external view returns (bool) {
        return usedNullifiers[nullifier];
    }
}
