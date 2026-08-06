"use client";

import type { Wallet } from "@rainbow-me/rainbowkit";
import { createConnector } from "wagmi";
import { mock } from "wagmi/connectors";

import { DEMO_ACCOUNT } from "./demo";

/**
 * A wallet that is always connected, for demo mode.
 *
 * The pages gate real actions on `useAccount().isConnected`, so a demo with no
 * wallet installed shows "connect a wallet to continue" on every panel. Rather
 * than special-casing that check in a dozen components, demo mode registers
 * wagmi's `mock` connector as a RainbowKit wallet: `useAccount` then reports a
 * connected account through the ordinary code path and nothing downstream knows
 * the difference.
 *
 * `defaultConnected` plus `reconnect` is what makes it connect by itself —
 * wagmi's reconnect-on-mount asks each connector whether it is authorised, and
 * this one says yes.
 *
 * The connector can sign nothing and send nothing. That is fine: in demo mode
 * every write path is intercepted before it reaches wagmi.
 */

/** Amber shield, inlined so the icon needs no network request. */
const DEMO_WALLET_ICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
      'stroke="#18181b" stroke-width="2" stroke-linecap="square">' +
      '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>' +
      '<path d="M9 12l2 2 4-4"/></svg>',
  );

export function demoWallet(): Wallet {
  return {
    id: "nullown-demo",
    name: "Demo Wallet",
    shortName: "Demo",
    iconUrl: DEMO_WALLET_ICON,
    iconBackground: "#f59e0b",
    installed: true,
    createConnector: (walletDetails) =>
      createConnector((config) => ({
        ...mock({
          accounts: [DEMO_ACCOUNT],
          features: { defaultConnected: true, reconnect: true },
        })(config),
        ...walletDetails,
      })),
  };
}
