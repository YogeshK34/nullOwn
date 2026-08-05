"use client";

import { useAccount } from "wagmi";
import { ExternalLink, UploadCloud } from "lucide-react";

import { useStealthRegistry } from "@/hooks/useStealthRegistry";
import type { StealthMetaAddress } from "@/lib/stealth";
import { chainId } from "@/lib/env";
import { explorerTxUrl } from "@/lib/chains";
import {
  ActionButton,
  DataRow,
  Notice,
  Panel,
  StatusPill,
} from "@/components/app/panel";

/**
 * Publishes the local meta-address to the ERC-6538 registry.
 *
 * Registration is what makes a user payable — a sender cannot derive a stealth
 * address without it. Rotating keys means re-registering, and the panel
 * highlights when the on-chain entry has drifted from the local one.
 */
export function RegistryPanel({ metaAddress }: { metaAddress: StealthMetaAddress | undefined }) {
  const { isConnected } = useAccount();
  const {
    registered,
    decodeError,
    isLoading,
    isRegistered,
    readError,
    register,
    isRegistering,
    isConfirming,
    isConfirmed,
    txHash,
    writeError,
    isConfigured,
  } = useStealthRegistry();

  const matchesLocal =
    registered !== undefined &&
    metaAddress !== undefined &&
    registered.encoded.toLowerCase() === metaAddress.encoded.toLowerCase();

  return (
    <Panel
      title="Meta-Address Registry"
      description="ERC-6538. Publishing your spend and view public keys lets anyone pay you privately without a prior handshake. The keys are public by design — only the private halves matter."
      action={
        isLoading ? (
          <StatusPill>Reading…</StatusPill>
        ) : matchesLocal ? (
          <StatusPill tone="success">Registered</StatusPill>
        ) : isRegistered ? (
          <StatusPill tone="warning">Stale entry</StatusPill>
        ) : (
          <StatusPill>Not registered</StatusPill>
        )
      }
    >
      {!isConfigured && (
        <Notice tone="warning">
          Registry address is unset. Set NEXT_PUBLIC_ERC6538_ADDRESS to enable registration.
        </Notice>
      )}

      {!isConnected && isConfigured && (
        <Notice tone="info">Connect a wallet to read or update your registry entry.</Notice>
      )}

      {decodeError && (
        <Notice tone="danger" title="Registry entry is unreadable">
          {decodeError} Re-register to replace it.
        </Notice>
      )}

      {readError && <Notice tone="danger">{readError.message}</Notice>}

      {registered && (
        <div className="flex flex-col">
          <DataRow label="On-chain spend key" value={registered.spendPublicKey} copyable />
          <DataRow label="On-chain view key" value={registered.viewPublicKey} copyable />
        </div>
      )}

      {isRegistered && metaAddress && !matchesLocal && (
        <Notice tone="warning" title="On-chain keys differ from your local keys">
          Payments derived from the registered entry will not be detectable with the keys currently
          loaded. Register the local meta-address to fix this, or unlock the matching keystore.
        </Notice>
      )}

      {!metaAddress && (
        <Notice tone="info">Generate or unlock stealth keys before registering.</Notice>
      )}

      {writeError && (
        <Notice tone="danger" title="Transaction failed">
          {writeError.message}
        </Notice>
      )}

      {isConfirmed && txHash && (
        <Notice tone="success" title="Meta-address registered">
          <TxLink hash={txHash} />
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <ActionButton
          onClick={() => metaAddress && register(metaAddress.encoded)}
          busy={isRegistering || isConfirming}
          disabled={!isConfigured || !isConnected || !metaAddress || matchesLocal}
        >
          <UploadCloud className="h-4 w-4" />
          {isRegistering
            ? "Confirm in wallet…"
            : isConfirming
              ? "Waiting for confirmation…"
              : isRegistered
                ? "Update Registration"
                : "Register Meta-Address"}
        </ActionButton>

        {matchesLocal && (
          <span className="text-xs text-zinc-500">
            Your on-chain entry already matches the loaded keys.
          </span>
        )}
      </div>
    </Panel>
  );
}

function TxLink({ hash }: { hash: string }) {
  const url = explorerTxUrl(chainId, hash);
  if (!url) return <span className="font-mono text-xs">{hash}</span>;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 font-mono text-xs underline underline-offset-2"
    >
      {hash.slice(0, 18)}…
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
