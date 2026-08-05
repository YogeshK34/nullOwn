import React from "react"
import { PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The template filled this grid with third-party company wordmarks under a
 * "trusted by" heading. None of those companies endorse NullOwn, so the claim
 * could not stand. The grid, borders, plus-icon joins, hover and responsive
 * behaviour are unchanged; the cells now name the specifications and primitives
 * the system is actually built from, rendered as wordmarks.
 */

type Standard = {
  /** Primary wordmark, e.g. "ERC-5564". */
  name: string;
  /** Small caption beneath it. */
  caption: string;
};

type LogoCloudProps = React.ComponentProps<"div">;

export function LogoCloud({ className, ...props }: LogoCloudProps) {
  return (
    <div
      className={cn(
        "relative grid grid-cols-2 border-x border-zinc-700/30 md:grid-cols-4",
        className
      )}
      {...props}
    >
      <div className="-translate-x-1/2 -top-px pointer-events-none absolute left-1/2 w-screen border-t border-zinc-700/30" />

      <LogoCard
        className="relative border-r border-b border-zinc-700/30 bg-zinc-900"
        standard={{ name: "ERC-5564", caption: "Stealth addresses" }}
      >
        <PlusIcon
          className="-right-[12.5px] -bottom-[12.5px] absolute z-10 size-6 text-zinc-700/30"
          strokeWidth={1}
        />
      </LogoCard>

      <LogoCard
        className="border-b border-zinc-700/30 md:border-r bg-zinc-900"
        standard={{ name: "ERC-6538", caption: "Meta-address registry" }}
      />

      <LogoCard
        className="relative border-r border-b border-zinc-700/30 bg-zinc-900"
        standard={{ name: "Circom", caption: "Circuit DSL" }}
      >
        <PlusIcon
          className="-right-[12.5px] -bottom-[12.5px] absolute z-10 size-6 text-zinc-700/30"
          strokeWidth={1}
        />
        <PlusIcon
          className="-bottom-[12.5px] -left-[12.5px] absolute z-10 hidden size-6 md:block text-zinc-700/30"
          strokeWidth={1}
        />
      </LogoCard>

      <LogoCard
        className="relative border-b border-zinc-700/30 bg-zinc-900"
        standard={{ name: "Groth16", caption: "Proving scheme" }}
      />

      <LogoCard
        className="relative border-r border-b border-zinc-700/30 bg-zinc-900 md:border-b-0"
        standard={{ name: "Poseidon", caption: "ZK-friendly hash" }}
      >
        <PlusIcon
          className="-right-[12.5px] -bottom-[12.5px] md:-left-[12.5px] absolute z-10 size-6 md:hidden text-zinc-700/30"
          strokeWidth={1}
        />
      </LogoCard>

      <LogoCard
        className="border-b border-r border-zinc-700/30 bg-zinc-900 md:border-b-0"
        standard={{ name: "BN254", caption: "EIP-197 pairing" }}
      />

      <LogoCard
        className="border-r border-zinc-700/30 bg-zinc-900"
        standard={{ name: "secp256k1", caption: "ECDH derivation" }}
      />

      <LogoCard
        className="bg-zinc-900"
        standard={{ name: "OpenZeppelin", caption: "Access control" }}
      />

      <div className="-translate-x-1/2 -bottom-px pointer-events-none absolute left-1/2 w-screen border-b border-zinc-700/30" />
    </div>
  );
}

type LogoCardProps = React.ComponentProps<"div"> & {
  standard: Standard;
};

function LogoCard({ standard, className, children, ...props }: LogoCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 bg-zinc-900 px-4 py-8 md:p-8",
        className
      )}
      {...props}
    >
      <span className="select-none text-base font-medium tracking-tight text-white md:text-lg">
        {standard.name}
      </span>
      <span className="select-none text-center text-[11px] uppercase tracking-wider text-zinc-500">
        {standard.caption}
      </span>
      {children}
    </div>
  );
}
