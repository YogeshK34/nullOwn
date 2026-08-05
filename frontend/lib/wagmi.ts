"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";

import { supportedChains } from "./chains";
import { walletConnectProjectId } from "./env";
import { createCookieStorage, transports } from "./wagmi-config";

/**
 * Client-side wagmi + RainbowKit configuration.
 *
 * `getDefaultConfig` is a client-only export, so this module is marked
 * "use client" and the root layout uses `getServerConfig` from
 * `lib/wagmi-config.ts` instead. Chains, transports and storage come from that
 * shared module so both halves agree — a mismatch means the connection cookie
 * written in the browser fails to deserialise during SSR.
 *
 * Built through a factory rather than a module-level constant so the server and
 * the client each construct their own instance; sharing one across requests
 * would leak connection state between users.
 */

/**
 * WalletConnect requires a project id. Without one the injected/browser wallet
 * path still works, so the app degrades rather than failing to boot — the UI
 * surfaces the missing id instead.
 */
const PLACEHOLDER_PROJECT_ID = "00000000000000000000000000000000";

export function getConfig() {
  return getDefaultConfig({
    appName: "NullOwn",
    appDescription: "Privacy layer for tokenized real-world assets.",
    projectId: walletConnectProjectId ?? PLACEHOLDER_PROJECT_ID,
    chains: supportedChains,

    // The wallet list is stated explicitly rather than taking RainbowKit's
    // default. The default includes the Base wallet, which drags in
    // @base-org/account -> @coinbase/cdp-sdk -> optional @x402/* Solana
    // packages that are not installed and break the client bundle. None of
    // that is relevant to an EVM testnet privacy layer.
    wallets: [
      {
        groupName: "Popular",
        wallets: [
          injectedWallet,
          metaMaskWallet,
          rainbowWallet,
          walletConnectWallet,
          safeWallet,
        ],
      },
    ],

    ssr: true,
    storage: createCookieStorage(),
    transports,
  });
}

export type NullOwnConfig = ReturnType<typeof getConfig>;

/** True when WalletConnect is usable; false means injected wallets only. */
export const hasWalletConnectProjectId = walletConnectProjectId !== undefined;
