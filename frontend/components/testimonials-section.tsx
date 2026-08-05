"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

/**
 * The template shipped this section as customer testimonials. NullOwn has no
 * customers to quote, and inventing named people to endorse it would be
 * fabricated social proof. The layout is preserved exactly — quote mark, body,
 * avatar slot, attribution — and repurposed to the public specifications the
 * system is built on, which is a claim a reader can actually verify.
 */

const foundations = [
  {
    id: 1,
    quote:
      "Defines how a sender derives a one-time address for a recipient and announces the ephemeral public key on-chain. NullOwn implements scheme 0 — secp256k1 with view tags — so recipients can reject the overwhelming majority of announcements after a single byte comparison.",
    author: "ERC-5564",
    role: "STEALTH ADDRESS PROTOCOL",
    avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=ERC5564&backgroundColor=b45309",
  },
  {
    id: 2,
    quote:
      "The public directory that makes stealth transfers usable. An investor registers a spend key and a view key once; any sender can then look them up and pay privately, with no prior handshake or off-chain coordination.",
    author: "ERC-6538",
    role: "STEALTH META-ADDRESS REGISTRY",
    avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=ERC6538&backgroundColor=6B5B95",
  },
  {
    id: 3,
    quote:
      "The proving scheme behind every ownership attestation. Proofs are constant-size and verify in milliseconds no matter how large the underlying statement is, which is what makes on-chain verification affordable at all.",
    author: "Groth16",
    role: "ZERO-KNOWLEDGE PROVING SCHEME",
    avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=Groth16&backgroundColor=88498F",
  },
  {
    id: 4,
    quote:
      "A hash function designed for arithmetic circuits rather than CPUs. Poseidon costs a few hundred constraints where keccak256 costs tens of thousands, which is why it backs both the Merkle tree and the nullifier derivation.",
    author: "Poseidon",
    role: "ZK-FRIENDLY HASH FUNCTION",
    avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=Poseidon&backgroundColor=C55A7B",
  },
  {
    id: 5,
    quote:
      "Ethereum's pairing precompile over the alt_bn128 curve. Without it, verifying a Groth16 proof on-chain would be prohibitively expensive; with it, verification settles at a fixed and predictable cost.",
    author: "EIP-197 / BN254",
    role: "ELLIPTIC CURVE PAIRING PRECOMPILE",
    avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=BN254&backgroundColor=4A5899",
  },
  {
    id: 6,
    quote:
      "The token standards NullOwn operates over. Both are treated strictly as black boxes — no RWA contract is modified, redeployed, or wrapped — so the privacy layer can be adopted without touching an existing issuance.",
    author: "ERC-721 / ERC-1155",
    role: "SUPPORTED RWA TOKEN STANDARDS",
    avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=ERC721&backgroundColor=6B7280",
  },
];

export function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % foundations.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? foundations.length - 1 : prev - 1
    );
  };

  return (
    <section className="w-full bg-zinc-900 py-24 md:py-32 border-b border-zinc-700/30">
      <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-16">
        {/* Header */}
        <div className="flex flex-col gap-6 mb-16">
          <div className="flex items-center gap-3 px-4 py-2 border border-zinc-700 w-fit">
            <div className="w-2.5 h-2.5 bg-amber-500" />
            <span className="text-sm font-medium text-zinc-400 tracking-wide">
              Foundations
            </span>
          </div>
          <div className="flex items-center justify-between gap-8">
            <h2 className="text-balance text-4xl md:text-5xl font-normal text-white">
              {"Built On Open Standards, Not On Trust.".split(" ").map((word, i) => (
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
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={prevTestimonial}
                className="p-3 border border-zinc-700 bg-transparent text-white hover:bg-zinc-800 transition-colors"
                aria-label="Previous standard"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextTestimonial}
                className="p-3 border border-zinc-700 bg-transparent text-white hover:bg-zinc-800 transition-colors"
                aria-label="Next standard"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Foundations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {foundations
            .slice(currentIndex, currentIndex + 3)
            .concat(
              foundations.slice(
                0,
                Math.max(0, currentIndex + 3 - foundations.length)
              )
            )
            .map((foundation, index) => (
              <div
                key={foundation.id}
                className={`p-8 border-zinc-700/30 ${
                  index !== 2 ? "md:border-r border-b md:border-b-0" : ""
                }`}
              >
                {/* Quote Icon */}
                <div className="text-amber-500 text-4xl font-bold mb-6">"</div>

                {/* Body */}
                <p className="text-white text-base leading-relaxed mb-8 min-h-[200px]">
                  {foundation.quote}
                </p>

                {/* Attribution */}
                <div className="flex items-center gap-4">
                  <img
                    src={foundation.avatar || "/placeholder.svg"}
                    alt=""
                    aria-hidden="true"
                    className="w-12 h-12 object-cover"
                  />
                  <div>
                    <div className="text-white font-medium text-sm">
                      {foundation.author}
                    </div>
                    <div className="text-zinc-500 text-xs uppercase tracking-wider">
                      {foundation.role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
