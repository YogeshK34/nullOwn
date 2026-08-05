// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IStealthRegistry
/// @notice ERC-6538 style registry mapping an account to its stealth meta-address.
/// @dev A stealth meta-address is the concatenation of the registrant's spend
///      public key and view public key, both as 33-byte compressed secp256k1
///      points (66 bytes total). Senders read it to derive a one-time stealth
///      address for the registrant.
interface IStealthRegistry {
    /// @notice Register a stealth meta-address for `msg.sender`.
    /// @param stealthMetaAddress Encoded (spendPubKey, viewPubKey).
    function registerKeys(bytes calldata stealthMetaAddress) external;

    /// @notice Retrieve the registered stealth meta-address for a user.
    /// @param user The account whose meta-address is being looked up.
    /// @return The registered meta-address, or empty bytes if never registered.
    function getStealthMetaAddress(address user) external view returns (bytes memory);

    /// @notice Emitted whenever a registrant sets or replaces their meta-address.
    event StealthMetaAddressSet(address indexed registrant, bytes stealthMetaAddress);
}
