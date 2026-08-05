import type { Address } from "viem";

/**
 * Typed access to the `NEXT_PUBLIC_*` configuration.
 *
 * Every `process.env` lookup below is written as a literal member expression
 * because Next.js inlines these at build time by textual substitution — a
 * computed lookup like `process.env[name]` silently yields `undefined` in the
 * browser bundle.
 *
 * Nothing here is required for the app to boot. Contracts are optional so the
 * UI can render an explicit "not deployed" state instead of crashing, which is
 * the situation on a fresh clone before `npm run deploy:sepolia`.
 */

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/** Returns the value only when it is a syntactically valid, non-zero address. */
function readAddress(raw: string | undefined): Address | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!ADDRESS_PATTERN.test(trimmed)) return undefined;
  if (/^0x0{40}$/.test(trimmed)) return undefined;
  return trimmed as Address;
}

function readInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Contract names the UI can gate on. */
export type ContractName =
  | "stealthRegistry"
  | "stealthAnnouncer"
  | "ownershipVerifier"
  | "complianceModule";

export const contractAddresses: Record<ContractName, Address | undefined> = {
  stealthRegistry: readAddress(process.env.NEXT_PUBLIC_ERC6538_ADDRESS),
  stealthAnnouncer: readAddress(process.env.NEXT_PUBLIC_ERC5564_ADDRESS),
  ownershipVerifier: readAddress(process.env.NEXT_PUBLIC_VERIFIER_ADDRESS),
  complianceModule: readAddress(process.env.NEXT_PUBLIC_COMPLIANCE_ADDRESS),
};

/** Sepolia unless told otherwise; Mumbai is 80001. */
export const chainId = readInt(process.env.NEXT_PUBLIC_CHAIN_ID, 11155111);

/**
 * Block to begin announcement scanning from. Public RPC providers reject
 * `fromBlock: 0` range queries, so this should be the announcer's deployment
 * block — `scripts/deploy.ts` prints the correct value.
 */
export const announcementStartBlock = BigInt(
  readInt(process.env.NEXT_PUBLIC_ANNOUNCEMENT_START_BLOCK, 0),
);

/** Optional RPC override for read paths; falls back to the chain's public RPC. */
export const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL?.trim() || undefined;

/** WalletConnect Cloud project id. RainbowKit requires one for its wallet list. */
export const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || undefined;

/** Whether a given contract has a usable address configured. */
export function isContractConfigured(name: ContractName): boolean {
  return contractAddresses[name] !== undefined;
}

/** Contracts still missing an address, for a single consolidated warning. */
export function missingContracts(): ContractName[] {
  return (Object.keys(contractAddresses) as ContractName[]).filter(
    (name) => contractAddresses[name] === undefined,
  );
}

/**
 * Reads an address or throws. Use inside hooks/services that have already
 * gated on `isContractConfigured`, so the throw signals a real bug.
 */
export function requireContract(name: ContractName): Address {
  const address = contractAddresses[name];
  if (!address) {
    throw new Error(
      `${name} address is not configured. Set the matching NEXT_PUBLIC_* variable — see .env.example.`,
    );
  }
  return address;
}

/** Human-readable labels used by the configuration banner. */
export const contractEnvVarNames: Record<ContractName, string> = {
  stealthRegistry: "NEXT_PUBLIC_ERC6538_ADDRESS",
  stealthAnnouncer: "NEXT_PUBLIC_ERC5564_ADDRESS",
  ownershipVerifier: "NEXT_PUBLIC_VERIFIER_ADDRESS",
  complianceModule: "NEXT_PUBLIC_COMPLIANCE_ADDRESS",
};
