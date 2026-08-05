"use client";

import { Plus, Trash2 } from "lucide-react";

import { ActionButton, Field, Notice, PanelDivider } from "@/components/app/panel";

/**
 * Editor for the holdings committed to the Merkle tree.
 *
 * The tree's root is a public signal, so it commits to *every* row here — not
 * just the one being attested. Adding or removing a row changes the root and
 * invalidates any previously generated proof.
 *
 * Holdings are entered manually. Deriving them automatically would mean
 * enumerating token balances across the user's stealth addresses, which needs
 * an indexer NullOwn does not ship — see IMPLEMENTATION_REPORT.md.
 */

export interface HoldingRow {
  id: string;
  tokenId: string;
  quantity: string;
}

export function HoldingsEditor({
  rows,
  onChange,
  selectedId,
  onSelect,
}: {
  rows: HoldingRow[];
  onChange: (rows: HoldingRow[]) => void;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const update = (id: string, patch: Partial<HoldingRow>): void => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const add = (): void => {
    onChange([...rows, { id: crypto.randomUUID(), tokenId: "", quantity: "1" }]);
  };

  const remove = (id: string): void => {
    onChange(rows.filter((row) => row.id !== id));
  };

  return (
    <div className="flex flex-col gap-4">
      <PanelDivider label="Holdings" />

      <p className="text-sm leading-relaxed text-zinc-400">
        Every row is committed to the Merkle root. Select the one you want to attest — the others
        stay private but still shape the root.
      </p>

      {rows.length === 0 && (
        <Notice tone="info">Add at least one holding to build a tree.</Notice>
      )}

      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const isSelected = row.id === selectedId;
          return (
            <div
              key={row.id}
              className={
                isSelected
                  ? "border border-amber-500/40 bg-zinc-900/60 p-4"
                  : "border border-zinc-700/50 bg-zinc-900/30 p-4"
              }
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <label className="flex cursor-pointer items-center gap-2 pb-2 sm:pb-3">
                  <input
                    type="radio"
                    name="attested-holding"
                    checked={isSelected}
                    onChange={() => onSelect(row.id)}
                    className="h-4 w-4 accent-amber-500"
                    aria-label="Attest this holding"
                  />
                  <span className="text-xs uppercase tracking-wider text-zinc-500 sm:hidden">
                    Attest
                  </span>
                </label>

                <div className="flex-1">
                  <Field
                    label="Token ID"
                    inputMode="numeric"
                    placeholder="42"
                    value={row.tokenId}
                    onChange={(event) => update(row.id, { tokenId: event.target.value })}
                  />
                </div>

                <div className="flex-1">
                  <Field
                    label="Quantity"
                    inputMode="numeric"
                    placeholder="1"
                    value={row.quantity}
                    onChange={(event) => update(row.id, { quantity: event.target.value })}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => remove(row.id)}
                  disabled={rows.length === 1}
                  className="mb-1 p-2.5 text-zinc-500 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Remove holding"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ActionButton variant="secondary" onClick={add} className="w-fit">
        <Plus className="h-4 w-4" />
        Add Holding
      </ActionButton>

      <p className="text-xs leading-relaxed text-zinc-500">
        ERC-721 positions have quantity 1. ERC-1155 positions carry the real balance. Each leaf is
        Poseidon(tokenId, quantity), so both fields are cryptographically committed.
      </p>
    </div>
  );
}
