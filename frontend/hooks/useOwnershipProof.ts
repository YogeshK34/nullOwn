"use client";

import { useCallback, useEffect, useState } from "react";
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { abis } from "@/lib/contracts";
import { chainId, contractAddresses } from "@/lib/env";
import {
  DEMO_PROOF_POINTS,
  DEMO_PROVING_TIME_MS,
  demoDelay,
  demoMode,
} from "@/lib/demo";
import { fieldToHex32 } from "@/lib/poseidon";
import {
  buildMerkleTree,
  findLeafIndex,
  getMerkleProof,
  verifyMerkleProof,
  type TokenHolding,
} from "@/lib/merkle";
import {
  areCircuitArtifactsAvailable,
  computeNullifier,
  deriveSpendKeyHash,
  generateOwnershipProof,
  ProverError,
  type OwnershipProofResult,
} from "@/lib/zkProver";
import type { StealthKeys } from "@/lib/stealth";
import { useDemoTx } from "./useDemoTx";

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
  // fills in a form they cannot submit. Demo mode skips the probe: it does not
  // use the artifacts, so their absence is not a reason to disable the form.
  useEffect(() => {
    if (demoMode) {
      setArtifactsAvailable(true);
      return;
    }

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
    query: { enabled: !demoMode && isConfigured && result !== undefined },
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

  const demoTx = useDemoTx();
  const effectiveConfirmed = demoMode ? demoTx.isConfirmed : isConfirmed;

  useEffect(() => {
    if (effectiveConfirmed) setStage("submitted");
  }, [effectiveConfirmed]);

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

      // Demo mode runs everything above for real — the tree, the inclusion
      // proof, the spend key hash — and fabricates only the Groth16 points,
      // which is the one part that needs artifacts circom has to build. The
      // three public signals below are genuine.
      const proof = demoMode
        ? await fabricateProof(tree.root, threshold, spendKeyHash, tokenId)
        : await generateOwnershipProof({
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

    if (demoMode) {
      demoTx.run(`verify-ownership/${result.nullifier}`);
      return;
    }

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
  }, [demoTx, result, verifierAddress, writeContract]);

  const reset = useCallback((): void => {
    setStage("idle");
    setResult(undefined);
    setMerkleRoot(undefined);
    setError(undefined);
    setArtifactsMissing(false);
    if (demoMode) demoTx.reset();
    else resetWrite();
  }, [demoTx, resetWrite]);

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
    isSubmitting: demoMode ? demoTx.isWriting : isSubmitting,
    isConfirming: demoMode ? demoTx.isConfirming : isConfirming,
    isConfirmed: effectiveConfirmed,
    txHash: demoMode ? demoTx.txHash : txHash,
    submitError: demoMode ? demoTx.error : submitError,
    // No chain to ask, and a demo that refused its own second proof would be
    // more confusing than instructive.
    nullifierUsed: demoMode ? false : nullifierUsed,
    isConfigured,
  };
}

/**
 * A proof-shaped object with fabricated Groth16 points.
 *
 * The public signals are the real ones — the Merkle root computed from the
 * user's holdings, the threshold they entered, and the Poseidon nullifier
 * derived from their actual spend key. Only `proof` is invented, and a real
 * verifier would reject it, which is why demo mode never sends it anywhere.
 */
async function fabricateProof(
  merkleRoot: bigint,
  threshold: bigint,
  spendKeyHash: bigint,
  tokenId: bigint,
): Promise<OwnershipProofResult> {
  const nullifier = await computeNullifier(spendKeyHash, tokenId);

  // Proving is the slow step in the real flow; the demo keeps it visible.
  await demoDelay(1_400);

  const points = DEMO_PROOF_POINTS.map((point) => point.toString());

  return {
    proof: {
      pi_a: [points[0]!, points[1]!, "1"],
      pi_b: [
        [points[2]!, points[3]!],
        [points[4]!, points[5]!],
        ["1", "0"],
      ],
      pi_c: [points[6]!, points[7]!, "1"],
      protocol: "groth16",
      curve: "bn128",
    },
    publicSignals: [merkleRoot.toString(), threshold.toString(), nullifier.toString()],
    solidityProof: [
      DEMO_PROOF_POINTS[0]!,
      DEMO_PROOF_POINTS[1]!,
      DEMO_PROOF_POINTS[2]!,
      DEMO_PROOF_POINTS[3]!,
      DEMO_PROOF_POINTS[4]!,
      DEMO_PROOF_POINTS[5]!,
      DEMO_PROOF_POINTS[6]!,
      DEMO_PROOF_POINTS[7]!,
    ],
    solidityPublicSignals: [merkleRoot, threshold, nullifier],
    nullifier: fieldToHex32(nullifier),
    provingTimeMs: DEMO_PROVING_TIME_MS,
  };
}
