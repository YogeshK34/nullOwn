/**
 * ABI for `contracts/stealth/ERC6538Registry.sol`.
 *
 * Declared with `as const` so viem/wagmi can infer argument and return types.
 * A plain JSON import would widen to `string`/`any` and lose that.
 */
export const stealthRegistryAbi = [
  {
    type: "function",
    name: "registerKeys",
    stateMutability: "nonpayable",
    inputs: [{ name: "stealthMetaAddress", type: "bytes" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getStealthMetaAddress",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    type: "function",
    name: "isRegistered",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "META_ADDRESS_LENGTH",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "StealthMetaAddressSet",
    inputs: [
      { name: "registrant", type: "address", indexed: true },
      { name: "stealthMetaAddress", type: "bytes", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "InvalidMetaAddressLength",
    inputs: [
      { name: "provided", type: "uint256" },
      { name: "expected", type: "uint256" },
    ],
  },
] as const;
