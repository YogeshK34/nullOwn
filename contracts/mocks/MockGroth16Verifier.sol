// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGroth16Verifier} from "../interfaces/IGroth16Verifier.sol";

/// @title MockGroth16Verifier
/// @notice TEST ONLY. Never deploy this to a public network.
/// @dev `OwnershipVerifier`'s replay protection has to be testable without the
///      generated verifier, which does not exist until the circuit is compiled.
///      This double lets a test drive the pairing result directly.
///
///      It performs no cryptography whatsoever. `scripts/deploy.ts` refuses to
///      deploy it, and it is excluded from every deployment path.
contract MockGroth16Verifier is IGroth16Verifier {
    /// @notice Result that `verifyProof` will return.
    bool public result = true;

    /// @notice Set the value `verifyProof` returns.
    /// @param result_ The desired pairing outcome.
    function setResult(bool result_) external {
        result = result_;
    }

    /// @inheritdoc IGroth16Verifier
    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[3] calldata
    ) external view returns (bool) {
        return result;
    }
}
