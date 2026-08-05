"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Menu, Shield, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { AnimatedHeading, SectionBadge } from "./animated-heading";
import { ConfigBanner } from "./config-banner";

/**
 * Chrome shared by the three app routes.
 *
 * Deliberately mirrors the landing page's header rather than introducing a
 * separate app design: same logo treatment, same zinc/amber palette, same
 * square corners. The one addition is RainbowKit's connect button, themed in
 * `app/providers.tsx` to match.
 */

const NAV_LINKS = [
  { href: "/stealth", label: "Stealth" },
  { href: "/prove", label: "Prove" },
  { href: "/compliance", label: "Compliance" },
] as const;

export function AppShell({
  badge,
  title,
  intro,
  children,
}: {
  badge: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-900">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16 lg:px-16">
        <div className="mb-10 flex flex-col gap-6">
          <SectionBadge>{badge}</SectionBadge>
          <AnimatedHeading text={title} />
          <p className="max-w-2xl text-balance text-base leading-relaxed text-zinc-400">{intro}</p>
        </div>

        <ConfigBanner />

        <div className="flex flex-col gap-6">{children}</div>
      </main>

      <AppFooter />
    </div>
  );
}

function AppHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="relative z-50 border-b border-zinc-700/30 bg-zinc-900">
      <nav className="mx-auto max-w-7xl px-6 py-6 md:px-12 lg:px-16">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-white">
            <Shield className="h-5 w-5 text-amber-500" />
            <span className="font-medium">NullOwn</span>
          </Link>

          <div className="hidden items-center gap-6 text-sm text-white/70 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "transition-colors hover:text-white",
                  pathname === link.href && "text-white",
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <ConnectButton
              showBalance={false}
              accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
              chainStatus={{ smallScreen: "icon", largeScreen: "full" }}
            />

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white lg:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="mt-4 flex flex-col gap-4 border-t border-zinc-700/30 pt-4 lg:hidden">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "py-2 text-white/70 transition-colors hover:text-white",
                  pathname === link.href && "text-white",
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
}

function AppFooter() {
  return (
    <footer className="border-t border-zinc-700/30 bg-zinc-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between md:px-12 lg:px-16">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-500" />
          <span className="font-medium text-white">NullOwn</span>
        </Link>
        <p className="text-xs text-zinc-500">
          Testnet only. Keys and zero-knowledge proving run entirely in your browser.
        </p>
      </div>
    </footer>
  );
}
