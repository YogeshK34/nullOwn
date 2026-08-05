"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Surface primitives for the app routes, matching the landing page's card
 * treatment: square corners, zinc panels, amber for emphasis.
 */

export function Panel({
  title,
  description,
  accent = false,
  className,
  children,
  action,
}: {
  title?: string;
  description?: string;
  /** Amber border, mirroring the landing page's highlighted card. */
  accent?: boolean;
  className?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-6 p-6",
        accent
          ? "bg-zinc-800 border border-amber-500/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
          : "bg-zinc-800/50 border border-zinc-700/50",
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            {title && <h2 className="text-xl font-normal text-white">{title}</h2>}
            {description && (
              <p className="text-balance text-sm leading-relaxed text-zinc-400">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {!title && description && (
        <p className="text-balance text-sm leading-relaxed text-zinc-400">{description}</p>
      )}
      {children}
    </section>
  );
}

/** Labelled divider, reused from the landing page's pricing card. */
export function PanelDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-[1px] bg-zinc-700" />
      <span className="text-xs text-zinc-500 shrink-0">{label}</span>
      <div className="flex-1 h-[1px] bg-zinc-700" />
    </div>
  );
}

export type ToneName = "neutral" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<ToneName, string> = {
  neutral: "bg-zinc-700/30 border-zinc-600/50 text-zinc-300",
  success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  warning: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  danger: "bg-red-500/10 border-red-500/30 text-red-400",
  info: "bg-sky-500/10 border-sky-500/30 text-sky-400",
};

export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: ToneName;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border px-2.5 py-1 text-xs font-medium",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Key/value row for the many hex values these screens display. */
export function DataRow({
  label,
  value,
  mono = true,
  copyable = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  /** Requires `value` to be a string. */
  copyable?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-zinc-700/30 py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <span className="text-xs uppercase tracking-wider text-zinc-500 shrink-0">{label}</span>
      <div className={cn("min-w-0 text-sm text-zinc-200", mono && "font-mono")}>
        {copyable && typeof value === "string" ? (
          <CopyableValue value={value} />
        ) : (
          <span className="break-all">{value}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Click-to-copy value.
 *
 * Falls back silently when the clipboard API is unavailable — an insecure
 * context or a denied permission should not surface as an error the user
 * cannot act on.
 */
export function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Nothing useful to tell the user here.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="group inline-flex max-w-full items-start gap-2 text-left transition-colors hover:text-white"
      title="Copy to clipboard"
    >
      <span className="break-all">{value}</span>
      {copied ? (
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
      ) : (
        <Copy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-300" />
      )}
    </button>
  );
}

/** Primary / secondary buttons matching the landing page treatment. */
export function ActionButton({
  variant = "primary",
  busy = false,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "danger";
  busy?: boolean;
}) {
  const variants = {
    primary: "bg-white text-zinc-900 hover:bg-zinc-200 disabled:hover:bg-white",
    secondary:
      "bg-transparent text-white border border-zinc-600 hover:bg-white/5 disabled:hover:bg-transparent",
    danger:
      "bg-transparent text-red-400 border border-red-500/40 hover:bg-red-500/10 disabled:hover:bg-transparent",
  } as const;

  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={cn(
        "inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        className,
      )}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Text input styled to the surrounding panels. */
export function Field({
  label,
  hint,
  className,
  ...props
}: React.ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-wider text-zinc-500">{label}</span>
      <input
        {...props}
        className={cn(
          "w-full border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 font-mono text-sm text-white",
          "placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      />
      {hint && <span className="text-xs leading-relaxed text-zinc-500">{hint}</span>}
    </label>
  );
}

/** Inline message block for errors, warnings and confirmations. */
export function Notice({
  tone = "warning",
  title,
  children,
}: {
  tone?: ToneName;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("border px-4 py-3 text-sm", toneClasses[tone])}>
      {title && <p className="mb-1 font-medium">{title}</p>}
      <div className="leading-relaxed whitespace-pre-line opacity-90">{children}</div>
    </div>
  );
}
