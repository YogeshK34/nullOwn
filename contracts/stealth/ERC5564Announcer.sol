// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IStealthAnnouncer} from "../interfaces/IStealthAnnouncer.sol";

/// @title ERC5564Announcer
/// @notice Stateless announcement channel for stealth transfers.
/// @dev Recipients cannot detect a stealth payment by watching their own
///      address — there is nothing linking it to them. Instead, senders publish
///      the ephemeral public key `R` here, and recipients scan these logs with
///      their private view key `v`, recomputing `S = v·R` to test each entry.
///
///      The contract deliberately holds no storage: announcements exist only as
///      logs. Anyone may announce, so consumers must treat entries as untrusted
///      and confirm the corresponding asset transfer independently.
contract ERC5564Announcer is IStealthAnnouncer {
    /// @notice Compressed secp256k1 public keys are 33 bytes.
    uint256 public constant EPHEMERAL_PUBKEY_LENGTH = 33;

    /// @notice Thrown when the ephemeral public key is not a compressed point.
    error InvalidEphemeralPubKeyLength(uint256 provided, uint256 expected);

    /// @inheritdoc IStealthAnnouncer
    function announce(
        uint256 schemeId,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes calldata metadata
    ) external {
        if (ephemeralPubKey.length != EPHEMERAL_PUBKEY_LENGTH) {
            revert InvalidEphemeralPubKeyLength(ephemeralPubKey.length, EPHEMERAL_PUBKEY_LENGTH);
        }

        emit Announcement(schemeId, stealthAddress, msg.sender, ephemeralPubKey, metadata);
    }
}
