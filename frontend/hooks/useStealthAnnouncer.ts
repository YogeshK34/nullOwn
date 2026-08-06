"use client";

import { useCallback } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { Address } from "viem";

import { abis } from "@/lib/contracts";
import { chainId, contractAddresses } from "@/lib/env";
import { demoMode } from "@/lib/demo";
import { SCHEME_ID, type StealthPayment } from "@/lib/stealth";
import { useDemoTx } from "./useDemoTx";

/**
 * Publishes an ERC-5564 announcement so the recipient can discover a payment.
 *
 * This does not move any assets. NullOwn never touches the RWA token contract —
 * the sender transfers the token to the derived stealth address through the
 * token's own interface, and announces here so the recipient can find it. The
 * two steps are independent, and the UI says so.
 */
export interface UseStealthAnnouncerResult {
  announce: (payment: StealthPayment) => void;
  isAnnouncing: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  txHash: `0x${string}` | undefined;
  error: Error | null;
  reset: () => void;
  isConfigured: boolean;
}

export function useStealthAnnouncer(): UseStealthAnnouncerResult {
  const announcerAddress = contractAddresses.stealthAnnouncer;

  const {
    writeContract,
    data: txHash,
    isPending: isAnnouncing,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId,
  });

  const demoTx = useDemoTx();

  const announce = useCallback(
    (payment: StealthPayment): void => {
      if (!announcerAddress) return;

      // Nothing to record: an announcement is a log entry, and the demo
      // scanner synthesises its own. Only the transaction states matter here.
      if (demoMode) {
        demoTx.run(`announce/${payment.stealthAddress}`);
        return;
      }

      writeContract({
        address: announcerAddress,
        abi: abis.stealthAnnouncer,
        functionName: "announce",
        args: [
          SCHEME_ID,
          payment.stealthAddress as Address,
          payment.ephemeralPublicKey,
          // Byte 0 is the view tag; recipients use it to skip most entries.
          payment.metadata,
        ],
        chainId,
      });
    },
    [announcerAddress, demoTx, writeContract],
  );

  return {
    announce,
    isAnnouncing: demoMode ? demoTx.isWriting : isAnnouncing,
    isConfirming: demoMode ? demoTx.isConfirming : isConfirming,
    isConfirmed: demoMode ? demoTx.isConfirmed : isConfirmed,
    txHash: demoMode ? demoTx.txHash : txHash,
    error: demoMode ? demoTx.error : error,
    reset: demoMode ? demoTx.reset : reset,
    isConfigured: announcerAddress !== undefined,
  };
}
