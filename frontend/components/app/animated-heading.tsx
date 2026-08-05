"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The word-by-word blur-in used throughout the landing page, extracted so the
 * app routes animate identically instead of re-implementing it per page.
 */
export function AnimatedHeading({
  text,
  className,
  delayOffset = 0,
}: {
  text: string;
  className?: string;
  /** Shifts the stagger, for a second heading on the same screen. */
  delayOffset?: number;
}) {
  return (
    <h1
      className={cn(
        "text-balance text-4xl md:text-5xl font-normal tracking-tight text-white leading-[1.1]",
        className,
      )}
    >
      {text.split(" ").map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          initial={{ filter: "blur(10px)", opacity: 0 }}
          whileInView={{ filter: "blur(0px)", opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: (i + delayOffset) * 0.05 }}
          className="inline-block mr-[0.25em]"
        >
          {word}
        </motion.span>
      ))}
    </h1>
  );
}

/** The bordered badge with an amber square that labels every section. */
export function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border border-zinc-700 w-fit">
      <div className="w-2.5 h-2.5 bg-amber-500" />
      <span className="text-sm font-medium text-zinc-400 tracking-wide">{children}</span>
    </div>
  );
}
