"use client";

import React from "react"

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Shield, Zap, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Feature {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  image: string;
}

const features: Feature[] = [
  {
    id: 1,
    title: "1 – Receive",
    description:
      "Publish a stealth meta-address once. Senders derive a fresh one-time address for every transfer via ECDH, so nothing on the ledger links a payment back to your wallet.",
    icon: <Brain className="w-5 h-5" />,
    image: "/images/solution-learn.png",
  },
  {
    id: 2,
    title: "2 – Prove",
    description:
      "Generate a Groth16 proof in your browser and submit it on-chain. The contract verifies you meet a holding threshold without learning your address, token, or quantity.",
    icon: <Shield className="w-5 h-5" />,
    image: "/images/solution-detect.png",
  },
  {
    id: 3,
    title: "3 – Comply",
    description:
      "Pre-authorised regulators open scoped audit requests that are logged immutably on-chain. Only they can decrypt the response — the public sees that an audit happened, never its contents.",
    icon: <Zap className="w-5 h-5" />,
    image: "/images/solution-neutralize.png",
  },
];

export function SolutionSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % features.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      id="how-it-works"
      className="w-full bg-zinc-900 text-white py-24 flex flex-col items-center overflow-hidden border-b border-zinc-700/30"
    >
      <div className="max-w-7xl w-full px-6 md:px-12 lg:px-16 space-y-12">
        {/* Header Section */}
        <div className="flex flex-col gap-4 max-w-[560px]">
          <div className="flex items-center gap-3 px-4 py-2 border border-zinc-700 w-fit">
            <div className="w-2.5 h-2.5 bg-amber-500" />
            <span className="text-sm font-medium text-zinc-400 tracking-wide">
              How It Works
            </span>
          </div>
          <h2 className="text-balance text-4xl md:text-5xl font-normal leading-[1.1] tracking-tight text-white">
            {"Three Layers, One Overlay".split(" ").map((word, i) => (
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
          <p className="text-balance text-zinc-400 text-base leading-relaxed">
            NullOwn is a privacy overlay, not a new token. It issues nothing and modifies nothing —
            your existing ERC-721 and ERC-1155 assets are treated as black boxes. Stealth addresses
            hide where value lands, zero-knowledge proofs let you attest to what you hold, and a
            permissioned compliance bridge keeps regulators satisfied. All of it non-custodial:
            keys and proving stay in your browser.
          </p>
        </div>

        {/* Interactive Content Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[400px]">
          {/* Left: Image Display */}
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-800 group">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                className="absolute inset-0"
              >
                <img
                  src={features[activeIndex].image || "/placeholder.svg"}
                  alt={features[activeIndex].title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </motion.div>
            </AnimatePresence>

            {/* Progress indicator */}
            <div className="absolute bottom-4 left-4 right-4 h-1 flex gap-2">
              {features.map((_, idx) => (
                <div
                  key={idx}
                  className="h-full flex-1 bg-white/10 overflow-hidden"
                >
                  {activeIndex === idx && (
                    <motion.div
                      className="h-full bg-amber-500/80"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 8, ease: "linear" }}
                    />
                  )}
                  {idx < activeIndex && (
                    <div className="h-full w-full bg-amber-500/80" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Step List */}
          <div className="flex flex-col gap-4">
            {features.map((feature, index) => (
              <motion.button
                key={feature.id}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "group relative w-full text-left p-6 transition-all duration-300 outline-none",
                  activeIndex === index
                    ? "bg-white/[0.03] border border-white/10"
                    : "bg-transparent border border-transparent hover:bg-white/[0.01]"
                )}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "mt-1 p-2 transition-colors duration-300",
                      activeIndex === index
                        ? "bg-amber-500 text-black"
                        : "bg-white/5 text-zinc-500"
                    )}
                  >
                    {feature.icon}
                  </div>

                  <div className="flex-1 space-y-1">
                    <h3
                      className={cn(
                        "text-xl font-medium transition-colors duration-300",
                        activeIndex === index ? "text-white" : "text-zinc-500"
                      )}
                    >
                      {feature.title}
                    </h3>

                    <AnimatePresence>
                      {activeIndex === index && (
                        <motion.p
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="text-zinc-400 text-base leading-relaxed overflow-hidden"
                        >
                          {feature.description}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div
                    className={cn(
                      "mt-1.5 transition-all duration-300",
                      activeIndex === index
                        ? "opacity-100 translate-x-0"
                        : "opacity-0 -translate-x-2"
                    )}
                  >
                    <ChevronRight className="w-5 h-5 text-white/40" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Footer/CTA Area */}
        <div className="pt-12 flex justify-center border-t border-white/5">
          <motion.a
            href="/stealth"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-4 bg-white text-black font-medium flex items-center gap-2"
          >
            Set Up Stealth Keys
            <ChevronRight className="w-4 h-4" />
          </motion.a>
        </div>
      </div>
    </section>
  );
}
