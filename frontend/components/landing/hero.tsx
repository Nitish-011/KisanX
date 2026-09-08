"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Compass,
  FileCheck,
  MapPin,
  Scan,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Video,
} from "lucide-react";
import { LiquidMetalButton } from "@/components/ui/liquid_metal_button";

function PlasmaField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const W = 180;
    const H = 110;
    canvas.width = W;
    canvas.height = H;

    const image = ctx.createImageData(W, H);
    const data = image.data;

    let raf = 0;
    let time = 0;
    let last = performance.now();
    let alive = true;

    const palette = (t: number) => {
      const stops = [
        [3, 7, 4],
        [7, 26, 13],
        [17, 57, 25],
        [46, 91, 49],
        [123, 93, 44],
        [224, 105, 31],
        [8, 18, 9],
      ];

      const scaled = Math.max(0, Math.min(0.999, t)) * (stops.length - 1);
      const i = Math.floor(scaled);
      const f = scaled - i;
      const a = stops[i];
      const b = stops[Math.min(i + 1, stops.length - 1)];

      return [
        a[0] + (b[0] - a[0]) * f,
        a[1] + (b[1] - a[1]) * f,
        a[2] + (b[2] - a[2]) * f,
      ];
    };

    const frame = (now: number) => {
      if (!alive) return;

      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      time += dt * 0.28;

      let index = 0;

      for (let y = 0; y < H; y++) {
        const ny = y / H - 0.5;

        for (let x = 0; x < W; x++) {
          const nx = x / W - 0.5;

          const field =
            Math.sin(nx * 9 + time * 1.1) +
            Math.sin(ny * 8 - time * 0.9) +
            Math.sin((nx + ny) * 10 + time * 0.8) +
            Math.sin(Math.sqrt(nx * nx + ny * ny) * 19 - time * 1.3);

          const glow =
            Math.exp(-((nx + 0.2) ** 2 / 0.08 + (ny - 0.05) ** 2 / 0.15)) * 0.8;

          const t = Math.max(0, Math.min(1, field / 8 + 0.52 + glow));
          const [r, g, b] = palette(t);

          data[index++] = r;
          data[index++] = g;
          data[index++] = b;
          data[index++] = 255;
        }
      }

      ctx.putImageData(image, 0, 0);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full opacity-[0.88] mix-blend-screen"
      style={{
        filter: "blur(38px) saturate(1.25)",
        transform: "scale(1.18)",
        imageRendering: "pixelated",
      }}
    />
  );
}

const TICKER = [
  "COTTON (YOLOv11-SEG)",
  "SUGARCANE (MobileNetV3)",
  "GEMMA 3 4B ICAR RAG",
  "OPENCV HARVEST YIELD VALUATION",
  "GPS MANDI PROXIMITY RADAR",
  "SHA-256 ENCRYPTED TRADING",
  "FOOD INSPECTOR CERTIFICATION",
];

type SimulationTab = "Cotton" | "Sugarcane" | "Harvest" | "Radar";

export function Hero() {
  const [activeTab, setActiveTab] = useState<SimulationTab>("Cotton");

  return (
    <section
      id="crop-health"
      className="relative min-h-screen overflow-hidden bg-[#030604] text-white"
    >
      {/* Background Layer */}
      <div className="pointer-events-none absolute inset-0">
        <PlasmaField />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_40%,rgba(20,71,32,0.35),transparent_48%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_15%,rgba(213,103,31,0.12),transparent_30%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_5%,#030604_85%)]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(126,155,128,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(126,155,128,.18) 1px, transparent 1px)",
            backgroundSize: "78px 78px",
            maskImage: "linear-gradient(to bottom, black, transparent 88%)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent 88%)",
          }}
        />
      </div>

      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#10b981] to-transparent opacity-70" />

      <div className="relative mx-auto flex min-h-screen max-w-[1480px] items-center px-6 pb-16 pt-32 lg:px-10">
        <div className="grid w-full items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Left Hero Content */}
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-300 backdrop-blur-md">
              <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
              Multi-Crop Neural Segregation & Mandi Radar Live
            </div>

            <h1 className="max-w-4xl text-[3.2rem] font-extrabold leading-[0.94] tracking-[-0.05em] sm:text-6xl lg:text-[6.2rem]">
              See the threat.
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-400 bg-clip-text text-transparent">
                Value the harvest.
              </span>
              <br />
              <span className="text-white/90">Command the mandi.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
              KisanX bridges agricultural field robotics and cryptographic commerce. Run isolated 
              <strong className="text-emerald-300 font-semibold"> YOLOv11 segmentation</strong> for Cotton and 
              <strong className="text-amber-300 font-semibold"> MobileNetV3</strong> for Sugarcane, consult 
              <strong className="text-teal-300 font-semibold"> Gemma 3 4B</strong> ICAR RAG, estimate lot yield via video AI, and trade over 
              <strong className="text-orange-300 font-semibold"> GPS Proximity Radar</strong>.
            </p>

            {/* Portal Direct Launch Actions */}
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/dashboard/scan">
                <LiquidMetalButton className="w-full sm:w-auto">
                  <Scan className="mr-2 size-4 text-emerald-300" />
                  Launch AI Disease Doctor
                  <ArrowUpRight className="ml-2 size-4" />
                </LiquidMetalButton>
              </Link>

              <Link
                href="/market"
                className="inline-flex h-12 items-center justify-center rounded-full border border-orange-500/30 bg-orange-950/30 px-6 text-sm font-semibold text-orange-200 transition hover:border-orange-500/60 hover:bg-orange-900/40 hover:text-white"
              >
                <Video className="mr-2 size-4 text-orange-400" />
                Harvest Valuation & Mandi
              </Link>

              <Link
                href="/market?tab=buyer"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 text-sm font-semibold text-white/90 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                <Compass className="mr-2 size-4 text-emerald-400" />
                Buyer GPS Radar
              </Link>

              <Link
                href="/market?tab=inspector"
                className="inline-flex h-12 items-center justify-center rounded-full border border-teal-500/30 bg-teal-950/25 px-5 text-sm font-semibold text-teal-200 transition hover:border-teal-500/60 hover:bg-teal-900/30 hover:text-white"
              >
                <ShieldCheck className="mr-2 size-4 text-teal-400" />
                Food Inspector Portal
              </Link>
            </div>

            {/* Marquee Ticker */}
            <div className="mt-11 max-w-xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
              <div className="flex w-max animate-[kisanx-marquee_20s_linear_infinite] gap-7 text-[11px] font-mono tracking-wider text-white/40">
                {[...TICKER, ...TICKER].map((crop, index) => (
                  <span key={`${crop}-${index}`} className="flex items-center gap-7">
                    {crop}
                    <span className="size-1 rounded-full bg-emerald-400" />
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Live Interactive Simulator Card */}
          <div className="relative hidden lg:block">
            <div className="absolute -inset-20 rounded-full bg-emerald-600/20 blur-[120px]" />

            <div className="relative rounded-[2.5rem] border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-6 shadow-[0_35px_110px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
              {/* Header with 4-way Simulator Switcher */}
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-mono">
                    Real-Time Telemetry Node
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-white">
                    {activeTab === "Cotton" && "Cotton Foliage · Vidarbha"}
                    {activeTab === "Sugarcane" && "Sugarcane Cane · Pune"}
                    {activeTab === "Harvest" && "Harvest Video Engine · 3.5 Acres"}
                    {activeTab === "Radar" && "Buyer Proximity Radar · Active Mandi"}
                  </p>
                </div>

                {/* Switcher Pills */}
                <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-white/10 bg-black/60 p-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("Cotton")}
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                      activeTab === "Cotton"
                        ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    🌿 Cotton
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("Sugarcane")}
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                      activeTab === "Sugarcane"
                        ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    🎋 Cane
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("Harvest")}
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                      activeTab === "Harvest"
                        ? "bg-orange-500 text-black shadow-md shadow-orange-500/20"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    🎥 Harvest
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("Radar")}
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                      activeTab === "Radar"
                        ? "bg-teal-500 text-black shadow-md shadow-teal-500/20"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    📡 Radar
                  </button>
                </div>
              </div>

              {/* Viewport Simulation Box */}
              <div className="relative h-[370px] overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#050b07]">
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      "linear-gradient(35deg, transparent 47%, rgba(16,185,129,.15) 48%, transparent 49%), linear-gradient(145deg, transparent 47%, rgba(16,185,129,.1) 48%, transparent 49%)",
                    backgroundSize: "80px 80px",
                  }}
                />

                {/* Animated scan wave */}
                <div className="absolute inset-x-0 top-0 h-24 animate-[kisanx-scan_4s_ease-in-out_infinite] bg-gradient-to-b from-emerald-400/20 to-transparent" />

                {/* Dynamic Screen Contents Based on activeTab */}
                {activeTab === "Cotton" && (
                  <>
                    <div className="absolute left-[18%] top-[18%] size-36 rounded-full border border-emerald-400/40 bg-emerald-500/10 shadow-[0_0_50px_rgba(16,185,129,0.2)] animate-pulse" />
                    <div className="absolute left-[20%] top-[22%] rounded-2xl border border-emerald-500/40 bg-black/85 px-4 py-3 shadow-2xl backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        <Scan className="size-4 text-emerald-400" />
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold">
                            YOLOv11 Seg
                          </p>
                          <p className="text-xs font-extrabold text-white">
                            Bacterial Blight · 94.8%
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="absolute right-[12%] bottom-[24%] rounded-2xl border border-white/10 bg-black/85 px-4 py-3 shadow-2xl backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        <Activity className="size-4 text-amber-400" />
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-white/50">
                            Foliar Severity
                          </p>
                          <p className="text-xs font-bold text-amber-300">
                            Moderate (18.5% Area)
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === "Sugarcane" && (
                  <>
                    <div className="absolute left-[18%] top-[18%] size-36 rounded-full border border-amber-400/40 bg-amber-500/10 shadow-[0_0_50px_rgba(245,158,11,0.2)] animate-pulse" />
                    <div className="absolute left-[20%] top-[22%] rounded-2xl border border-amber-500/40 bg-black/85 px-4 py-3 shadow-2xl backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        <ScanLine className="size-4 text-amber-400" />
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-amber-400 font-bold">
                            MobileNetV3
                          </p>
                          <p className="text-xs font-extrabold text-white">
                            Red Rot · 93.4%
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="absolute right-[12%] bottom-[24%] rounded-2xl border border-white/10 bg-black/85 px-4 py-3 shadow-2xl backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="size-4 text-red-400" />
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-white/50">
                            Sucrose Loss Risk
                          </p>
                          <p className="text-xs font-bold text-red-300">
                            High Priority (Immediate Roguing)
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === "Harvest" && (
                  <>
                    <div className="absolute left-[15%] top-[15%] rounded-2xl border border-orange-500/40 bg-black/90 p-4 shadow-2xl backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        <Video className="size-5 text-orange-400 animate-pulse" />
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-orange-400 font-bold">
                            OpenCV Keyframe Sampling
                          </p>
                          <p className="text-sm font-extrabold text-white">
                            3.5 Acres · 92.4% Health Score
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-2 text-[11px]">
                        <div>
                          <span className="text-white/50">Est. Yield:</span>{" "}
                          <span className="font-bold text-emerald-400">35.8 Quintals</span>
                        </div>
                        <div>
                          <span className="text-white/50">Valuation:</span>{" "}
                          <span className="font-bold text-orange-400">₹2,59,550</span>
                        </div>
                      </div>
                    </div>

                    <div className="absolute right-[10%] bottom-[20%] rounded-2xl border border-emerald-500/40 bg-black/90 px-4 py-3 shadow-2xl backdrop-blur-md">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        Gemma 3 4B Appraisal Attached
                      </div>
                      <p className="mt-1 text-[10px] text-white/60">
                        Grade A Premium Quality · Optimal picking window next 4 days.
                      </p>
                    </div>
                  </>
                )}

                {activeTab === "Radar" && (
                  <>
                    <div className="absolute left-[15%] top-[15%] rounded-2xl border border-teal-500/40 bg-black/90 p-4 shadow-2xl backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        <Compass className="size-5 text-teal-400 animate-spin" />
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-teal-400 font-bold">
                            Buyer Proximity Radar
                          </p>
                          <p className="text-sm font-extrabold text-white">
                            3.8 km Away · Haversine Matched
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 text-[10px] font-mono text-white/50">
                        SHA-256 Lock: <span className="text-teal-300">9c4e...d81a</span>
                      </div>
                    </div>

                    <div className="absolute right-[10%] bottom-[20%] rounded-2xl border border-emerald-500/40 bg-black/90 px-4 py-3 shadow-2xl backdrop-blur-md">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                        <ShieldCheck size={15} className="text-emerald-400" />
                        Phytosanitary Grade A Approved
                      </div>
                      <p className="mt-1 text-[10px] text-white/60">
                        Certified by Food Safety & Quality Officer. Ready for dispatch.
                      </p>
                    </div>
                  </>
                )}

                {/* Bottom Model Indicator Strip */}
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/85 px-4 py-2.5 backdrop-blur-md">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-white/40 font-mono">
                      Active Pipeline Core
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-emerald-300">
                      {activeTab === "Cotton" && "YOLOv11-seg (Isolated Cotton Weights)"}
                      {activeTab === "Sugarcane" && "MobileNetV3 (Isolated Cane Classifier)"}
                      {activeTab === "Harvest" && "OpenCV Defect Sampling + Yield Math Engine"}
                      {activeTab === "Radar" && "Haversine Distance Radar + SHA-256 Protocol"}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-mono text-white/80">
                    <CheckCircle2 size={13} className="text-emerald-400" /> Zero Cross-Bleed
                  </span>
                </div>
              </div>

              {/* 4 Interactive Feature Nodes */}
              <div className="mt-4 grid grid-cols-4 gap-2">
                <Link
                  href="/dashboard/scan"
                  className="rounded-xl border border-white/10 bg-black/40 p-3 transition hover:border-emerald-500/40 hover:bg-white/[0.04]"
                >
                  <Scan size={16} className="text-emerald-400" />
                  <p className="mt-1.5 text-[9px] uppercase tracking-wider text-white/40">AI Vision</p>
                  <p className="mt-0.5 text-xs font-bold text-white">Disease Doctor</p>
                </Link>

                <Link
                  href="/market"
                  className="rounded-xl border border-white/10 bg-black/40 p-3 transition hover:border-orange-500/40 hover:bg-white/[0.04]"
                >
                  <Video size={16} className="text-orange-400" />
                  <p className="mt-1.5 text-[9px] uppercase tracking-wider text-white/40">Harvest AI</p>
                  <p className="mt-0.5 text-xs font-bold text-white">Video Yield</p>
                </Link>

                <Link
                  href="/market?tab=buyer"
                  className="rounded-xl border border-white/10 bg-black/40 p-3 transition hover:border-teal-500/40 hover:bg-white/[0.04]"
                >
                  <Compass size={16} className="text-teal-400" />
                  <p className="mt-1.5 text-[9px] uppercase tracking-wider text-white/40">Buyer Radar</p>
                  <p className="mt-0.5 text-xs font-bold text-white">GPS Mandi</p>
                </Link>

                <Link
                  href="/market?tab=inspector"
                  className="rounded-xl border border-white/10 bg-black/40 p-3 transition hover:border-amber-500/40 hover:bg-white/[0.04]"
                >
                  <ShieldCheck size={16} className="text-amber-400" />
                  <p className="mt-1.5 text-[9px] uppercase tracking-wider text-white/40">Quality Pass</p>
                  <p className="mt-0.5 text-xs font-bold text-white">Inspector Auth</p>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
