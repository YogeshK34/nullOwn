"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, Trash2 } from "lucide-react";

import type { UseStealthKeysResult } from "@/hooks/useStealthKeys";
import { truncateHex } from "@/lib/stealth";
import {
  ActionButton,
  DataRow,
  Field,
  Notice,
  Panel,
  PanelDivider,
  StatusPill,
} from "@/components/app/panel";

/**
 * Generate, import, encrypt and unlock the stealth key pair.
 *
 * Private keys are shown only behind an explicit reveal, and the copy is blunt
 * about what losing them costs — there is no recovery path, by design.
 */
export function KeyManager({ keys: keyState }: { keys: UseStealthKeysResult }) {
  const {
    keys,
    metaAddress,
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
  } = keyState;

  const [passphrase, setPassphrase] = useState("");
  const [spendInput, setSpendInput] = useState("");
  const [viewInput, setViewInput] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [revealPrivate, setRevealPrivate] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const handleImport = (): void => {
    try {
      importFromPrivateKeys(spendInput, viewInput);
      setSpendInput("");
      setViewInput("");
      setShowImport(false);
    } catch {
      // Surfaced through `error` by the hook.
    }
  };

  const handleSave = async (): Promise<void> => {
    await persist(passphrase);
    setPassphrase("");
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3000);
  };

  const handleForget = (): void => {
    const confirmed = window.confirm(
      "Delete the encrypted keystore from this device?\n\n" +
        "Without a backup of the private keys this cannot be undone, and any assets held at " +
        "addresses derived from these keys become permanently unreachable.",
    );
    if (confirmed) forget();
  };

  return (
    <Panel
      title="Stealth Keys"
      description="Two secp256k1 key pairs. The view key detects incoming payments; the spend key moves them. Both are generated here and never leave your browser."
      accent
      action={<KeyStatusPill status={status} isHydrating={isHydrating} />}
    >
      {error && <Notice tone="danger">{error}</Notice>}

      {/* ---------------------------------------------------------------- */}
      {/* No keys in memory                                                 */}
      {/* ---------------------------------------------------------------- */}
      {!keys && (
        <div className="flex flex-col gap-6">
          {status === "locked" && (
            <div className="flex flex-col gap-4">
              <Notice tone="info" title="Encrypted keystore found on this device">
                {storedAt
                  ? `Saved ${new Date(storedAt).toLocaleString()}. Enter your passphrase to unlock.`
                  : "Enter your passphrase to unlock."}
              </Notice>
              <Field
                label="Passphrase"
                type="password"
                autoComplete="current-password"
                placeholder="Your keystore passphrase"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && passphrase) void unlock(passphrase);
                }}
              />
              <div className="flex flex-wrap gap-3">
                <ActionButton
                  onClick={() => void unlock(passphrase)}
                  busy={isBusy}
                  disabled={!passphrase}
                >
                  <Lock className="h-4 w-4" />
                  Unlock
                </ActionButton>
                <ActionButton variant="danger" onClick={handleForget}>
                  <Trash2 className="h-4 w-4" />
                  Delete Keystore
                </ActionButton>
              </div>
            </div>
          )}

          {status === "absent" && !isHydrating && (
            <div className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-zinc-400">
                Start by generating a fresh key pair, or import keys you already hold.
              </p>
              <div className="flex flex-wrap gap-3">
                <ActionButton onClick={() => generate()}>
                  <KeyRound className="h-4 w-4" />
                  Generate New Keys
                </ActionButton>
                <ActionButton variant="secondary" onClick={() => setShowImport(!showImport)}>
                  {showImport ? "Cancel Import" : "Import Existing Keys"}
                </ActionButton>
              </div>
            </div>
          )}

          {showImport && (
            <div className="flex flex-col gap-4">
              <PanelDivider label="Import" />
              <Field
                label="Spend private key"
                placeholder="0x…"
                value={spendInput}
                onChange={(event) => setSpendInput(event.target.value)}
              />
              <Field
                label="View private key"
                placeholder="0x…"
                value={viewInput}
                onChange={(event) => setViewInput(event.target.value)}
                hint="Both must be 32-byte secp256k1 scalars."
              />
              <ActionButton onClick={handleImport} disabled={!spendInput || !viewInput}>
                Import
              </ActionButton>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Keys unlocked                                                     */}
      {/* ---------------------------------------------------------------- */}
      {keys && metaAddress && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col">
            <DataRow label="Spend public key" value={keys.spend.publicKey} copyable />
            <DataRow label="View public key" value={keys.view.publicKey} copyable />
            <DataRow label="Meta-address" value={metaAddress.encoded} copyable />
          </div>

          <PanelDivider label="Private Keys" />

          {revealPrivate ? (
            <div className="flex flex-col gap-3">
              <Notice tone="danger" title="Anyone with these keys controls your assets">
                Store them offline. Never paste them into a website, a chat, or a support ticket.
              </Notice>
              <div className="flex flex-col">
                <DataRow label="Spend private key" value={keys.spend.privateKey} copyable />
                <DataRow label="View private key" value={keys.view.privateKey} copyable />
              </div>
              <ActionButton variant="secondary" onClick={() => setRevealPrivate(false)}>
                <EyeOff className="h-4 w-4" />
                Hide Private Keys
              </ActionButton>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="font-mono text-sm text-zinc-600">
                {truncateHex(keys.spend.privateKey, 4, 0).replace(/./g, "•")}
              </p>
              <ActionButton variant="secondary" onClick={() => setRevealPrivate(true)}>
                <Eye className="h-4 w-4" />
                Reveal Private Keys
              </ActionButton>
            </div>
          )}

          <PanelDivider label="Persistence" />

          {justSaved && (
            <Notice tone="success">Keys encrypted and saved to this browser.</Notice>
          )}

          <Field
            label={status === "locked" ? "Change passphrase" : "Encryption passphrase"}
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            hint="PBKDF2-SHA256 (600k iterations) derives an AES-256-GCM key. The passphrase itself is never stored, and there is no way to recover it."
          />

          <div className="flex flex-wrap gap-3">
            <ActionButton
              onClick={() => void handleSave()}
              busy={isBusy}
              disabled={passphrase.length < 8}
            >
              Encrypt &amp; Save
            </ActionButton>
            <ActionButton variant="secondary" onClick={lock}>
              <Lock className="h-4 w-4" />
              Lock Session
            </ActionButton>
            {status !== "absent" && (
              <ActionButton variant="danger" onClick={handleForget}>
                <Trash2 className="h-4 w-4" />
                Delete Keystore
              </ActionButton>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function KeyStatusPill({ status, isHydrating }: { status: string; isHydrating: boolean }) {
  if (isHydrating) return <StatusPill>Checking…</StatusPill>;
  if (status === "unlocked") return <StatusPill tone="success">Unlocked</StatusPill>;
  if (status === "locked") return <StatusPill tone="warning">Locked</StatusPill>;
  return <StatusPill>No keys</StatusPill>;
}
