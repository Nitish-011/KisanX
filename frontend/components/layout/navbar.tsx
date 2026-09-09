"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { RandomLetterSwap } from "@/components/ui/random_letter_swap";
import { LiquidMetalButton } from "@/components/ui/liquid_metal_button";

const links = [
  { label: "Intelligence", href: "#intelligence" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Crop Health", href: "#crop-health" },
  { label: "Marketplace", href: "/market" },
  { label: "Buyer Radar", href: "/market?tab=buyer" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <nav className="mx-auto max-w-[1480px] rounded-2xl border border-[#2a3b2d] bg-[#050906]/80 px-5 py-3 shadow-[0_16px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="flex h-12 items-center justify-between">
          <Link href="/" className="group flex items-center">
            <span className="text-xl font-semibold tracking-[-0.045em] text-[#f1f3ee] transition group-hover:text-[#f0a064]">
              Kisan<span className="text-[#e87524]">X</span>
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                <RandomLetterSwap
                  text={link.label}
                  className="rounded-lg px-4 py-2.5 text-[13px] font-medium text-[#9ba69d] transition hover:bg-white/[0.04] hover:text-[#edf1ed]"
                />
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/auth"
              className="px-3 py-2 text-sm font-medium text-[#aab2ac] transition hover:text-white"
            >
              Login
            </Link>
            <Link href="/auth">
              <LiquidMetalButton className="h-10 px-5">
                Start Scanning
              </LiquidMetalButton>
            </Link>
          </div>

          <button
            type="button"
            aria-label="Toggle navigation"
            onClick={() => setOpen((value) => !value)}
            className="flex size-10 items-center justify-center rounded-xl border border-[#2c3c2f] bg-white/[0.03] text-white md:hidden"
          >
            {open ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>

        {open && (
          <div className="grid gap-2 border-t border-[#263329] py-4 md:hidden">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm text-[#b1bbb3] hover:bg-white/[0.04] hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-xl bg-[#d96d22] px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Start Scanning
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}

export default Navbar;
