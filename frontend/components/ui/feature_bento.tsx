"use client";

import {
  ArrowUpRight,
  Bot,
  BrainCircuit,
  Compass,
  FileCheck2,
  Lock,
  MapPinned,
  Microscope,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  Video,
  Wheat,
} from "lucide-react";
import Link from "next/link";

const corePillars = [
  {
    number: "01",
    title: "Multi-Crop Neural Segregation",
    tagline: "ZERO CROSS-CROP CONTAMINATION",
    description:
      "Unlike generalized models, KisanX strictly isolates model pipelines: Cotton leaf scans execute solely on YOLOv11 instance segmentation masks, while Sugarcane canes run on dedicated MobileNetV3 classifiers.",
    icon: Microscope,
    accent: "emerald",
    href: "/dashboard/scan",
    cta: "Launch Disease Doctor",
  },
  {
    number: "02",
    title: "Gemma 3 4B Clinical Advisory",
    tagline: "ICAR & CICR GROUNDED RAG",
    description:
      "Direct farmer consultation in plain Hindi/English with clinical structure: What the pathogen is, Why it manifested (humidity, vectors), How to eradicate it (exact chemical & bio-agent dosages), and When to rescan.",
    icon: Bot,
    accent: "teal",
    href: "/dashboard/scan",
    cta: "Consult Crop Doctor",
  },
  {
    number: "03",
    title: "OpenCV Video Harvest Valuation",
    tagline: "AERIAL & FIELD EVIDENCE",
    description:
      "Upload 10-30s field walk videos. OpenCV samples keyframes across the plot, YOLO evaluates foliage defect percentages, and mathematical agronomic formulas compute exact yield in quintals and lot valuation.",
    icon: Video,
    accent: "orange",
    href: "/market",
    cta: "Estimate Lot Valuation",
  },
  {
    number: "04",
    title: "GPS Mandi Radar & Inspector Auth",
    tagline: "CRYPTOGRAPHIC TRADING",
    description:
      "Local buyers discover verified harvest lots via Haversine geolocation proximity. Trade over SHA-256 session-locked negotiation chats, and obtain official Food Inspector Grade A phytosanitary certificates.",
    icon: Compass,
    accent: "amber",
    href: "/market?tab=buyer",
    cta: "Open Buyer Radar",
  },
];

export function FeatureBento() {
  return (
    <section
      id="intelligence"
      className="relative overflow-hidden bg-[#030604] py-28 text-white"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-[#203525]" />
      <div className="pointer-events-none absolute left-[-10%] top-[15%] h-[500px] w-[500px] rounded-full bg-[#0b3518]/25 blur-[130px]" />
      <div className="pointer-events-none absolute right-[-10%] bottom-0 h-[450px] w-[450px] rounded-full bg-[#d96d22]/[0.08] blur-[120px]" />

      <div className="relative mx-auto max-w-[1480px] px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr]">
          {/* Left Sticky Overview */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#e87524]">
              System Architecture
            </p>
            <h2 className="mt-5 max-w-xl text-4xl font-extrabold leading-[0.96] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
              From pathogen
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">
                segmentation
              </span>
              <br />
              to verified trade.
            </h2>
            <p className="mt-7 max-w-md text-base leading-7 text-[#859489]">
              KisanX integrates crop-isolated vision AI, conversational agronomic reasoning,
              video yield valuation, and cryptographic mandi discovery into one continuous ecosystem.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/dashboard/scan"
                className="group inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:border-emerald-500/60 hover:bg-emerald-900/50"
              >
                Scan A Crop Now
                <ArrowUpRight className="size-4 text-emerald-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/market"
                className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:text-white"
              >
                Explore Mandi Market
                <ArrowUpRight className="size-4 text-orange-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="mt-14 hidden border-t border-[#1d2c21] pt-6 lg:block">
              <div className="flex items-center gap-3 text-xs text-[#718274]">
                <Sprout className="size-4 text-emerald-400" />
                Grounded in ICAR & CICR official agronomic protocols.
              </div>
            </div>
          </div>

          {/* Right Grid of 4 Core Pillars */}
          <div id="how-it-works" className="grid gap-5 sm:grid-cols-2">
            {corePillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-white/10 bg-[#071109] p-7 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
                >
                  <div className="absolute right-0 top-0 size-48 rounded-full bg-emerald-500/5 blur-[60px] transition duration-500 group-hover:bg-emerald-500/10" />

                  {/* Header */}
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-black/60 shadow-inner">
                        <Icon className="size-5 text-emerald-400 group-hover:text-orange-400 transition-colors" />
                      </div>
                      <span className="font-mono text-xs font-bold text-white/30">
                        {pillar.number}
                      </span>
                    </div>

                    <div className="mt-6">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-orange-400">
                        {pillar.tagline}
                      </p>
                      <h3 className="mt-1.5 text-xl font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                        {pillar.title}
                      </h3>
                      <p className="mt-3 text-xs leading-relaxed text-white/65">
                        {pillar.description}
                      </p>
                    </div>
                  </div>

                  {/* Link CTA */}
                  <div className="mt-6 border-t border-white/5 pt-4">
                    <Link
                      href={pillar.href}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition"
                    >
                      {pillar.cta}
                      <ArrowUpRight size={13} />
                    </Link>
                  </div>
                </div>
              );
            })}

            {/* Bottom Wide Trust Banner */}
            <div className="relative overflow-hidden rounded-[2rem] border border-amber-500/30 bg-[#120c07] p-7 sm:col-span-2">
              <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_80%_30%,rgba(232,117,36,.15),transparent_60%)]" />
              <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                    <Lock size={14} /> Cryptographic Field Settlement
                  </div>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-white">
                    Verified Food Safety & Direct Farmer Mandi
                  </h3>
                  <p className="mt-1 max-w-xl text-xs text-white/60">
                    Every lot listed carries a tamper-evident SHA-256 session token,
                    verified acreage calculations, and official phytosanitary grading by certified Food Inspectors.
                  </p>
                </div>

                <Link
                  href="/market"
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-orange-600 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-orange-600/30 transition hover:bg-orange-500"
                >
                  Enter Marketplace
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FeatureBento;
