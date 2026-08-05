"use client";

import { useCallback, useEffect, useState } from "react";

import {
  generateStealthKeys,
  importStealthKeys,
  metaAddressFromKeys,
  StealthError,
  type StealthKeys,
  type StealthMetaAddress,
} from "@/lib/stealth";
import {
  clearKeys,
  hasStoredKeys,
  loadKeys,
  saveKeys,
  storedKeysCreatedAt,
  KeystoreError,
} from "@/lib/keystore";

/**
 * Session-scoped stealth key management.
 *
 * Keys live in React state for as long as the tab is open and in an
 * AES-GCM-encrypted localStorage blob across reloads. They are never sent
 * anywhere — no API route reads them, and nothing here awaits a network call.
 *
 * `hasStored` is resolved in an effect rather than during render because
 * localStorage does not exist on the server; reading it inline would produce a
 * hydration mismatch.
 */

export type KeyStatus = "locked" | "unlocked" | "absent";

export interface UseStealthKeysResult {
  keys: StealthKeys | undefined;
  metaAddress: StealthMetaAddress | undefined;
  status: KeyStatus;
  /** True until the localStorage probe has run on the client. */
  isHydrating: boolean;
  isBusy: boolean;
  error: string | undefined;
  storedAt: string | undefined;

  generate: () => StealthKeys;
  importFromPrivateKeys: (spendPrivateKey: string, viewPrivateKey: string) => StealthKeys;
  persist: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<void>;
  forget: () => void;
  lock: () => void;
  clearError: () => void;
}

function describeError(error: unknown): string {
  if (error instanceof KeystoreError || error instanceof StealthError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected error.";
}

export function useStealthKeys(): UseStealthKeysResult {
  const [keys, setKeys] = useState<StealthKeys | undefined>();
  const [hasStored, setHasStored] = useState(false);
  const [storedAt, setStoredAt] = useState<string | undefined>();
  const [isHydrating, setIsHydrating] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    setHasStored(hasStoredKeys());
    setStoredAt(storedKeysCreatedAt());
    setIsHydrating(false);
  }, []);

  const generate = useCallback((): StealthKeys => {
    setError(undefined);
    const fresh = generateStealthKeys();
    setKeys(fresh);
    return fresh;
  }, []);

  const importFromPrivateKeys = useCallback(
    (spendPrivateKey: string, viewPrivateKey: string): StealthKeys => {
      setError(undefined);
      try {
        const imported = importStealthKeys(spendPrivateKey.trim(), viewPrivateKey.trim());
        setKeys(imported);
        return imported;
      } catch (cause) {
        const message = describeError(cause);
        setError(message);
        throw cause;
      }
    },
    [],
  );

  const persist = useCallback(
    async (passphrase: string): Promise<void> => {
      if (!keys) {
        setError("Generate or import keys before saving.");
        return;
      }

      setIsBusy(true);
      setError(undefined);
      try {
        await saveKeys(keys, passphrase);
        setHasStored(true);
        setStoredAt(storedKeysCreatedAt());
      } catch (cause) {
        setError(describeError(cause));
      } finally {
        setIsBusy(false);
      }
    },
    [keys],
  );

  const unlock = useCallback(async (passphrase: string): Promise<void> => {
    setIsBusy(true);
    setError(undefined);
    try {
      setKeys(await loadKeys(passphrase));
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setIsBusy(false);
    }
  }, []);

  /** Drop keys from memory but leave the encrypted blob in place. */
  const lock = useCallback((): void => {
    setKeys(undefined);
    setError(undefined);
  }, []);

  /** Delete the encrypted keystore. Unrecoverable without a private key backup. */
  const forget = useCallback((): void => {
    try {
      clearKeys();
      setKeys(undefined);
      setHasStored(false);
      setStoredAt(undefined);
      setError(undefined);
    } catch (cause) {
      setError(describeError(cause));
    }
  }, []);

  const status: KeyStatus = keys ? "unlocked" : hasStored ? "locked" : "absent";

  return {
    keys,
    metaAddress: keys ? metaAddressFromKeys(keys) : undefined,
    status,
    isHydrating,
    isBusy,
    error,
    storedAt,
    generate,
    importFromPrivateKeys,
    persist,
    unlock,
    forget,
    lock,
    clearError: useCallback(() => setError(undefined), []),
  };
}
