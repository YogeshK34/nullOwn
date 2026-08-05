// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IOwnershipVerifier
/// @notice On-chain entry point for ZK ownership attestations.
/// @dev Public signal ordering is fixed by the circuit's `main` component:
///      `[merkleRoot, threshold, nullifier]`.
interface IOwnershipVerifier {
    /// @notice Submit a ZK ownership proof for on-chain verification.
    /// @param proof Groth16 proof flattened as
    ///        `[a[0], a[1], b[0][0], b[0][1], b[1][0], b[1][1], c[0], c[1]]`.
    /// @param pubSignals Public signals `[merkleRoot, threshold, nullifier]`.
    /// @return True when the proof verifies and the nullifier was unused.
    function verifyOwnership(
        uint256[8] calldata proof,
        uint256[3] calldata pubSignals
    ) external returns (bool);

    /// @notice Emitted once per accepted, non-replayed ownership proof.
    event VerifiedOwnership(
        bytes32 indexed nullifier,
        bytes32 indexed merkleRoot,
        uint256 timestamp
    );
}
