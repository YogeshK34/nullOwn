// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IGroth16Verifier
/// @notice Interface of the SnarkJS-generated Groth16 verifier.
/// @dev This signature is what `snarkjs zkey export solidityverifier` emits for
///      a circuit with three public signals. The generated contract itself is a
///      build artifact and is never hand-written — see `contracts/zk/README.md`.
interface IGroth16Verifier {
    /// @notice Verify a Groth16 proof over BN254 via the EIP-197 pairing precompile.
    /// @param _pA G1 point `A`.
    /// @param _pB G2 point `B`.
    /// @param _pC G1 point `C`.
    /// @param _pubSignals Public signals `[merkleRoot, threshold, nullifier]`.
    /// @return True when the pairing check succeeds.
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[3] calldata _pubSignals
    ) external view returns (bool);
}
