/**
 * ABI for `contracts/compliance/ComplianceModule.sol`.
 *
 * Note the difference between the two read paths: Solidity's auto-generated
 * getter for `auditLog` omits `encryptedResponse`, because struct getters skip
 * array-typed members (`bytes` counts as one). Use `getAudit` whenever the
 * ciphertext is needed.
 */
export const complianceModuleAbi = [
  {
    type: "constructor",
    stateMutability: "nonpayable",
    inputs: [{ name: "admin", type: "address" }],
  },
  {
    type: "function",
    name: "requestAudit",
    stateMutability: "nonpayable",
    inputs: [{ name: "scope", type: "bytes32" }],
    outputs: [{ name: "auditId", type: "uint256" }],
  },
  {
    type: "function",
    name: "fulfillAudit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "auditId", type: "uint256" },
      { name: "encryptedData", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getAudit",
    stateMutability: "view",
    inputs: [{ name: "auditId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "regulator", type: "address" },
          { name: "scope", type: "bytes32" },
          { name: "timestamp", type: "uint256" },
          { name: "encryptedResponse", type: "bytes" },
          { name: "fulfilled", type: "bool" },
        ],
      },
    ],
  },
  {
    // Auto-generated mapping getter — no `encryptedResponse`.
    type: "function",
    name: "auditLog",
    stateMutability: "view",
    inputs: [{ name: "auditId", type: "uint256" }],
    outputs: [
      { name: "regulator", type: "address" },
      { name: "scope", type: "bytes32" },
      { name: "timestamp", type: "uint256" },
      { name: "fulfilled", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "auditCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isRegulator",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "grantRole",
    stateMutability: "nonpayable",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeRole",
    stateMutability: "nonpayable",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "REGULATOR_ROLE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "DEFAULT_ADMIN_ROLE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "event",
    name: "AuditRequested",
    inputs: [
      { name: "auditId", type: "uint256", indexed: true },
      { name: "regulator", type: "address", indexed: true },
      { name: "scope", type: "bytes32", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "AuditFulfilled",
    inputs: [
      { name: "auditId", type: "uint256", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RoleGranted",
    inputs: [
      { name: "role", type: "bytes32", indexed: true },
      { name: "account", type: "address", indexed: true },
      { name: "sender", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RoleRevoked",
    inputs: [
      { name: "role", type: "bytes32", indexed: true },
      { name: "account", type: "address", indexed: true },
      { name: "sender", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "UnknownAudit",
    inputs: [{ name: "auditId", type: "uint256" }],
  },
  {
    type: "error",
    name: "AuditAlreadyFulfilled",
    inputs: [{ name: "auditId", type: "uint256" }],
  },
  { type: "error", name: "EmptyResponse", inputs: [] },
] as const;
