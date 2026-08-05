// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IStealthRegistry} from "../interfaces/IStealthRegistry.sol";

/// @title ERC6538Registry
/// @notice Public directory of stealth meta-addresses.
/// @dev Senders look up a recipient here before computing a one-time stealth
///      address. Registration is permissionless and self-sovereign: only the
///      account itself can set its own entry.
///
///      A meta-address is `spendPubKey (33 bytes) || viewPubKey (33 bytes)`,
///      each a compressed secp256k1 point. Only the length is validated
///      on-chain; point validity is checked client-side during derivation,
///      since a malformed entry can only harm the registrant.
contract ERC6538Registry is IStealthRegistry {
    /// @notice Expected byte length of a meta-address (two compressed points).
    uint256 public constant META_ADDRESS_LENGTH = 66;

    /// @dev registrant => encoded stealth meta-address.
    mapping(address registrant => bytes metaAddress) private _stealthMetaAddresses;

    /// @notice Thrown when the supplied meta-address is not `META_ADDRESS_LENGTH` bytes.
    error InvalidMetaAddressLength(uint256 provided, uint256 expected);

    /// @inheritdoc IStealthRegistry
    function registerKeys(bytes calldata stealthMetaAddress) external {
        if (stealthMetaAddress.length != META_ADDRESS_LENGTH) {
            revert InvalidMetaAddressLength(stealthMetaAddress.length, META_ADDRESS_LENGTH);
        }

        _stealthMetaAddresses[msg.sender] = stealthMetaAddress;
        emit StealthMetaAddressSet(msg.sender, stealthMetaAddress);
    }

    /// @inheritdoc IStealthRegistry
    function getStealthMetaAddress(address user) external view returns (bytes memory) {
        return _stealthMetaAddresses[user];
    }

    /// @notice Whether `user` has published a stealth meta-address.
    /// @param user The account to check.
    /// @return True when a meta-address is on file.
    function isRegistered(address user) external view returns (bool) {
        return _stealthMetaAddresses[user].length == META_ADDRESS_LENGTH;
    }
}
