"use client";

import { useEffect } from "react";
import { useAccount, useConnect } from "wagmi";

/**
 * Connects the demo wallet on mount.
 *
 * Rendered only in demo mode, and only for its effect. Relying on wagmi's
 * reconnect-on-mount is not enough: reconnect consults `recentConnectorId` from
 * storage, which is empty on a first visit, so the mock connector would sit
 * unconnected and every page would show "connect a wallet to continue" — the
 * one thing demo mode exists to avoid. Connecting explicitly is deterministic
 * and idempotent.
 */
export function DemoAutoConnect() {
  const { isConnected, isConnecting, isReconnecting } = useAccount();
  const { connect, connectors } = useConnect();

  useEffect(() => {
    if (isConnected || isConnecting || isReconnecting) return;

    const demoConnector = connectors.find(
      (connector) => connector.id === "mock" || connector.name === "Demo Wallet",
    );
    if (demoConnector) connect({ connector: demoConnector });
  }, [connect, connectors, isConnected, isConnecting, isReconnecting]);

  return null;
}
