/** ABI for `contracts/stealth/ERC5564Announcer.sol`. */
export const stealthAnnouncerAbi = [
  {
    type: "function",
    name: "announce",
    stateMutability: "nonpayable",
    inputs: [
      { name: "schemeId", type: "uint256" },
      { name: "stealthAddress", type: "address" },
      { name: "ephemeralPubKey", type: "bytes" },
      { name: "metadata", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "EPHEMERAL_PUBKEY_LENGTH",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Announcement",
    inputs: [
      { name: "schemeId", type: "uint256", indexed: true },
      { name: "stealthAddress", type: "address", indexed: true },
      { name: "caller", type: "address", indexed: true },
      { name: "ephemeralPubKey", type: "bytes", indexed: false },
      { name: "metadata", type: "bytes", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "InvalidEphemeralPubKeyLength",
    inputs: [
      { name: "provided", type: "uint256" },
      { name: "expected", type: "uint256" },
    ],
  },
] as const;
