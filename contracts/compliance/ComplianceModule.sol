// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ComplianceModule
/// @notice Permissioned audit channel: regulators request scoped disclosure,
///         the protocol admin answers with data only the regulator can decrypt.
/// @dev The design separates *auditability* from *public transparency*. The fact
///      that an audit occurred is public and immutable; the disclosed data is
///      not. `encryptedResponse` is ciphertext produced off-chain against the
///      regulator's audit key — this contract never sees plaintext and never
///      holds a decryption key.
///
///      Audit records are append-only: there is no function that deletes or
///      rewrites an entry once written.
contract ComplianceModule is AccessControl {
    /// @notice Role permitted to open audit requests.
    bytes32 public constant REGULATOR_ROLE = keccak256("REGULATOR_ROLE");

    struct AuditRequest {
        address regulator;
        bytes32 scope; // jurisdiction or asset class identifier
        uint256 timestamp;
        bytes encryptedResponse;
        bool fulfilled;
    }

    /// @dev auditId => record. Ids are sequential starting at 0.
    mapping(uint256 auditId => AuditRequest request) public auditLog;

    /// @notice Number of audit requests ever opened.
    uint256 public auditCount;

    /// @notice Thrown when the referenced audit id was never opened.
    error UnknownAudit(uint256 auditId);

    /// @notice Thrown when attempting to fulfill an audit a second time.
    error AuditAlreadyFulfilled(uint256 auditId);

    /// @notice Thrown when fulfilling an audit with an empty payload.
    error EmptyResponse();

    /// @notice Emitted when a regulator opens an audit request.
    event AuditRequested(uint256 indexed auditId, address indexed regulator, bytes32 scope);

    /// @notice Emitted when the admin answers an audit request.
    event AuditFulfilled(uint256 indexed auditId, uint256 timestamp);

    /// @param admin Account granted `DEFAULT_ADMIN_ROLE`; it manages regulator roles.
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Open a scoped audit request. The request itself is public.
    /// @param scope Jurisdiction or asset-class identifier the audit covers.
    /// @return auditId Identifier of the newly created request.
    function requestAudit(bytes32 scope) external onlyRole(REGULATOR_ROLE) returns (uint256 auditId) {
        auditId = auditCount;
        unchecked {
            auditCount = auditId + 1;
        }

        auditLog[auditId] = AuditRequest({
            regulator: msg.sender,
            scope: scope,
            timestamp: block.timestamp,
            encryptedResponse: "",
            fulfilled: false
        });

        emit AuditRequested(auditId, msg.sender, scope);
    }

    /// @notice Answer an open audit request with ciphertext for the regulator.
    /// @param auditId The request being answered.
    /// @param encryptedData Ciphertext decryptable only with the regulator's audit key.
    function fulfillAudit(uint256 auditId, bytes calldata encryptedData)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (auditId >= auditCount) revert UnknownAudit(auditId);
        if (encryptedData.length == 0) revert EmptyResponse();

        AuditRequest storage request = auditLog[auditId];
        if (request.fulfilled) revert AuditAlreadyFulfilled(auditId);

        request.encryptedResponse = encryptedData;
        request.fulfilled = true;

        emit AuditFulfilled(auditId, block.timestamp);
    }

    /// @notice Read a full audit record, including any ciphertext response.
    /// @dev The response is publicly readable but useless without the audit key.
    /// @param auditId The request to read.
    /// @return The stored audit record.
    function getAudit(uint256 auditId) external view returns (AuditRequest memory) {
        if (auditId >= auditCount) revert UnknownAudit(auditId);
        return auditLog[auditId];
    }

    /// @notice Convenience check used by the frontend to gate the regulator view.
    /// @param account The account to test.
    /// @return True when `account` holds `REGULATOR_ROLE`.
    function isRegulator(address account) external view returns (bool) {
        return hasRole(REGULATOR_ROLE, account);
    }
}
