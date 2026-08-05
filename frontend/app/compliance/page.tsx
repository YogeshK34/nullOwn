"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "ethers";
import { ExternalLink, FileSearch, Lock, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import type { Address } from "viem";

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
import { useCompliance, type AuditRecord } from "@/hooks/useCompliance";
import { chainId } from "@/lib/env";
import { explorerTxUrl } from "@/lib/chains";

/**
 * Layer 3 — the compliance bridge.
 *
 * The audit log is public to everyone: the point is that audit *activity* is
 * transparent even though audit *contents* are not. Write paths are gated by
 * on-chain roles rather than by hiding UI, so an unauthorised user sees exactly
 * why they cannot act.
 */
export default function CompliancePage() {
  const compliance = useCompliance();

  return (
    <AppShell
      badge="Layer 3 — Compliance Bridge"
      title="Auditable Without Being Public"
      intro="Pre-authorised regulators open scoped audit requests that are recorded on-chain permanently. The response is ciphertext only the regulator can open. Everyone can see that an audit happened; nobody else can see what it disclosed."
    >
      <RolePanel compliance={compliance} />

      {compliance.isRegulator && <RequestAuditPanel compliance={compliance} />}
      {compliance.isAdmin && <AdminPanel compliance={compliance} />}

      <AuditLogPanel compliance={compliance} />
    </AppShell>
  );
}

type ComplianceState = ReturnType<typeof useCompliance>;

function RolePanel({ compliance }: { compliance: ComplianceState }) {
  const { address, isConnected } = useAccount();

  return (
    <Panel
      title="Your Access"
      description="Roles are read from the contract's AccessControl state. Nothing here is enforced by the interface alone."
      accent
      action={
        compliance.isRoleLoading ? (
          <StatusPill>Checking…</StatusPill>
        ) : compliance.isAdmin ? (
          <StatusPill tone="success">Admin</StatusPill>
        ) : compliance.isRegulator ? (
          <StatusPill tone="info">Regulator</StatusPill>
        ) : (
          <StatusPill>Public</StatusPill>
        )
      }
    >
      {!compliance.isConfigured && (
        <Notice tone="warning">
          Compliance module address is unset. Set NEXT_PUBLIC_COMPLIANCE_ADDRESS to enable this
          page.
        </Notice>
      )}

      {!isConnected ? (
        <Notice tone="info">
          Connect a wallet to see your role. The audit log below is readable either way.
        </Notice>
      ) : (
        <div className="flex flex-col">
          <DataRow label="Account" value={address ?? "—"} />
          <DataRow
            label="REGULATOR_ROLE"
            value={compliance.isRegulator ? "Granted" : "Not granted"}
            mono={false}
          />
          <DataRow
            label="DEFAULT_ADMIN_ROLE"
            value={compliance.isAdmin ? "Granted" : "Not granted"}
            mono={false}
          />
        </div>
      )}

      {isConnected && !compliance.isRegulator && !compliance.isAdmin && (
        <Notice tone="neutral" title="No privileged access">
          You can read every audit record but cannot open or answer requests. That is the intended
          default — the general public never gains access to ownership data.
        </Notice>
      )}
    </Panel>
  );
}

function RequestAuditPanel({ compliance }: { compliance: ComplianceState }) {
  const [scope, setScope] = useState("");
  const [localError, setLocalError] = useState<string | undefined>();

  const submit = (): void => {
    setLocalError(undefined);
    try {
      compliance.requestAudit(scope);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "Invalid scope.");
    }
  };

  return (
    <Panel
      title="Open an Audit Request"
      description="The request is written to the chain immediately and cannot be withdrawn. Scope is a short jurisdiction or asset-class tag."
    >
      <Field
        label="Scope"
        placeholder="EU-MiCA"
        value={scope}
        onChange={(event) => setScope(event.target.value)}
        hint="Packed into bytes32, so at most 31 bytes once UTF-8 encoded."
      />

      {localError && <Notice tone="danger">{localError}</Notice>}
      {compliance.writeError && (
        <Notice tone="danger" title="Transaction failed">
          {compliance.writeError.message}
        </Notice>
      )}
      {compliance.isConfirmed && compliance.txHash && (
        <Notice tone="success" title="Request recorded">
          <TxLink hash={compliance.txHash} />
        </Notice>
      )}

      <ActionButton
        onClick={submit}
        busy={compliance.isWriting || compliance.isConfirming}
        disabled={!scope.trim()}
      >
        <FileSearch className="h-4 w-4" />
        {compliance.isWriting
          ? "Confirm in wallet…"
          : compliance.isConfirming
            ? "Waiting for confirmation…"
            : "Submit Request"}
      </ActionButton>
    </Panel>
  );
}

function AdminPanel({ compliance }: { compliance: ComplianceState }) {
  const [regulatorAddress, setRegulatorAddress] = useState("");
  const [auditId, setAuditId] = useState("");
  const [payload, setPayload] = useState("");

  const validAddress = isAddress(regulatorAddress);
  const openAudits = compliance.audits.filter((audit) => !audit.fulfilled);

  return (
    <Panel
      title="Administration"
      description="Grant or revoke regulator access, and answer open requests with ciphertext."
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Regulator address"
          placeholder="0x…"
          value={regulatorAddress}
          onChange={(event) => setRegulatorAddress(event.target.value)}
        />

        {regulatorAddress && !validAddress && (
          <Notice tone="warning">Not a valid Ethereum address.</Notice>
        )}

        <div className="flex flex-wrap gap-3">
          <ActionButton
            onClick={() => compliance.grantRegulator(regulatorAddress as Address)}
            busy={compliance.isWriting}
            disabled={!validAddress}
          >
            <UserPlus className="h-4 w-4" />
            Grant REGULATOR_ROLE
          </ActionButton>
          <ActionButton
            variant="danger"
            onClick={() => compliance.revokeRegulator(regulatorAddress as Address)}
            busy={compliance.isWriting}
            disabled={!validAddress}
          >
            Revoke
          </ActionButton>
        </div>
      </div>

      <PanelDivider label="Fulfil a Request" />

      {openAudits.length === 0 ? (
        <Notice tone="neutral">No open requests.</Notice>
      ) : (
        <p className="text-sm text-zinc-400">
          Open request {openAudits.length === 1 ? "id" : "ids"}:{" "}
          <span className="font-mono text-zinc-200">
            {openAudits.map((audit) => audit.id).join(", ")}
          </span>
        </p>
      )}

      <Field
        label="Audit ID"
        inputMode="numeric"
        placeholder="0"
        value={auditId}
        onChange={(event) => setAuditId(event.target.value)}
      />

      <Field
        label="Encrypted response"
        placeholder="0x… ciphertext"
        value={payload}
        onChange={(event) => setPayload(event.target.value)}
        hint="Encrypt off-chain against the regulator's audit key before pasting. This contract never sees plaintext and holds no decryption key — anything readable pasted here becomes permanently public."
      />

      <Notice tone="warning" title="Whatever you write here is permanent and public">
        The audit log is append-only. A response cannot be replaced or deleted once recorded, so
        plaintext pasted by mistake is exposed forever.
      </Notice>

      <ActionButton
        onClick={() => compliance.fulfillAudit(Number(auditId), payload)}
        busy={compliance.isWriting || compliance.isConfirming}
        disabled={!auditId.trim() || !payload.trim()}
      >
        <Lock className="h-4 w-4" />
        Fulfil Audit
      </ActionButton>
    </Panel>
  );
}

function AuditLogPanel({ compliance }: { compliance: ComplianceState }) {
  return (
    <Panel
      title="Audit Log"
      description="Every request ever opened, newest first. Publicly readable by design — transparency of audit activity is the point."
      action={
        <ActionButton
          variant="secondary"
          onClick={() => void compliance.refresh()}
          busy={compliance.isLoading}
          className="px-3 py-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </ActionButton>
      }
    >
      {compliance.error && <Notice tone="danger">{compliance.error}</Notice>}

      {!compliance.isConfigured ? (
        <Notice tone="warning">Compliance module address is unset.</Notice>
      ) : compliance.audits.length === 0 && !compliance.isLoading ? (
        <Notice tone="neutral">No audits have been requested yet.</Notice>
      ) : (
        <div className="flex flex-col gap-4">
          {compliance.audits.map((audit) => (
            <AuditCard key={audit.id} audit={audit} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function AuditCard({ audit }: { audit: AuditRecord }) {
  return (
    <div className="border border-zinc-700/50 bg-zinc-900/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-white">
          Audit #{audit.id} · {audit.scopeLabel}
        </span>
        {audit.fulfilled ? (
          <StatusPill tone="success">Fulfilled</StatusPill>
        ) : (
          <StatusPill tone="warning">Open</StatusPill>
        )}
      </div>

      <div className="flex flex-col">
        <DataRow label="Requested by" value={audit.regulator} />
        <DataRow
          label="Requested at"
          value={new Date(audit.timestamp * 1000).toLocaleString()}
          mono={false}
        />
        <DataRow label="Scope (bytes32)" value={audit.scope} />
      </div>

      {audit.fulfilled && (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Encrypted response
          </div>
          <p className="max-h-24 overflow-y-auto break-all font-mono text-xs text-zinc-500">
            {audit.encryptedResponse}
          </p>
          <p className="text-xs leading-relaxed text-zinc-600">
            Readable by anyone, meaningful only to the holder of the audit key.
          </p>
        </div>
      )}
    </div>
  );
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
