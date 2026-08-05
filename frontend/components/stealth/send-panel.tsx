"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "ethers";
import { Megaphone, Sigma } from "lucide-react";
import type { Address } from "viem";

import { useStealthRegistry } from "@/hooks/useStealthRegistry";
import { useStealthAnnouncer } from "@/hooks/useStealthAnnouncer";
import { computeStealthAddress, type StealthPayment } from "@/lib/stealth";
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
 * Sender side of a stealth transfer.
 *
 * Look up a recipient's registered meta-address, derive a one-time address for
 * them, then announce the ephemeral key so they can find it. The asset transfer
 * itself happens through the token contract and is deliberately outside this
 * flow — NullOwn does not wrap or modify RWA tokens.
 */
export function SendPanel() {
  const { isConnected } = useAccount();
  const [recipient, setRecipient] = useState("");
  const [payment, setPayment] = useState<StealthPayment | undefined>();
  const [deriveError, setDeriveError] = useState<string | undefined>();

  const lookupTarget = isAddress(recipient) ? (recipient as Address) : undefined;
  const { registered, isLoading, decodeError } = useStealthRegistry(lookupTarget);
  const { announce, isAnnouncing, isConfirming, isConfirmed, error, isConfigured } =
    useStealthAnnouncer();

  const handleDerive = (): void => {
    if (!registered) return;
    try {
      // Fresh ephemeral key every call — reusing one would collapse two
      // payments onto the same stealth address.
      setPayment(computeStealthAddress(registered.encoded));
      setDeriveError(undefined);
    } catch (cause) {
      setDeriveError(cause instanceof Error ? cause.message : "Derivation failed.");
      setPayment(undefined);
    }
  };

  return (
    <Panel
      title="Send Privately"
      description="Derive a one-time address for a registered recipient and publish the announcement they need to discover it."
      action={
        payment ? <StatusPill tone="success">Address derived</StatusPill> : <StatusPill>Idle</StatusPill>
      }
    >
      <Field
        label="Recipient address"
        placeholder="0x… the recipient's public wallet address"
        value={recipient}
        onChange={(event) => {
          setRecipient(event.target.value);
          setPayment(undefined);
        }}
        hint="Their registry entry is looked up by this address. The stealth address you derive will have no on-chain link to it."
      />

      {recipient && !isAddress(recipient) && (
        <Notice tone="warning">Not a valid Ethereum address.</Notice>
      )}

      {lookupTarget && isLoading && <Notice tone="neutral">Reading registry…</Notice>}

      {lookupTarget && !isLoading && !registered && !decodeError && (
        <Notice tone="warning" title="Recipient has not registered">
          They must publish a stealth meta-address before they can receive private transfers.
        </Notice>
      )}

      {decodeError && <Notice tone="danger">{decodeError}</Notice>}

      {registered && (
        <>
          <div className="flex flex-col">
            <DataRow label="Their spend key" value={registered.spendPublicKey} />
            <DataRow label="Their view key" value={registered.viewPublicKey} />
          </div>

          <ActionButton onClick={handleDerive}>
            <Sigma className="h-4 w-4" />
            Derive Stealth Address
          </ActionButton>
        </>
      )}

      {deriveError && <Notice tone="danger">{deriveError}</Notice>}

      {payment && (
        <div className="flex flex-col gap-4">
          <PanelDivider label="One-Time Address" />

          <div className="flex flex-col">
            <DataRow label="Stealth address" value={payment.stealthAddress} copyable />
            <DataRow label="Ephemeral key" value={payment.ephemeralPublicKey} copyable />
            <DataRow label="View tag" value={`0x${payment.viewTag.toString(16).padStart(2, "0")}`} />
          </div>

          <Notice tone="info" title="Two independent steps">
            {"1. Transfer the RWA token to the stealth address above, using the token contract's own transfer function.\n" +
              "2. Announce the ephemeral key below, so the recipient can discover the payment.\n\n" +
              "NullOwn never touches your token contract, so step 1 happens outside this app."}
          </Notice>

          {error && (
            <Notice tone="danger" title="Announcement failed">
              {error.message}
            </Notice>
          )}

          {isConfirmed && (
            <Notice tone="success">
              Announcement published. The recipient can now discover this payment by scanning.
            </Notice>
          )}

          <ActionButton
            onClick={() => announce(payment)}
            busy={isAnnouncing || isConfirming}
            disabled={!isConfigured || !isConnected}
          >
            <Megaphone className="h-4 w-4" />
            {isAnnouncing
              ? "Confirm in wallet…"
              : isConfirming
                ? "Waiting for confirmation…"
                : "Publish Announcement"}
          </ActionButton>

          {!isConfigured && (
            <Notice tone="warning">
              Announcer address is unset. Set NEXT_PUBLIC_ERC5564_ADDRESS to publish.
            </Notice>
          )}
        </div>
      )}
    </Panel>
  );
}
