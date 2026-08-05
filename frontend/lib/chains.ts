import { defineChain } from "viem";
import { sepolia } from "viem/chains";

/**
 * Networks NullOwn targets, per ARCHITECTURE.md §6 (testnet only).
 *
 * Mumbai is declared locally rather than imported from `viem/chains`: Polygon
 * shut the network down in April 2024 and viem has been phasing the export out,
 * so importing it couples this build to a deprecation timeline. The definition
 * below is small and keeps the chain list stable either way.
 */
export const polygonMumbai = defineChain({
  id: 80001,
  name: "Polygon Mumbai",
  nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-mumbai.maticvigil.com"] },
  },
  blockExplorers: {
    default: { name: "PolygonScan", url: "https://mumbai.polygonscan.com" },
  },
  testnet: true,
});

export const supportedChains = [sepolia, polygonMumbai] as const;

export type SupportedChainId = (typeof supportedChains)[number]["id"];

/** Chain metadata for a configured id, if it is one we support. */
export function chainById(id: number) {
  return supportedChains.find((chain) => chain.id === id);
}

/** Display name for a chain id, falling back to the raw id. */
export function chainName(id: number): string {
  return chainById(id)?.name ?? `Chain ${id}`;
}

/** Public RPC endpoint for a chain id; used when NEXT_PUBLIC_RPC_URL is unset. */
export function defaultRpcUrl(id: number): string {
  const chain = chainById(id);
  const url = chain?.rpcUrls.default.http[0];
  if (!url) {
    throw new Error(
      `No RPC endpoint for chain ${id}. Set NEXT_PUBLIC_RPC_URL or pick a supported chain.`,
    );
  }
  return url;
}

/** Explorer link for a transaction hash, when the chain publishes one. */
export function explorerTxUrl(id: number, hash: string): string | undefined {
  const base = chainById(id)?.blockExplorers?.default.url;
  return base ? `${base}/tx/${hash}` : undefined;
}

/** Explorer link for an address, when the chain publishes one. */
export function explorerAddressUrl(id: number, address: string): string | undefined {
  const base = chainById(id)?.blockExplorers?.default.url;
  return base ? `${base}/address/${address}` : undefined;
}
