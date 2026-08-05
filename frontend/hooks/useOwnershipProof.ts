"use client";

import { useCallback, useEffect, useState } from "react";
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { abis } from "@/lib/contracts";
import { chainId, contractAddresses } from "@/lib/env";
import {
  buildMerkleTree,
  findLeafIndex,
  getMerkleProof,
  verifyMerkleProof,
  type TokenHolding,
} from "@/lib/merkle";
import {
  areCircuitArtifactsAvailable,
  deriveSpendKeyHash,
  generateOwnershipProof,
  ProverError,
  type OwnershipProofResult,
} from "@/lib/zkProver";
import type { StealthKeys } from "@/lib/stealth";

/**
 * Client-side ZK ownership proving, end to end.
 *
 * Sequence: build the Merkle tree over the user's holdings → extract the
 * inclusion proof for the token being attested → derive `spendKeyHash` →
 * generate the Groth16 proof in the browser → submit proof and public signals
 * to `OwnershipVerifier`.
 *
 * The spend key never leaves this process. It is hashed into a field element
 * before it enters the witness, and the witness never leaves the browser.
 */

export type ProofStage =
  | "idle"
  | "building-tree"
  | "deriving-inputs"
  | "proving"
  | "ready"
  | "submitting"
  | "submitted"
  | "failed";

export interface ProveRequest {
  keys: StealthKeys;
  /** Every holding in the tree — the root commits to all of them. */
  holdings: TokenHolding[];
  /** Which holding to attest. Must appear in `holdings`. */
  tokenId: bigint;
  quantity: bigint;
  /** Minimum being claimed. Must be ≤ `quantity`. */
  threshold: bigint;
}

export interface UseOwnershipProofResult {
  stage: ProofStage;
  result: OwnershipProofResult | undefined;
  merkleRoot: bigint | undefined;
  error: string | undefined;
  /** True when the failure is missing circuit artifacts, not bad input. */
  artifactsMissing: boolean;
  /** undefined until the artifact probe resolves. */
  artifactsAvailable: boolean | undefined;

  prove: (request: ProveRequest) => Promise<void>;
  submit: () => void;
  reset: () => void;

  isSubmitting: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  txHash: `0x${string}` | undefined;
  submitError: Error | null;

  /** True when this proof's nullifier has already been consumed on-chain. */
  nullifierUsed: boolean | undefined;
  isConfigured: boolean;
}

export function useOwnershipProof(): UseOwnershipProofResult {
  const [stage, setStage] = useState<ProofStage>("idle");
  const [result, setResult] = useState<OwnershipProofResult | undefined>();
  const [merkleRoot, setMerkleRoot] = useState<bigint | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [artifactsMissing, setArtifactsMissing] = useState(false);
  const [artifactsAvailable, setArtifactsAvailable] = useState<boolean | undefined>();

  const verifierAddress = contractAddresses.ownershipVerifier;
  const isConfigured = verifierAddress !== undefined;

  // Probe once on mount so the UI can explain the situation before the user
  // fills in a form they cannot submit.
  useEffect(() => {
    let cancelled = false;
    void areCircuitArtifactsAvailable().then((available) => {
      if (!cancelled) setArtifactsAvailable(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Replay check: a used nullifier means the chain will reject this proof.
  const { data: nullifierUsed } = useReadContract({
    address: verifierAddress,
    abi: abis.ownershipVerifier,
    functionName: "isNullifierUsed",
    args: result ? [result.nullifier] : undefined,
    chainId,
    query: { enabled: isConfigured && result !== undefined },
  });

  const {
    writeContract,
    data: txHash,
    isPending: isSubmitting,
    error: submitError,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId,
  });

  useEffect(() => {
    if (isConfirmed) setStage("submitted");
  }, [isConfirmed]);

  const prove = useCallback(async (request: ProveRequest): Promise<void> => {
    const { keys, holdings, tokenId, quantity, threshold } = request;

    setError(undefined);
    setArtifactsMissing(false);
    setResult(undefined);

    try {
      if (threshold > quantity) {
        throw new Error(
          `Cannot attest a threshold of ${threshold} against a holding of ${quantity}.`,
        );
      }

      setStage("building-tree");
      const tree = await buildMerkleTree(holdings);
      setMerkleRoot(tree.root);

      const leafIndex = await findLeafIndex(tree, tokenId, quantity);
      if (leafIndex < 0) {
        throw new Error(
          `Token ${tokenId} with quantity ${quantity} is not among the listed holdings.`,
        );
      }

      const merkleProof = await getMerkleProof(tree, leafIndex);

      // Cheap guard: a bad path costs seconds here versus a minute in the prover.
      if (!(await verifyMerkleProof(merkleProof))) {
        throw new Error("Merkle proof failed local verification; the tree is inconsistent.");
      }

      setStage("deriving-inputs");
      const spendKeyHash = await deriveSpendKeyHash(keys.spend.privateKey);

      setStage("proving");
      const proof = await generateOwnershipProof({
        tokenId,
        quantity,
        spendKeyHash,
        merkleProof,
        threshold,
      });

      setResult(proof);
      setStage("ready");
    } catch (cause) {
      if (cause instanceof ProverError && cause.missingArtifacts) {
        setArtifactsMissing(true);
      }
      setError(cause instanceof Error ? cause.message : "Proof generation failed.");
      setStage("failed");
    }
  }, []);

  const submit = useCallback((): void => {
    if (!result || !verifierAddress) return;

    setStage("submitting");
    writeContract({
      address: verifierAddress,
      abi: abis.ownershipVerifier,
      functionName: "verifyOwnership",
      args: [
        result.solidityProof as unknown as readonly [
          bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
        ],
        result.solidityPublicSignals as unknown as readonly [bigint, bigint, bigint],
      ],
      chainId,
    });
  }, [result, verifierAddress, writeContract]);

  const reset = useCallback((): void => {
    setStage("idle");
    setResult(undefined);
    setMerkleRoot(undefined);
    setError(undefined);
    setArtifactsMissing(false);
    resetWrite();
  }, [resetWrite]);

  return {
    stage,
    result,
    merkleRoot,
    error,
    artifactsMissing,
    artifactsAvailable,
    prove,
    submit,
    reset,
    isSubmitting,
    isConfirming,
    isConfirmed,
    txHash,
    submitError,
    nullifierUsed,
    isConfigured,
  };
}
