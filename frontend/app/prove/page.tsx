"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { CircuitBoard, ExternalLink, Send, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import {
  ActionButton,
  DataRow,
  Field,
  Notice,
  Panel,
  PanelDivider,
  StatusPill,
} from "@/components/app/panel";
import { HoldingsEditor, type HoldingRow } from "@/components/prove/holdings-editor";
import { useStealthKeys } from "@/hooks/useStealthKeys";
import { useOwnershipProof, type ProofStage } from "@/hooks/useOwnershipProof";
import type { TokenHolding } from "@/lib/merkle";
import { chainId } from "@/lib/env";
import { explorerTxUrl } from "@/lib/chains";
import { fieldToHex32 } from "@/lib/poseidon";

/**
 * Layer 2 — zero-knowledge ownership proofs.
 *
 * The proof is generated here, in the browser. Nothing about the witness —
 * token id, quantity, spend key hash, Merkle path — is transmitted. Only the
 * proof and its three public signals go on-chain.
 */
export default function ProvePage() {
  const { isConnected } = useAccount();
  const { keys, status } = useStealthKeys();
  const proof = useOwnershipProof();

  const [rows, setRows] = useState<HoldingRow[]>([
    { id: "initial-holding", tokenId: "", quantity: "1" },
  ]);
  const [selectedId, setSelectedId] = useState<string>("initial-holding");
  const [threshold, setThreshold] = useState("1");
  const [inputError, setInputError] = useState<string | undefined>();

  const selected = rows.find((row) => row.id === selectedId);

  const holdings = useMemo<TokenHolding[] | undefined>(() => {
    try {
      return rows.map((row) => {
        if (!row.tokenId.trim()) throw new Error("Every holding needs a token ID.");
        return {
          tokenId: BigInt(row.tokenId.trim()),
          quantity: BigInt(row.quantity.trim() || "0"),
        };
      });
    } catch {
      return undefined;
    }
  }, [rows]);

  const handleProve = async (): Promise<void> => {
    setInputError(undefined);

    if (!keys) {
      setInputError("Unlock your stealth keys first — the spend key is needed to derive the nullifier.");
      return;
    }
    if (!holdings || !selected) {
      setInputError("Fill in a numeric token ID and quantity for every holding.");
      return;
    }

    try {
      await proof.prove({
        keys,
        holdings,
        tokenId: BigInt(selected.tokenId.trim()),
        quantity: BigInt(selected.quantity.trim() || "0"),
        threshold: BigInt(threshold.trim() || "0"),
      });
    } catch (cause) {
      setInputError(cause instanceof Error ? cause.message : "Invalid input.");
    }
  };

  const busy = ["building-tree", "deriving-inputs", "proving"].includes(proof.stage);

  return (
    <AppShell
      badge="Layer 2 — Zero-Knowledge Proofs"
      title="Prove a Holding, Reveal Nothing"
      intro="Generate a Groth16 proof in your browser attesting that you hold at least a given quantity of a token, then submit it on-chain. The verifier learns a Merkle root, the threshold, and a nullifier — never your address, your token, or your balance."
    >
      {proof.artifactsAvailable === false && (
        <Notice tone="warning" title="Circuit artifacts are not available">
          {
            "Proof generation needs ownership_proof.wasm and ownership_proof_final.zkey in frontend/public/circuits/. " +
            "Both are build outputs rather than repository files — the proving key alone is tens of megabytes.\n\n" +
            "Generate them with:  npm run circuits:setup   (requires circom on PATH)\n\n" +
            "Everything below still works up to the proving step, so you can inspect the Merkle root and the derived inputs."
          }
        </Notice>
      )}

      <Panel
        title="Proof Inputs"
        description="These values form the witness. They stay in this tab."
        accent
        action={<StageIndicator stage={proof.stage} />}
      >
        {status !== "unlocked" && (
          <Notice tone="info">
            Your stealth keys are {status === "locked" ? "locked" : "not set up"}. The spend key is
            hashed into the witness and the nullifier, so unlock it on the Stealth page first.
          </Notice>
        )}

        <HoldingsEditor
          rows={rows}
          onChange={setRows}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        <PanelDivider label="Claim" />

        <Field
          label="Threshold to attest"
          inputMode="numeric"
          placeholder="1"
          value={threshold}
          onChange={(event) => setThreshold(event.target.value)}
          hint="The proof asserts quantity ≥ threshold. Claiming less than you hold reveals less."
        />

        {inputError && <Notice tone="danger">{inputError}</Notice>}
        {proof.error && !proof.artifactsMissing && (
          <Notice tone="danger" title="Proof generation failed">
            {proof.error}
          </Notice>
        )}

        <div className="flex flex-wrap gap-3">
          <ActionButton
            onClick={() => void handleProve()}
            busy={busy}
            disabled={busy || !keys || proof.artifactsAvailable === false}
          >
            <CircuitBoard className="h-4 w-4" />
            {busy ? stageLabel(proof.stage) : "Generate Proof"}
          </ActionButton>

          {proof.stage !== "idle" && (
            <ActionButton variant="secondary" onClick={proof.reset} disabled={busy}>
              Reset
            </ActionButton>
          )}
        </div>

        {busy && (
          <p className="text-xs leading-relaxed text-zinc-500">
            Proving runs on the main thread and takes several seconds at depth 20. The tab will feel
            unresponsive until it finishes.
          </p>
        )}

        {proof.merkleRoot !== undefined && (
          <div className="flex flex-col">
            <DataRow label="Merkle root" value={fieldToHex32(proof.merkleRoot)} copyable />
          </div>
        )}
      </Panel>

      {proof.result && (
        <Panel
          title="Generated Proof"
          description="Public signals only. The witness that produced them is not included and never left this browser."
          action={<StatusPill tone="success">Proof ready</StatusPill>}
        >
          <div className="flex flex-col">
            <DataRow
              label="Merkle root"
              value={fieldToHex32(proof.result.solidityPublicSignals[0])}
              copyable
            />
            <DataRow
              label="Threshold"
              value={proof.result.solidityPublicSignals[1].toString()}
              mono={false}
            />
            <DataRow label="Nullifier" value={proof.result.nullifier} copyable />
            <DataRow
              label="Proving time"
              value={`${(proof.result.provingTimeMs / 1000).toFixed(2)}s`}
              mono={false}
            />
          </div>

          {proof.nullifierUsed && (
            <Notice tone="danger" title="This nullifier has already been used">
              The verifier records every nullifier permanently and reverts on reuse. Attesting the
              same token with the same spend key again will fail — this is the replay protection
              working as intended.
            </Notice>
          )}

          {proof.submitError && (
            <Notice tone="danger" title="Submission failed">
              {proof.submitError.message}
            </Notice>
          )}

          {proof.isConfirmed && proof.txHash && (
            <Notice tone="success" title="Ownership verified on-chain">
              <TxLink hash={proof.txHash} />
            </Notice>
          )}

          {!proof.isConfigured && (
            <Notice tone="warning">
              Verifier address is unset. Set NEXT_PUBLIC_VERIFIER_ADDRESS to submit proofs.
            </Notice>
          )}

          <ActionButton
            onClick={proof.submit}
            busy={proof.isSubmitting || proof.isConfirming}
            disabled={
              !proof.isConfigured ||
              !isConnected ||
              proof.nullifierUsed === true ||
              proof.isConfirmed
            }
          >
            <Send className="h-4 w-4" />
            {proof.isSubmitting
              ? "Confirm in wallet…"
              : proof.isConfirming
                ? "Waiting for confirmation…"
                : proof.isConfirmed
                  ? "Submitted"
                  : "Submit to Verifier"}
          </ActionButton>
        </Panel>
      )}

      <Panel
        title="What the Chain Learns"
        description="The complete set of information a public observer gains from a submitted proof."
      >
        <ul className="flex flex-col gap-3 text-sm text-zinc-400">
          <PrivacyRow disclosed>A Merkle root — commits to your holdings without naming them</PrivacyRow>
          <PrivacyRow disclosed>The threshold you claimed to meet</PrivacyRow>
          <PrivacyRow disclosed>A nullifier — one-way, prevents replay</PrivacyRow>
          <PrivacyRow>Your wallet address</PrivacyRow>
          <PrivacyRow>The token ID</PrivacyRow>
          <PrivacyRow>The quantity you actually hold</PrivacyRow>
          <PrivacyRow>Any other holding in the tree</PrivacyRow>
        </ul>
      </Panel>
    </AppShell>
  );
}

function PrivacyRow({
  disclosed = false,
  children,
}: {
  disclosed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <ShieldCheck
        className={
          disclosed ? "mt-0.5 h-4 w-4 shrink-0 text-amber-500" : "mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
        }
      />
      <span>
        <span
          className={
            disclosed
              ? "mr-2 text-xs uppercase tracking-wider text-amber-500"
              : "mr-2 text-xs uppercase tracking-wider text-emerald-400"
          }
        >
          {disclosed ? "Public" : "Never revealed"}
        </span>
        {children}
      </span>
    </li>
  );
}

function StageIndicator({ stage }: { stage: ProofStage }) {
  if (stage === "idle") return <StatusPill>Ready</StatusPill>;
  if (stage === "failed") return <StatusPill tone="danger">Failed</StatusPill>;
  if (stage === "ready") return <StatusPill tone="success">Proof ready</StatusPill>;
  if (stage === "submitted") return <StatusPill tone="success">Verified</StatusPill>;
  return <StatusPill tone="info">{stageLabel(stage)}</StatusPill>;
}

function stageLabel(stage: ProofStage): string {
  switch (stage) {
    case "building-tree":
      return "Building Merkle tree…";
    case "deriving-inputs":
      return "Deriving inputs…";
    case "proving":
      return "Generating proof…";
    case "submitting":
      return "Submitting…";
    default:
      return "Working…";
  }
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
