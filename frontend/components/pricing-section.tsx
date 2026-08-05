"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The template shipped this as a pricing table. NullOwn is an open-source,
 * testnet-only privacy layer — it has no plans to sell, and inventing tiers
 * would describe a product that does not exist. The three-column layout, the
 * binary toggle, the highlighted middle card and the checked list are all
 * preserved, and now carry the three architecture layers: what each one does,
 * and which specification it implements.
 */

interface ArchitectureLayer {
  id: string;
  name: string;
  /** Rendered in the large numeral slot. */
  headline: string;
  description: string;
  capabilities: string[];
  standards: string[];
  cta: string;
  href: string;
  /** Highlights the middle card, as the template's "popular" plan did. */
  core?: boolean;
}

const layers: ArchitectureLayer[] = [
  {
    id: "stealth",
    name: "Stealth Layer",
    headline: "ERC-5564",
    description:
      "Receive tokenized assets at one-time addresses that carry no linkable history.",
    capabilities: [
      "Spend and view key generation",
      "On-chain meta-address registry",
      "ECDH one-time address derivation",
      "View-tag filtered announcement scanning",
    ],
    standards: [
      "ERC-5564 announcements",
      "ERC-6538 meta-address registry",
      "secp256k1 ECDH",
      "keccak256 shared-secret hashing",
    ],
    cta: "Set Up Keys",
    href: "/stealth",
  },
  {
    id: "proof",
    name: "Proof Layer",
    headline: "Groth16",
    description:
      "Attest to a holding threshold on-chain without revealing the wallet, token, or amount.",
    capabilities: [
      "Browser-side witness generation",
      "Poseidon Merkle inclusion proofs",
      "Constant-size on-chain verification",
      "Single-use nullifiers block replay",
      "Off-chain pre-verification",
    ],
    standards: [
      "Circom 2.x circuits",
      "Groth16 over BN254",
      "EIP-197 pairing precompile",
      "Poseidon hash, depth-20 tree",
      "SnarkJS WASM prover",
    ],
    cta: "Generate a Proof",
    href: "/prove",
    core: true,
  },
  {
    id: "compliance",
    name: "Compliance Layer",
    headline: "RBAC",
    description:
      "Give regulators scoped, permissioned disclosure without opening the data to the public.",
    capabilities: [
      "Role-gated audit requests",
      "Immutable on-chain audit log",
      "Encrypted, regulator-only responses",
      "Public visibility of audit activity",
      "Admin-managed role assignment",
    ],
    standards: [
      "OpenZeppelin AccessControl v5",
      "REGULATOR_ROLE / DEFAULT_ADMIN_ROLE",
      "Append-only audit records",
      "Off-chain payload encryption",
      "Scoped bytes32 jurisdiction tags",
    ],
    cta: "Open Audit Log",
    href: "/compliance",
  },
];

export function PricingSection() {
  const [showStandards, setShowStandards] = useState(false);

  return (
    <section
      id="architecture"
      className="w-full bg-zinc-900 py-24 md:py-32 border-b border-zinc-700/30"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-16">
        {/* Header */}
        <div className="mb-16 flex flex-col gap-4">
          <div className="flex items-center gap-3 px-4 py-2 border border-zinc-700 w-fit">
            <div className="w-2.5 h-2.5 bg-amber-500" />
            <span className="text-sm font-medium text-zinc-400 tracking-wide">Architecture</span>
          </div>
          <h2 className="text-balance text-4xl md:text-5xl tracking-tight leading-tight font-normal text-white">
            <span className="block">
              {"Three layers".split(" ").map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ filter: "blur(10px)", opacity: 0 }}
                  whileInView={{ filter: "blur(0px)", opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="inline-block mr-[0.25em]"
                >
                  {word}
                </motion.span>
              ))}
            </span>
            <span className="block text-zinc-500">
              {"that never leak into each other".split(" ").map((word, i) => (
                <motion.span
                  key={i + 3}
                  initial={{ filter: "blur(10px)", opacity: 0 }}
                  whileInView={{ filter: "blur(0px)", opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: (i + 3) * 0.05 }}
                  className="inline-block mr-[0.25em]"
                >
                  {word}
                </motion.span>
              ))}
            </span>
          </h2>
        </div>

        {/* Switch and Layers Container */}
        <div className="flex flex-col gap-10 w-full">
          {/* Capabilities / Standards Toggle */}
          <div className="flex items-center gap-4">
            <span
              className={cn(
                "text-lg transition-colors duration-200",
                !showStandards ? "text-white" : "text-zinc-500"
              )}
            >
              Capabilities
            </span>

            <button
              onClick={() => setShowStandards(!showStandards)}
              className="relative w-12 h-6 bg-zinc-800 cursor-pointer p-1"
              aria-label="Toggle between capabilities and standards"
            >
              <motion.div
                animate={{
                  x: showStandards ? 24 : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                }}
                className="w-4 h-4 bg-white"
              />
            </button>

            <span
              className={cn(
                "text-lg transition-colors duration-200",
                showStandards ? "text-white" : "text-zinc-500"
              )}
            >
              Standards
            </span>

            <div className="bg-amber-500/10 px-3 py-1.5 border border-amber-500/20">
              <span className="text-xs font-medium text-amber-500">
                TESTNET
              </span>
            </div>
          </div>

          {/* Layer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {layers.map((layer) => (
              <motion.div
                key={layer.id}
                whileHover={{
                  scale: 1.02,
                }}
                className={cn(
                  "relative flex flex-col gap-6 p-6 transition-all duration-300",
                  layer.core
                    ? "bg-zinc-800 border border-amber-500/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                    : "bg-zinc-800/50 border border-zinc-700/50"
                )}
              >
                {/* Card Head */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-normal text-white">
                      {layer.name}
                    </span>
                    {layer.core && (
                      <div className="bg-amber-500/10 border border-amber-500/20 px-2.5 py-1">
                        <span className="text-xs font-medium text-amber-500">
                          Core
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1">
                    <h3 className="text-4xl font-normal text-white tracking-tighter">
                      {layer.headline}
                    </h3>
                  </div>

                  <p className="text-balance text-sm leading-relaxed text-zinc-400 min-h-[40px]">
                    {layer.description}
                  </p>
                </div>

                {/* CTA */}
                <Link
                  href={layer.href}
                  className={cn(
                    "w-full py-3 px-4 text-sm font-medium text-center transition-all duration-200 cursor-pointer",
                    layer.core
                      ? "bg-white text-zinc-900 hover:bg-zinc-200"
                      : "bg-transparent text-white border border-zinc-600 hover:bg-white/5"
                  )}
                >
                  {layer.cta}
                </Link>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-[1px] bg-zinc-700" />
                  <span className="text-xs text-zinc-500 shrink-0">
                    {showStandards ? "Standards" : "Capabilities"}
                  </span>
                  <div className="flex-1 h-[1px] bg-zinc-700" />
                </div>

                {/* Detail List */}
                <ul className="flex flex-col gap-3">
                  {(showStandards ? layer.standards : layer.capabilities).map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 group">
                      <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
