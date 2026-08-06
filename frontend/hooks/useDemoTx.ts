"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DEMO_CONFIRM_MS, DEMO_WRITE_MS, demoTxHash } from "@/lib/demo";

/**
 * A fake transaction lifecycle, shaped like wagmi's.
 *
 * Every write panel renders the same three states — "confirm in wallet",
 * "waiting for confirmation", then a success notice with an explorer link. Demo
 * mode reproduces that sequence on a timer so those states are actually
 * reachable, instead of jumping straight to a result that appears out of
 * nowhere.
 *
 * The returned fields deliberately match the subset of `useWriteContract` +
 * `useWaitForTransactionReceipt` the panels consume, so a hook can substitute
 * this for the real pair without the components changing.
 */

export interface DemoTxResult {
  txHash: `0x${string}` | undefined;
  isWriting: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: Error | null;

  /**
   * Run a simulated transaction. `commit` applies the state change at the
   * moment the fake receipt lands, mirroring a real write: nothing is visible
   * until confirmation. Throwing from `commit` surfaces as a failed write.
   */
  run: (seed: string, commit?: () => void) => void;
  reset: () => void;
}

export function useDemoTx(): DemoTxResult {
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [isWriting, setIsWriting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Timers are cancelled on unmount so a navigation mid-"transaction" cannot
  // set state on a gone component.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback((): void => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const reset = useCallback((): void => {
    clearTimers();
    setTxHash(undefined);
    setIsWriting(false);
    setIsConfirming(false);
    setIsConfirmed(false);
    setError(null);
  }, [clearTimers]);

  const run = useCallback(
    (seed: string, commit?: () => void): void => {
      clearTimers();
      setTxHash(undefined);
      setIsConfirmed(false);
      setError(null);
      setIsWriting(true);
      setIsConfirming(false);

      // Phase 1 — the wallet prompt.
      timers.current.push(
        setTimeout(() => {
          setIsWriting(false);
          setTxHash(demoTxHash(`${seed}/${Date.now()}`));
          setIsConfirming(true);

          // Phase 2 — inclusion. The state change lands with the receipt.
          timers.current.push(
            setTimeout(() => {
              setIsConfirming(false);
              try {
                commit?.();
                setIsConfirmed(true);
              } catch (cause) {
                setError(cause instanceof Error ? cause : new Error("Transaction reverted."));
              }
            }, DEMO_CONFIRM_MS),
          );
        }, DEMO_WRITE_MS),
      );
    },
    [clearTimers],
  );

  return { txHash, isWriting, isConfirming, isConfirmed, error, run, reset };
}
