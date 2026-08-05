// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IStealthAnnouncer
/// @notice ERC-5564 style announcement channel for stealth transfers.
/// @dev The announcer stores no state. It exists purely to emit a log that
///      recipients scan with their private view key to discover payments.
interface IStealthAnnouncer {
    /// @notice Emit an announcement after a stealth transfer.
    /// @param schemeId Stealth address scheme identifier (0 = secp256k1 + view tags).
    /// @param stealthAddress The one-time stealth address the asset was sent to.
    /// @param ephemeralPubKey Sender's ephemeral public key `R`, compressed (33 bytes).
    /// @param metadata Optional payload; by convention byte 0 is the view tag.
    function announce(
        uint256 schemeId,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes calldata metadata
    ) external;

    /// @notice Emitted for every stealth transfer announcement.
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );
}
