"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  encodeBytes32String,
  decodeBytes32String,
  hexlify,
  keccak256,
  toUtf8Bytes,
} from "ethers";
import type { Address } from "viem";

import { abis, readOnlyContract } from "@/lib/contracts";
import { chainId, contractAddresses } from "@/lib/env";

/**
 * Compliance module bindings: role checks, audit requests, and the audit log.
 *
 * The privacy model is worth restating, because the UI has to communicate it:
 * the *existence* of an audit is public and immutable, while the disclosed data
 * is ciphertext only the requesting regulator can open. This hook therefore
 * exposes the full log to everyone, and gates only the write paths on roles.
 */

export interface AuditRecord {
  id: number;
  regulator: Address;
  /** Raw bytes32 scope. */
  scope: string;
  /** Scope decoded as UTF-8 when it is a readable label. */
  scopeLabel: string;
  timestamp: number;
  fulfilled: boolean;
  /** Ciphertext, present once fulfilled. Undecryptable without the audit key. */
  encryptedResponse: string;
}

export interface UseComplianceResult {
  audits: AuditRecord[];
  auditCount: number;
  isLoading: boolean;
  error: string | undefined;
  refresh: () => Promise<void>;

  isRegulator: boolean;
  isAdmin: boolean;
  isRoleLoading: boolean;

  requestAudit: (scopeLabel: string) => void;
  fulfillAudit: (auditId: number, encryptedData: string) => void;
  grantRegulator: (account: Address) => void;
  revokeRegulator: (account: Address) => void;

  isWriting: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  txHash: `0x${string}` | undefined;
  writeError: Error | null;
  resetWrite: () => void;

  isConfigured: boolean;
}

/** OpenZeppelin's DEFAULT_ADMIN_ROLE is bytes32(0). */
const DEFAULT_ADMIN_ROLE = `0x${"00".repeat(32)}` as const;

export function useCompliance(): UseComplianceResult {
  const { address } = useAccount();
  const complianceAddress = contractAddresses.complianceModule;
  const isConfigured = complianceAddress !== undefined;

  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const { data: auditCountRaw, refetch: refetchCount } = useReadContract({
    address: complianceAddress,
    abi: abis.complianceModule,
    functionName: "auditCount",
    chainId,
    query: { enabled: isConfigured },
  });

  const { data: isRegulator, isLoading: isRegulatorLoading } = useReadContract({
    address: complianceAddress,
    abi: abis.complianceModule,
    functionName: "isRegulator",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: isConfigured && address !== undefined },
  });

  const { data: isAdmin, isLoading: isAdminLoading } = useReadContract({
    address: complianceAddress,
    abi: abis.complianceModule,
    functionName: "hasRole",
    args: address ? [DEFAULT_ADMIN_ROLE, address] : undefined,
    chainId,
    query: { enabled: isConfigured && address !== undefined },
  });

  const auditCount = auditCountRaw !== undefined ? Number(auditCountRaw) : 0;

  /**
   * Load every audit record.
   *
   * Uses the ethers read-only contract rather than a pile of `useReadContract`
   * calls, because the record count is dynamic and hooks cannot be called in a
   * loop. `getAudit` is used over the `auditLog` mapping getter — the
   * auto-generated getter omits `encryptedResponse`.
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (!isConfigured) return;

    setIsLoading(true);
    setError(undefined);

    try {
      const { data: freshCount } = await refetchCount();
      const total = freshCount !== undefined ? Number(freshCount) : 0;

      const contract = readOnlyContract("complianceModule");
      const records: AuditRecord[] = [];

      for (let id = 0; id < total; id++) {
        const record = await contract.getAudit!(id);
        records.push({
          id,
          regulator: record.regulator as Address,
          scope: record.scope as string,
          scopeLabel: decodeScope(record.scope as string),
          timestamp: Number(record.timestamp),
          fulfilled: Boolean(record.fulfilled),
          encryptedResponse: record.encryptedResponse as string,
        });
      }

      // Newest first — an audit log is read from the top.
      setAudits(records.reverse());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load the audit log.");
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, refetchCount]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId,
  });

  // A confirmed write always changes the log or the roles behind it.
  useEffect(() => {
    if (isConfirmed) void refresh();
  }, [isConfirmed, refresh]);

  const requestAudit = useCallback(
    (scopeLabel: string): void => {
      if (!complianceAddress) return;
      writeContract({
        address: complianceAddress,
        abi: abis.complianceModule,
        functionName: "requestAudit",
        args: [encodeScope(scopeLabel)],
        chainId,
      });
    },
    [complianceAddress, writeContract],
  );

  const fulfillAudit = useCallback(
    (auditId: number, encryptedData: string): void => {
      if (!complianceAddress) return;
      writeContract({
        address: complianceAddress,
        abi: abis.complianceModule,
        functionName: "fulfillAudit",
        args: [BigInt(auditId), normaliseHex(encryptedData)],
        chainId,
      });
    },
    [complianceAddress, writeContract],
  );

  const setRegulatorRole = useCallback(
    (account: Address, grant: boolean): void => {
      if (!complianceAddress) return;
      writeContract({
        address: complianceAddress,
        abi: abis.complianceModule,
        functionName: grant ? "grantRole" : "revokeRole",
        args: [regulatorRole(), account],
        chainId,
      });
    },
    [complianceAddress, writeContract],
  );

  return {
    audits,
    auditCount,
    isLoading,
    error,
    refresh,
    isRegulator: Boolean(isRegulator),
    isAdmin: Boolean(isAdmin),
    isRoleLoading: isRegulatorLoading || isAdminLoading,
    requestAudit,
    fulfillAudit,
    grantRegulator: useCallback(
      (account: Address) => setRegulatorRole(account, true),
      [setRegulatorRole],
    ),
    revokeRegulator: useCallback(
      (account: Address) => setRegulatorRole(account, false),
      [setRegulatorRole],
    ),
    isWriting,
    isConfirming,
    isConfirmed,
    txHash,
    writeError,
    resetWrite,
    isConfigured,
  };
}

/**
 * `keccak256("REGULATOR_ROLE")`, matching the contract constant.
 * Computed rather than hard-coded so it cannot drift from the Solidity side.
 */
function regulatorRole(): `0x${string}` {
  return keccak256(toUtf8Bytes("REGULATOR_ROLE")) as `0x${string}`;
}

/** Pack a human label into bytes32; labels longer than 31 bytes are rejected. */
function encodeScope(label: string): `0x${string}` {
  const trimmed = label.trim();
  if (trimmed.length === 0) throw new Error("Audit scope cannot be empty.");
  if (toUtf8Bytes(trimmed).length > 31) {
    throw new Error("Audit scope must be 31 bytes or fewer once UTF-8 encoded.");
  }
  return encodeBytes32String(trimmed) as `0x${string}`;
}

/** Best-effort UTF-8 rendering of a bytes32 scope; falls back to raw hex. */
function decodeScope(scope: string): string {
  try {
    return decodeBytes32String(scope);
  } catch {
    return scope;
  }
}

/** Accept either hex or plain text for the encrypted payload. */
function normaliseHex(value: string): `0x${string}` {
  const trimmed = value.trim();
  if (/^0x[0-9a-fA-F]*$/.test(trimmed)) return trimmed as `0x${string}`;
  return hexlify(toUtf8Bytes(trimmed)) as `0x${string}`;
}
