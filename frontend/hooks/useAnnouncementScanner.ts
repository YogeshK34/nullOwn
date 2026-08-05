"use client";

import { useCallback, useRef, useState } from "react";
import type { Address } from "viem";

import { readOnlyContract, readOnlyProvider } from "@/lib/contracts";
import { announcementStartBlock, contractAddresses } from "@/lib/env";
import {
  checkAnnouncement,
  deriveStealthPrivateKey,
  viewTagFromMetadata,
  type StealthKeys,
} from "@/lib/stealth";

/**
 * Scans ERC-5564 announcements for payments belonging to the local keys.
 *
 * ---------------------------------------------------------------------------
 * How detection works
 * ---------------------------------------------------------------------------
 * There is no way to query "payments to me" — that is the whole point of the
 * scheme. Every announcement must be tested locally: recompute the shared
 * secret from the view key and the announced ephemeral key, derive the address
 * it implies, and see whether it matches the one announced.
 *
 * Two things keep that affordable. The view tag rejects ~255/256 of entries
 * after a single byte comparison. And the whole loop runs against a plain RPC
 * provider with no signer, so scanning never needs the spend key — it is
 * requested only when deriving the key for a matched payment.
 *
 * Log queries are chunked because public RPC providers cap block ranges
 * (commonly 10k blocks) and reject anything wider outright.
 */

const BLOCK_CHUNK_SIZE = 9_000n;

export interface DiscoveredAsset {
  stealthAddress: Address;
  ephemeralPublicKey: string;
  viewTag: number | undefined;
  blockNumber: number;
  txHash: string;
  /** Announcer of record. Untrusted — anyone may announce. */
  announcedBy: Address;
}

export interface ScanProgress {
  fromBlock: bigint;
  toBlock: bigint;
  currentBlock: bigint;
  /** 0–100. */
  percent: number;
  announcementsSeen: number;
}

export interface UseAnnouncementScannerResult {
  discovered: DiscoveredAsset[];
  isScanning: boolean;
  progress: ScanProgress | undefined;
  error: string | undefined;
  lastScannedBlock: bigint | undefined;

  scan: (keys: StealthKeys) => Promise<void>;
  cancel: () => void;
  reset: () => void;
  /** Spend key required — derives the key controlling a discovered address. */
  revealPrivateKey: (keys: StealthKeys, asset: DiscoveredAsset) => string;

  isConfigured: boolean;
}

interface RawAnnouncement {
  stealthAddress: Address;
  ephemeralPubKey: string;
  metadata: string;
  caller: Address;
  blockNumber: number;
  txHash: string;
}

export function useAnnouncementScanner(): UseAnnouncementScannerResult {
  const [discovered, setDiscovered] = useState<DiscoveredAsset[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [lastScannedBlock, setLastScannedBlock] = useState<bigint | undefined>();

  // Ref rather than state: the scan loop reads this synchronously between
  // chunks, and a state update would not be visible to the running closure.
  const cancelledRef = useRef(false);

  const isConfigured = contractAddresses.stealthAnnouncer !== undefined;

  const cancel = useCallback((): void => {
    cancelledRef.current = true;
  }, []);

  const reset = useCallback((): void => {
    setDiscovered([]);
    setProgress(undefined);
    setError(undefined);
    setLastScannedBlock(undefined);
  }, []);

  const scan = useCallback(
    async (keys: StealthKeys): Promise<void> => {
      if (!isConfigured) {
        setError("Announcer address is not configured. Set NEXT_PUBLIC_ERC5564_ADDRESS.");
        return;
      }

      cancelledRef.current = false;
      setIsScanning(true);
      setError(undefined);
      setDiscovered([]);

      try {
        const provider = readOnlyProvider();
        const contract = readOnlyContract("stealthAnnouncer");
        const latestBlock = BigInt(await provider.getBlockNumber());

        const fromBlock = announcementStartBlock;
        if (fromBlock > latestBlock) {
          throw new Error(
            `Start block ${fromBlock} is ahead of chain head ${latestBlock}. ` +
              "Check NEXT_PUBLIC_ANNOUNCEMENT_START_BLOCK.",
          );
        }

        const totalBlocks = latestBlock - fromBlock + 1n;
        const matches: DiscoveredAsset[] = [];
        let announcementsSeen = 0;

        for (let start = fromBlock; start <= latestBlock; start += BLOCK_CHUNK_SIZE) {
          if (cancelledRef.current) break;

          const end = start + BLOCK_CHUNK_SIZE - 1n > latestBlock
            ? latestBlock
            : start + BLOCK_CHUNK_SIZE - 1n;

          const announcements = await fetchAnnouncements(contract, start, end);
          announcementsSeen += announcements.length;

          for (const announcement of announcements) {
            const viewTag = viewTagFromMetadata(announcement.metadata);

            // Only the view key is used here — matching never needs the spend key.
            const derived = checkAnnouncement(
              keys.view.privateKey,
              keys.spend.publicKey,
              announcement.ephemeralPubKey,
              viewTag,
            );

            if (derived && derived.toLowerCase() === announcement.stealthAddress.toLowerCase()) {
              matches.push({
                stealthAddress: announcement.stealthAddress,
                ephemeralPublicKey: announcement.ephemeralPubKey,
                viewTag,
                blockNumber: announcement.blockNumber,
                txHash: announcement.txHash,
                announcedBy: announcement.caller,
              });
            }
          }

          // Publish results per chunk so a long scan stays informative.
          setDiscovered([...matches]);
          setProgress({
            fromBlock,
            toBlock: latestBlock,
            currentBlock: end,
            percent: Number(((end - fromBlock + 1n) * 100n) / totalBlocks),
            announcementsSeen,
          });
          setLastScannedBlock(end);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Scan failed.");
      } finally {
        setIsScanning(false);
      }
    },
    [isConfigured],
  );

  const revealPrivateKey = useCallback((keys: StealthKeys, asset: DiscoveredAsset): string => {
    return deriveStealthPrivateKey(
      keys.spend.privateKey,
      keys.view.privateKey,
      asset.ephemeralPublicKey,
    );
  }, []);

  return {
    discovered,
    isScanning,
    progress,
    error,
    lastScannedBlock,
    scan,
    cancel,
    reset,
    revealPrivateKey,
    isConfigured,
  };
}

/** Query one block range, normalising ethers' log shape. */
async function fetchAnnouncements(
  contract: ReturnType<typeof readOnlyContract>,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<RawAnnouncement[]> {
  const logs = await contract.queryFilter(
    contract.filters.Announcement!(),
    Number(fromBlock),
    Number(toBlock),
  );

  return logs.flatMap((log) => {
    // queryFilter can yield undecoded logs; those carry no `args`.
    if (!("args" in log) || !log.args) return [];

    return [
      {
        stealthAddress: log.args.stealthAddress as Address,
        ephemeralPubKey: log.args.ephemeralPubKey as string,
        metadata: log.args.metadata as string,
        caller: log.args.caller as Address,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
      },
    ];
  });
}
