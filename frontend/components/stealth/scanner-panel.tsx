"use client";

import { useState } from "react";
import { Eye, Radar, Square } from "lucide-react";

import { useAnnouncementScanner, type DiscoveredAsset } from "@/hooks/useAnnouncementScanner";
import type { StealthKeys } from "@/lib/stealth";
import { stealthPrivateKeyMatches } from "@/lib/stealth";
import { announcementStartBlock, chainId } from "@/lib/env";
import { explorerAddressUrl } from "@/lib/chains";
import {
  ActionButton,
  CopyableValue,
  DataRow,
  Notice,
  Panel,
  PanelDivider,
  StatusPill,
} from "@/components/app/panel";

/**
 * Scans ERC-5564 announcements for payments belonging to the loaded keys.
 *
 * The scan itself needs only the view key. The spend key is touched exactly
 * once — when the user explicitly asks to reveal the key controlling a
 * discovered address — and the derived key is verified against that address
 * before being shown.
 */
export function ScannerPanel({ keys }: { keys: StealthKeys | undefined }) {
  const { discovered, isScanning, progress, error, scan, cancel, reset, revealPrivateKey, isConfigured } =
    useAnnouncementScanner();

  return (
    <Panel
      title="Announcement Scanner"
      description="There is no way to query “payments to me” — that is the point. Every announcement is tested locally against your view key, with a one-byte view tag rejecting the vast majority before any real work."
      action={
        isScanning ? (
          <StatusPill tone="info">Scanning…</StatusPill>
        ) : discovered.length > 0 ? (
          <StatusPill tone="success">
            {discovered.length} found
          </StatusPill>
        ) : (
          <StatusPill>Idle</StatusPill>
        )
      }
    >
      {!isConfigured && (
        <Notice tone="warning">
          Announcer address is unset. Set NEXT_PUBLIC_ERC5564_ADDRESS to enable scanning.
        </Notice>
      )}

      {!keys && <Notice tone="info">Unlock your stealth keys to scan.</Notice>}

      {error && <Notice tone="danger">{error}</Notice>}

      {announcementStartBlock === 0n && isConfigured && (
        <Notice tone="info">
          Scanning from block 0. On a public testnet this will be slow and many RPC providers reject
          wide ranges — set NEXT_PUBLIC_ANNOUNCEMENT_START_BLOCK to the announcer&apos;s deployment
          block.
        </Notice>
      )}

      <div className="flex flex-wrap gap-3">
        <ActionButton
          onClick={() => keys && void scan(keys)}
          busy={isScanning}
          disabled={!isConfigured || !keys || isScanning}
        >
          <Radar className="h-4 w-4" />
          {isScanning ? "Scanning…" : "Scan Announcements"}
        </ActionButton>

        {isScanning && (
          <ActionButton variant="secondary" onClick={cancel}>
            <Square className="h-4 w-4" />
            Stop
          </ActionButton>
        )}

        {!isScanning && discovered.length > 0 && (
          <ActionButton variant="secondary" onClick={reset}>
            Clear Results
          </ActionButton>
        )}
      </div>

      {progress && (
        <div className="flex flex-col gap-2">
          <div className="h-1 w-full bg-white/10">
            <div
              className="h-full bg-amber-500/80 transition-all duration-300"
              style={{ width: `${Math.min(100, progress.percent)}%` }}
            />
          </div>
          <p className="font-mono text-xs text-zinc-500">
            block {progress.currentBlock.toString()} / {progress.toBlock.toString()} ·{" "}
            {progress.announcementsSeen} announcements examined
          </p>
        </div>
      )}

      {!isScanning && progress && discovered.length === 0 && (
        <Notice tone="neutral">
          No payments to these keys in the scanned range. That is the expected result unless someone
          has sent to your registered meta-address.
        </Notice>
      )}

      {discovered.length > 0 && (
        <div className="flex flex-col gap-4">
          <PanelDivider label={`Discovered (${discovered.length})`} />
          {discovered.map((asset) => (
            <DiscoveredAssetCard
              key={`${asset.txHash}-${asset.stealthAddress}`}
              asset={asset}
              keys={keys}
              reveal={revealPrivateKey}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function DiscoveredAssetCard({
  asset,
  keys,
  reveal,
}: {
  asset: DiscoveredAsset;
  keys: StealthKeys | undefined;
  reveal: (keys: StealthKeys, asset: DiscoveredAsset) => string;
}) {
  const [privateKey, setPrivateKey] = useState<string | undefined>();
  const [revealError, setRevealError] = useState<string | undefined>();

  const handleReveal = (): void => {
    if (!keys) return;
    try {
      const derived = reveal(keys, asset);

      // Confirm the derived key really controls the address before showing it.
      if (!stealthPrivateKeyMatches(derived, asset.stealthAddress)) {
        setRevealError(
          "Derived key does not control this address. The loaded spend key likely does not match the registered meta-address.",
        );
        return;
      }

      setPrivateKey(derived);
      setRevealError(undefined);
    } catch (cause) {
      setRevealError(cause instanceof Error ? cause.message : "Derivation failed.");
    }
  };

  const explorerUrl = explorerAddressUrl(chainId, asset.stealthAddress);

  return (
    <div className="border border-zinc-700/50 bg-zinc-900/50 p-4">
      <div className="flex flex-col">
        <DataRow
          label="Stealth address"
          value={
            explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all underline underline-offset-2 hover:text-white"
              >
                {asset.stealthAddress}
              </a>
            ) : (
              asset.stealthAddress
            )
          }
        />
        <DataRow label="Ephemeral key" value={asset.ephemeralPublicKey} copyable />
        <DataRow label="Block" value={asset.blockNumber.toString()} />
        <DataRow label="Announced by" value={asset.announcedBy} />
      </div>

      {revealError && (
        <div className="mt-4">
          <Notice tone="danger">{revealError}</Notice>
        </div>
      )}

      <div className="mt-4">
        {privateKey ? (
          <div className="flex flex-col gap-2">
            <Notice tone="danger" title="Private key for this address">
              Import it into a wallet to move the assets. Anyone who sees it controls them.
            </Notice>
            <div className="font-mono text-sm text-zinc-200">
              <CopyableValue value={privateKey} />
            </div>
          </div>
        ) : (
          <ActionButton variant="secondary" onClick={handleReveal} disabled={!keys}>
            <Eye className="h-4 w-4" />
            Reveal Controlling Key
          </ActionButton>
        )}
      </div>
    </div>
  );
}
