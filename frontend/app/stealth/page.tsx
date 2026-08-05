"use client";

import { AppShell } from "@/components/app/app-shell";
import { KeyManager } from "@/components/stealth/key-manager";
import { RegistryPanel } from "@/components/stealth/registry-panel";
import { ScannerPanel } from "@/components/stealth/scanner-panel";
import { SendPanel } from "@/components/stealth/send-panel";
import { useStealthKeys } from "@/hooks/useStealthKeys";

/**
 * Layer 1 — the stealth address protocol.
 *
 * Key state is owned here and passed down, so every panel reads the same
 * unlocked keys rather than each hook holding its own copy.
 */
export default function StealthPage() {
  const keyState = useStealthKeys();

  return (
    <AppShell
      badge="Layer 1 — Stealth Addresses"
      title="Receive Without Being Linked"
      intro="Generate a spend/view key pair, publish it to the ERC-6538 registry, and scan ERC-5564 announcements for payments only you can detect. Everything on this page runs in your browser; no key is ever transmitted."
    >
      <KeyManager keys={keyState} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RegistryPanel metaAddress={keyState.metaAddress} />
        <SendPanel />
      </div>

      <ScannerPanel keys={keyState.keys} />
    </AppShell>
  );
}
