"use client"

import { Button } from "@/components/ui/button"
import { Shield, Menu, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { motion } from "framer-motion"

export function Hero() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/hero-bg.jpg')",
        }}
      />
      
      {/* Subtle overlay for text readability */}
      <div className="absolute inset-0 bg-slate-950/20" />
      
      {/* Content */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Navigation */}
        <nav className="relative z-50 px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-white">
              <Shield className="h-5 w-5 text-amber-500" />
              <span className="font-medium">NullOwn</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden items-center gap-6 text-sm text-white/70 lg:flex">
              <Link href="#problem" className="transition-colors hover:text-white">
                Problem
              </Link>
              <Link href="#how-it-works" className="transition-colors hover:text-white">
                How It Works
              </Link>
              <Link href="/stealth" className="transition-colors hover:text-white">
                Stealth
              </Link>
              <Link href="/prove" className="transition-colors hover:text-white">
                Prove
              </Link>
              <Link href="/compliance" className="transition-colors hover:text-white">
                Compliance
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/stealth"
                className="hidden text-sm font-medium text-white transition-colors hover:text-white/80 lg:block"
              >
                Launch App
              </Link>
              
              {/* Hamburger Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-white lg:hidden"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="absolute left-0 right-0 top-full bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-700/30 lg:hidden">
              <div className="flex flex-col px-6 py-6 gap-4">
                <Link
                  href="#problem"
                  className="text-white/70 transition-colors hover:text-white py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Problem
                </Link>
                <Link
                  href="#how-it-works"
                  className="text-white/70 transition-colors hover:text-white py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  How It Works
                </Link>
                <Link
                  href="/stealth"
                  className="text-white/70 transition-colors hover:text-white py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Stealth
                </Link>
                <Link
                  href="/prove"
                  className="text-white/70 transition-colors hover:text-white py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Prove
                </Link>
                <Link
                  href="/compliance"
                  className="text-white/70 transition-colors hover:text-white py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Compliance
                </Link>
                <Link
                  href="/stealth"
                  className="mt-2 text-white font-medium py-2 border-t border-zinc-700/30"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Launch App
                </Link>
              </div>
            </div>
          )}
        </nav>

        {/* Hero Content - Positioned in upper portion */}
        <div className="flex flex-1 flex-col items-center px-6 pt-16 text-center md:pt-24">
          <h1 className="max-w-3xl text-balance text-5xl font-normal tracking-tight text-white md:text-6xl lg:text-7xl">
            {"Own Real-World Assets Without Being Seen".split(" ").map((word, i) => (
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
          </h1>
          
          <p className="mt-6 max-w-xl text-balance text-center text-sm leading-relaxed text-white/70 md:text-base">
            Receive tokenized assets at one-time stealth addresses, prove ownership with
            zero-knowledge proofs, and stay auditable by regulators — without a single public
            disclosure.
          </p>

          {/* CTAs - Two buttons side by side */}
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-white px-6 text-slate-900 hover:bg-white/90"
            >
              <Link href="/stealth">Launch App</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-white/30 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="#how-it-works">See How It Works</Link>
            </Button>
          </div>
        </div>

        {/* Scroll Indicator - At bottom */}
        
      </div>
    </section>
  )
}
