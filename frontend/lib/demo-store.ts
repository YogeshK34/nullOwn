import { encodeBytes32String, hexlify, toUtf8Bytes } from "ethers";
import type { Address } from "viem";

import {
  DEMO_AUDITS,
  DEMO_RECIPIENT,
  DEMO_REGULATORS,
  demoMetaAddressFor,
  type DemoAudit,
} from "./demo";

/**
 * Mutable state behind demo mode.
 *
 * Demo writes have to be visible to more than the panel that made them — a
 * registration made on the registry panel must show up when the send panel
 * looks the same address up, and an audit request must appear in the log below
 * it. React state inside a hook cannot do that, so the demo keeps one store
 * here and every hook instance subscribes to it via `useSyncExternalStore`.
 *
 * Snapshots are replaced rather than mutated, which is what makes
 * `useSyncExternalStore` safe: identity changes exactly when the data changes,
 * so it neither misses an update nor loops.
 *
 * Nothing persists. A reload restores the fixtures, which is the right default
 * for a demo — every run starts from the same known state.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeDemoStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// Registry (ERC-6538)
// ---------------------------------------------------------------------------

/** account (lowercase) → encoded 66-byte meta-address. */
let registrations: Readonly<Record<string, string>> = {
  [DEMO_RECIPIENT.toLowerCase()]: demoMetaAddressFor(DEMO_RECIPIENT).encoded,
};

export function getDemoRegistrations(): Readonly<Record<string, string>> {
  return registrations;
}

/**
 * Registry entry for an account.
 *
 * Takes the snapshot as an argument rather than reading module state, so it
 * stays pure and callers can drive it straight from `useSyncExternalStore`.
 *
 * Accounts nobody has explicitly registered still resolve, to a meta-address
 * derived from the address itself. That keeps the send flow demonstrable
 * against any address the user types instead of dead-ending on "recipient has
 * not registered" — the one state a demo cannot escape from.
 *
 * The connected account is the exception: it stays unregistered until the user
 * registers it, so the registry panel has a before and an after.
 */
export function demoRegistrationFor(
  snapshot: Readonly<Record<string, string>>,
  account: string,
  connected: string | undefined,
): string | undefined {
  const lower = account.toLowerCase();
  const explicit = snapshot[lower];
  if (explicit) return explicit;
  if (connected && lower === connected.toLowerCase()) return undefined;
  return demoMetaAddressFor(lower).encoded;
}

export function setDemoRegistration(account: string, encoded: string): void {
  registrations = { ...registrations, [account.toLowerCase()]: encoded };
  emit();
}

// ---------------------------------------------------------------------------
// Compliance roles
// ---------------------------------------------------------------------------

let regulators: readonly string[] = DEMO_REGULATORS.map((address) => address.toLowerCase());

export function getDemoRegulators(): readonly string[] {
  return regulators;
}

export function isDemoRegulator(account: string | undefined): boolean {
  return account !== undefined && regulators.includes(account.toLowerCase());
}

export function setDemoRegulator(account: Address, granted: boolean): void {
  const lower = account.toLowerCase();
  const has = regulators.includes(lower);
  if (granted === has) return;

  regulators = granted ? [...regulators, lower] : regulators.filter((entry) => entry !== lower);
  emit();
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

let audits: readonly DemoAudit[] = DEMO_AUDITS;

export function getDemoAudits(): readonly DemoAudit[] {
  return audits;
}

/** Append a request, mirroring `ComplianceModule.requestAudit`. */
export function addDemoAudit(regulator: Address, scopeLabel: string): void {
  const trimmed = scopeLabel.trim();
  if (trimmed.length === 0) throw new Error("Audit scope cannot be empty.");
  if (toUtf8Bytes(trimmed).length > 31) {
    throw new Error("Audit scope must be 31 bytes or fewer once UTF-8 encoded.");
  }

  audits = [
    ...audits,
    {
      id: audits.length,
      regulator,
      scope: encodeBytes32String(trimmed),
      scopeLabel: trimmed,
      timestamp: Math.floor(Date.now() / 1000),
      fulfilled: false,
      encryptedResponse: "0x",
    },
  ];
  emit();
}

/** Answer a request, mirroring `ComplianceModule.fulfillAudit`. */
export function fulfillDemoAudit(auditId: number, encryptedData: string): void {
  const target = audits.find((audit) => audit.id === auditId);
  if (!target) throw new Error(`No audit with id ${auditId}.`);
  if (target.fulfilled) throw new Error(`Audit ${auditId} has already been answered.`);

  const trimmed = encryptedData.trim();
  const payload = /^0x[0-9a-fA-F]*$/.test(trimmed) ? trimmed : hexlify(toUtf8Bytes(trimmed));

  audits = audits.map((audit) =>
    audit.id === auditId ? { ...audit, fulfilled: true, encryptedResponse: payload } : audit,
  );
  emit();
}
