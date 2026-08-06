"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { Address } from "viem";

import { abis } from "@/lib/contracts";
import { contractAddresses, chainId } from "@/lib/env";
import { demoMode } from "@/lib/demo";
import {
  demoRegistrationFor,
  setDemoRegistration,
  subscribeDemoStore,
  getDemoRegistrations,
} from "@/lib/demo-store";
import { decodeMetaAddress, type StealthMetaAddress } from "@/lib/stealth";
import { useDemoTx } from "./useDemoTx";

/**
 * Reads and writes the ERC-6538 stealth meta-address registry.
 *
 * All chain access goes through wagmi hooks, per the project convention that
 * wallet interaction never touches `window.ethereum` directly.
 */

export interface UseStealthRegistryResult {
  /** Meta-address currently registered for `address`, if any. */
  registered: StealthMetaAddress | undefined;
  /** Set when the on-chain entry exists but cannot be decoded. */
  decodeError: string | undefined;
  isLoading: boolean;
  isRegistered: boolean;
  readError: Error | null;
  refetch: () => void;

  register: (encodedMetaAddress: string) => void;
  isRegistering: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  txHash: `0x${string}` | undefined;
  writeError: Error | null;
  reset: () => void;

  /** False when NEXT_PUBLIC_ERC6538_ADDRESS is unset. */
  isConfigured: boolean;
}

export function useStealthRegistry(account?: Address): UseStealthRegistryResult {
  const { address: connectedAddress } = useAccount();
  const target = account ?? connectedAddress;
  const registryAddress = contractAddresses.stealthRegistry;
  const isConfigured = registryAddress !== undefined;

  const {
    data: onChainEncoded,
    isLoading,
    error: readError,
    refetch,
  } = useReadContract({
    address: registryAddress,
    abi: abis.stealthRegistry,
    functionName: "getStealthMetaAddress",
    args: target ? [target] : undefined,
    chainId,
    query: {
      // Nothing to read until both the contract and a target account exist,
      // and nothing to read at all in demo mode — the entry comes from the
      // demo store instead of the chain.
      enabled: !demoMode && isConfigured && target !== undefined,
    },
  });

  const demoRegistrations = useSyncExternalStore(
    subscribeDemoStore,
    getDemoRegistrations,
    getDemoRegistrations,
  );

  const encoded =
    demoMode && target
      ? demoRegistrationFor(demoRegistrations, target, connectedAddress)
      : onChainEncoded;

  // A registered entry can still be junk — anyone can write 66 arbitrary bytes.
  // Decoding failure is surfaced rather than thrown so the page can offer
  // re-registration instead of blowing up.
  const { registered, decodeError } = useMemo(() => {
    if (!encoded || encoded === "0x") {
      return { registered: undefined, decodeError: undefined };
    }
    try {
      return { registered: decodeMetaAddress(encoded), decodeError: undefined };
    } catch (cause) {
      return {
        registered: undefined,
        decodeError: cause instanceof Error ? cause.message : "Unreadable registry entry.",
      };
    }
  }, [encoded]);

  const {
    writeContract,
    data: txHash,
    isPending: isRegistering,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId,
  });

  const demoTx = useDemoTx();

  const register = useCallback(
    (encodedMetaAddress: string): void => {
      if (!registryAddress) return;

      if (demoMode) {
        const account = connectedAddress;
        demoTx.run("register-keys", () => {
          if (!account) throw new Error("No account connected.");
          setDemoRegistration(account, encodedMetaAddress);
        });
        return;
      }

      writeContract({
        address: registryAddress,
        abi: abis.stealthRegistry,
        functionName: "registerKeys",
        args: [encodedMetaAddress as `0x${string}`],
        chainId,
      });
    },
    [connectedAddress, demoTx, registryAddress, writeContract],
  );

  return {
    registered,
    decodeError,
    isLoading: demoMode ? false : isLoading,
    isRegistered: registered !== undefined,
    readError: demoMode ? null : readError,
    refetch: useCallback(() => void refetch(), [refetch]),
    register,
    isRegistering: demoMode ? demoTx.isWriting : isRegistering,
    isConfirming: demoMode ? demoTx.isConfirming : isConfirming,
    isConfirmed: demoMode ? demoTx.isConfirmed : isConfirmed,
    txHash: demoMode ? demoTx.txHash : txHash,
    writeError: demoMode ? demoTx.error : writeError,
    reset: demoMode ? demoTx.reset : reset,
    isConfigured,
  };
}
