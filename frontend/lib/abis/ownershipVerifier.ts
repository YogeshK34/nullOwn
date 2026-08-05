/** ABI for `contracts/zk/OwnershipVerifier.sol`. */
export const ownershipVerifierAbi = [
  {
    type: "constructor",
    stateMutability: "nonpayable",
    inputs: [{ name: "groth16Verifier_", type: "address" }],
  },
  {
    type: "function",
    name: "verifyOwnership",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proof", type: "uint256[8]" },
      { name: "pubSignals", type: "uint256[3]" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "usedNullifiers",
    stateMutability: "view",
    inputs: [{ name: "nullifier", type: "bytes32" }],
    outputs: [{ name: "used", type: "bool" }],
  },
  {
    type: "function",
    name: "isNullifierUsed",
    stateMutability: "view",
    inputs: [{ name: "nullifier", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "verifiedCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "groth16Verifier",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    name: "VerifiedOwnership",
    inputs: [
      { name: "nullifier", type: "bytes32", indexed: true },
      { name: "merkleRoot", type: "bytes32", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  { type: "error", name: "ZeroVerifierAddress", inputs: [] },
  { type: "error", name: "InvalidProof", inputs: [] },
  {
    type: "error",
    name: "NullifierAlreadyUsed",
    inputs: [{ name: "nullifier", type: "bytes32" }],
  },
] as const;
