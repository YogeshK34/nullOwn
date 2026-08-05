"use client";

import { useAccount, useChainId } from "wagmi";
import { AlertTriangle } from "lucide-react";

import { chainName } from "@/lib/chains";
import { chainId as configuredChainId, contractEnvVarNames, missingContracts } from "@/lib/env";
import { hasWalletConnectProjectId } from "@/lib/wagmi";
import { Notice } from "./panel";

/**
 * Surfaces configuration gaps up front.
 *
 * On a fresh clone none of the contracts are deployed, so most actions cannot
 * work. Saying so plainly beats letting each button fail with an opaque RPC
 * error — and it points at the exact environment variable to set.
 */
export function ConfigBanner() {
  const { isConnected } = useAccount();
  const connectedChainId = useChainId();

  const missing = missingContracts();
  const wrongNetwork = isConnected && connectedChainId !== configuredChainId;

  if (missing.length === 0 && !wrongNetwork && hasWalletConnectProjectId) return null;

  return (
    <div className="mb-8 flex flex-col gap-3">
      {missing.length > 0 && (
        <Notice tone="warning" title="Contracts are not configured">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {missing.length} of 4 contract addresses are unset, so the matching actions are
              disabled. Deploy with{" "}
              <code className="font-mono text-amber-300">npm run deploy:sepolia</code>, then set{" "}
              {missing.map((name, index) => (
                <span key={name}>
                  <code className="font-mono text-amber-300">{contractEnvVarNames[name]}</code>
                  {index < missing.length - 1 ? ", " : ""}
                </span>
              ))}{" "}
              in <code className="font-mono text-amber-300">frontend/.env.local</code>.
            </span>
          </span>
        </Notice>
      )}

      {wrongNetwork && (
        <Notice tone="danger" title="Wrong network">
          Your wallet is on {chainName(connectedChainId)}, but NullOwn is configured for{" "}
          {chainName(configuredChainId)}. Switch networks to interact with the contracts.
        </Notice>
      )}

      {!hasWalletConnectProjectId && (
        <Notice tone="info" title="WalletConnect is not configured">
          Browser-extension wallets still work. To enable WalletConnect, set{" "}
          <code className="font-mono">NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code> — get an id from
          cloud.walletconnect.com.
        </Notice>
      )}
    </div>
  );
}
