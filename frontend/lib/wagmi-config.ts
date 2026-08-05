import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { sepolia } from "viem/chains";

import { supportedChains, polygonMumbai } from "./chains";
import { chainId, rpcUrl } from "./env";

/**
 * Server-safe wagmi configuration.
 *
 * This file must never import from `@rainbow-me/rainbowkit`. RainbowKit's
 * `getDefaultConfig` is a client-only export, and the root layout — a Server
 * Component — needs a `Config` to hand to `cookieToInitialState`. Calling the
 * client version there fails the build with "Attempted to call
 * getDefaultConfig() from the server".
 *
 * The two configs must agree on chains, transports and storage, or the cookie
 * written by the browser will not deserialise on the server. Those three values
 * are defined here once and imported by `lib/wagmi.ts` for the client config.
 */

export const transports = {
  // Only the configured chain honours NEXT_PUBLIC_RPC_URL; the other falls
  // back to its public endpoint.
  [sepolia.id]: http(chainId === sepolia.id ? rpcUrl : undefined),
  [polygonMumbai.id]: http(chainId === polygonMumbai.id ? rpcUrl : undefined),
} as const;

/** Cookie-backed storage — the mechanism that carries state across SSR. */
export function createCookieStorage() {
  return createStorage({ storage: cookieStorage });
}

/**
 * Minimal config used solely to deserialise the wagmi cookie during SSR.
 * The connector list is irrelevant here; only chains and storage matter.
 */
export function getServerConfig() {
  return createConfig({
    chains: supportedChains,
    ssr: true,
    storage: createCookieStorage(),
    transports,
  });
}
