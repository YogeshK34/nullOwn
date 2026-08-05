"use client";

import React from "react"

import { motion } from "framer-motion";
import { Brain, Shield, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface FeatureItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const DEFAULT_FEATURES: FeatureItem[] = [
  {
    id: "1",
    icon: <Brain className="w-5 h-5 text-white" />,
    title: "Stealth Address Protocol",
    description:
      "ERC-5564 and ERC-6538 over secp256k1. Publish a meta-address once; every incoming transfer lands at a fresh one-time address with no linkable history.",
  },
  {
    id: "2",
    icon: <Shield className="w-5 h-5 text-white" />,
    title: "Zero-Knowledge Ownership Proofs",
    description:
      "A Circom circuit and Groth16 verifier attest that you hold at least a given quantity — without revealing the wallet, the token id, or the amount.",
  },
  {
    id: "3",
    icon: <Globe className="w-5 h-5 text-white" />,
    title: "Compliance Bridge",
    description:
      "Role-gated audit requests, logged immutably on-chain. Auditability and public transparency are separated rather than conflated.",
  },
  {
    id: "4",
    icon: <Brain className="w-5 h-5 text-white" />,
    title: "Non-Custodial by Construction",
    description:
      "Spend and view keys are generated in your browser and stored AES-GCM encrypted under your passphrase. No backend ever sees them.",
  },
  {
    id: "5",
    icon: <Shield className="w-5 h-5 text-white" />,
    title: "Single-Use Nullifiers",
    description:
      "Every proof carries a Poseidon nullifier the verifier records permanently, so an attestation cannot be captured and replayed by anyone else.",
  },
  {
    id: "6",
    icon: <Globe className="w-5 h-5 text-white" />,
    title: "Works With What You Hold",
    description:
      "An overlay, not a replacement. Existing ERC-721 and ERC-1155 assets are treated as black boxes — no token contract is modified or redeployed.",
  },
];

const containerVariants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      // `as const` keeps framer-motion's Easing union from widening to string.
      ease: "easeOut" as const,
    },
  },
};

interface FeaturesSectionProps {
  preHeading?: string;
  headline?: string;
  features?: FeatureItem[];
  className?: string;
}

export function FeaturesSection({
  preHeading = "Key Capabilities",
  headline = "Privacy That Survives Contact With Regulators",
  features = DEFAULT_FEATURES,
  className,
}: FeaturesSectionProps) {
  return (
    <section
      className={cn(
        "w-full bg-zinc-900 py-24 border-b border-zinc-700/30",
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col gap-6 mb-16"
        >
          <div className="flex items-center gap-3 px-4 py-2 border border-zinc-700 w-fit">
            <div className="w-2.5 h-2.5 bg-amber-500" />
            <span className="text-sm font-medium text-zinc-400 tracking-wide">
              {preHeading}
            </span>
          </div>
          <h2 className="text-balance text-white text-4xl md:text-5xl lg:text-6xl font-normal leading-[1.1] max-w-[700px] tracking-tight">
            {headline.split(" ").map((word, i) => (
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
          </h2>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16 mb-16"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.id}
              variants={itemVariants}
              className="flex flex-col group"
            >
              {/* Icon */}
              <div className="mb-8">
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-b from-amber-500 to-amber-700 shadow-lg shadow-amber-500/20 transform transition-transform group-hover:scale-110 duration-300">
                  {feature.icon}
                </div>
              </div>

              {/* Content */}
              <div className="flex flex-col gap-3">
                <h4 className="text-white text-xl font-medium tracking-tight font-sans">
                  {feature.title}
                </h4>
                <p className="text-balance text-zinc-400 text-base leading-relaxed font-sans">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button
            asChild
            size="lg"
            className="bg-white text-zinc-900 hover:bg-zinc-200 px-8"
          >
            <Link href="/stealth">Launch App</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-zinc-600 text-white hover:bg-zinc-800 bg-transparent px-8"
          >
            <Link href="/compliance">View Audit Log</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
