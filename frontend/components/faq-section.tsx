"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    id: "1",
    question: "Does NullOwn hold my keys or my assets?",
    answer:
      "No. Spend and view keys are generated in your browser and stored only in localStorage, AES-GCM encrypted under a passphrase you choose. Zero-knowledge proofs are generated client-side too, so the witness — your token id, quantity and spend key hash — never crosses the network. There is no backend that could custody anything.",
  },
  {
    id: "2",
    question: "Do I have to change my existing RWA token contracts?",
    answer:
      "No. NullOwn is a privacy overlay, not an issuance platform. Your ERC-721 and ERC-1155 contracts are treated as black boxes and are never modified, wrapped, or redeployed. The stealth layer only changes which address receives a transfer; the token contract sees an ordinary transfer to an ordinary address.",
  },
  {
    id: "3",
    question: "How can a proof be private if it is verified on-chain?",
    answer:
      "The verifier only ever sees three public signals: a Merkle root, the threshold being claimed, and a nullifier. Your wallet address, the token id, and the exact quantity stay inside the witness and never leave your browser. The contract confirms the cryptographic relationship holds without learning any of the values that satisfy it.",
  },
  {
    id: "4",
    question: "What stops someone from reusing a proof they saw on-chain?",
    answer:
      "Every proof carries a nullifier derived as Poseidon(spendKeyHash, tokenId). The verifier records each nullifier permanently and reverts on reuse, so a captured proof cannot be replayed by anyone — including you. The trade-off is that repeated attestations over the same token are linkable to each other, though still not to any wallet.",
  },
  {
    id: "5",
    question: "How does regulatory access work without making data public?",
    answer:
      "A regulator holding REGULATOR_ROLE opens a scoped audit request, which is logged on-chain immutably — the fact that an audit occurred is permanently visible. The response is ciphertext that only the regulator's audit key can open. Compliance auditability and public transparency are separated rather than treated as the same thing.",
  },
  {
    id: "6",
    question: "Is this ready for mainnet?",
    answer:
      "No. This phase targets Sepolia and Polygon Mumbai only. The Groth16 trusted setup currently runs with a single local contribution, which is fine for a testnet but unsafe for real value — a mainnet deployment needs a proper multi-party ceremony, and the contracts have not been audited.",
  },
];

export function FaqSection() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggleQuestion = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section
      id="faq"
      className="w-full bg-zinc-900 py-24 md:py-32 border-b border-zinc-700/30"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Left Column - Header */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3 px-4 py-2 border border-zinc-700 w-fit">
              <div className="w-2.5 h-2.5 bg-amber-500" />
              <span className="text-sm font-medium text-zinc-400 tracking-wide">
                FAQ
              </span>
            </div>
            
            <h2 className="text-balance text-4xl md:text-5xl lg:text-6xl font-normal text-white tracking-tight leading-[1.1]">
              {"Common Questions".split(" ").map((word, i) => (
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

            <p className="text-balance text-base md:text-lg text-zinc-400 leading-relaxed max-w-md">
              What NullOwn does, what it deliberately does not do, and where the
              limits are. For the full system design, read ARCHITECTURE.md in the
              repository.
            </p>
          </div>

          {/* Right Column - FAQ Items */}
          <div className="flex flex-col">
            {faqs.map((faq, index) => (
              <div
                key={faq.id}
                className={cn(
                  "border-t border-zinc-700/30",
                  index === faqs.length - 1 && "border-b"
                )}
              >
                <button
                  onClick={() => toggleQuestion(faq.id)}
                  className="w-full py-6 flex items-center justify-between gap-4 text-left group"
                >
                  <span className="text-lg md:text-xl font-normal text-white group-hover:text-zinc-300 transition-colors">
                    {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: openId === faq.id ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown className="w-5 h-5 text-zinc-400" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {openId === faq.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pb-6 pr-12">
                        <p className="text-base leading-relaxed text-zinc-400">
                          {faq.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
