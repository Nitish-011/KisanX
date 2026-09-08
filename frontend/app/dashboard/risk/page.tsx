"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Activity,
  ShieldCheck,
  AlertTriangle,
  CloudRain,
  Sprout,
  Dna,
  Layers,
  MapPin,
  RefreshCw,
  Sparkles,
  ArrowUpRight
} from "lucide-react";
import { KisanXAPI } from "@/lib/api";

export default function EpidemiologicalRiskPage() {
  const [farms, setFarms] = useState<any[]>([]);
  const [selectedCropCycleId, setSelectedCropCycleId] = useState<string>("");
  const [riskData, setRiskData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFarms() {
      try {
        const data = await KisanXAPI.listFarms();
        if (data.farms && data.farms.length > 0) {
          setFarms(data.farms);
          for (const f of data.farms) {
            for (const p of f.plots || []) {
              if (p.active_crop_cycle?.id) {
                setSelectedCropCycleId(p.active_crop_cycle.id);
                return;
              }
            }
          }
        }
      } catch (err) {
        // non-critical
      }
    }
    loadFarms();
  }, []);

  useEffect(() => {
    if (!selectedCropCycleId) return;
    async function fetchRisk() {
      setLoading(true);
      setError(null);
      try {
        const res = await KisanXAPI.getRiskScore(selectedCropCycleId);
        setRiskData(res);
      } catch (err: any) {
        setError(err.message || "Failed to calculate dynamic risk score.");
      } finally {
        setLoading(false);
      }
    }
    fetchRisk();
  }, [selectedCropCycleId]);

  const getColorTheme = (colorCode: string = "green") => {
    switch (colorCode.toLowerCase()) {
      case "red":
        return {
          text: "text-rose-400",
          bg: "bg-rose-500/20",
          border: "border-rose-500/30",
          gradient: "from-rose-500 to-red-600",
          badge: "Severe Threat",
        };
      case "yellow":
      case "orange":
        return {
          text: "text-amber-400",
          bg: "bg-amber-500/20",
          border: "border-amber-500/30",
          gradient: "from-amber-400 to-orange-500",
          badge: "Elevated Watch",
        };
      default:
        return {
          text: "text-emerald-400",
          bg: "bg-emerald-500/20",
          border: "border-emerald-500/30",
          gradient: "from-emerald-400 to-teal-500",
          badge: "Low Vulnerability",
        };
    }
  };

  const theme = getColorTheme(riskData?.color_code);

  return (
    <main className="min-h-screen bg-[#030604] text-white selection:bg-emerald-500/30 selection:text-white">
      {/* Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full blur-[180px] opacity-10 bg-teal-600" />
        <div className="absolute top-2/3 right-10 w-[500px] h-[500px] rounded-full blur-[180px] opacity-10 bg-amber-600" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#030604]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400 text-xs font-bold">
                  ⚡
                </span>
                <h1 className="text-lg font-bold text-white tracking-tight">Dynamic Epidemiological Risk Radar</h1>
              </div>
              <p className="text-[11px] text-white/50">Multi-factor pathogen vulnerability forecasting</p>
            </div>
          </div>

          {riskData && (
            <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono ${theme.border} ${theme.bg} ${theme.text}`}>
              <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
              {theme.badge} ({riskData.score}/100)
            </div>
          )}
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {/* Top Controls: Farm Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">Active Evaluation Cycle</span>
            <p className="text-xs text-white/60">Risk scores update based on microclimate sensors and regional trap counts.</p>
          </div>

          <div className="w-full sm:w-80">
            <select
              value={selectedCropCycleId}
              onChange={(e) => setSelectedCropCycleId(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/50 px-4 py-2 text-xs text-white focus:border-teal-400 focus:outline-none"
            >
              {farms.map((f) =>
                (f.plots || []).map((p: any) => (
                  <option key={p.active_crop_cycle?.id || p.id} value={p.active_crop_cycle?.id || ""}>
                    {f.name} — {p.name} ({p.active_crop_cycle?.crop_name || "Plot"})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-16 text-center">
            <RefreshCw size={24} className="animate-spin text-teal-400 mx-auto" />
            <p className="mt-3 text-xs text-white/60">Evaluating 5 epidemiological risk vectors...</p>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-300 flex items-center gap-3">
            <AlertTriangle size={20} className="shrink-0" />
            {error}
          </div>
        ) : riskData ? (
          <div className="grid gap-8 lg:grid-cols-12">
            {/* GAUGE & COMPOSITE SCORE (LEFT) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-8 text-center backdrop-blur-xl">
                <p className="text-xs font-mono uppercase tracking-wider text-white/50">Pathogen Vulnerability Index</p>

                {/* Circular Score Display */}
                <div className="relative mx-auto my-8 flex h-48 w-48 items-center justify-center">
                  {/* Outer SVG Track */}
                  <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="transparent" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray={264}
                      strokeDashoffset={264 - (264 * riskData.score) / 100}
                      strokeLinecap="round"
                      fill="transparent"
                      className={`transition-all duration-1000 ${theme.text}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-extrabold font-mono text-white tracking-tight">{riskData.score}</span>
                    <span className="text-[11px] font-mono text-white/50 uppercase mt-0.5">/ 100 Index</span>
                  </div>
                </div>

                <div className="flex justify-center gap-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold font-mono ${theme.bg} ${theme.text} border ${theme.border}`}>
                    {theme.badge}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs font-mono text-white/60 border border-white/10">
                    Date: {riskData.score_date}
                  </span>
                </div>

                {/* Recommendation */}
                <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4 text-left">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-300">
                    <Sparkles size={14} /> Diagnostic Intelligence
                  </div>
                  <p className="mt-1.5 text-xs text-white/70 leading-relaxed">{riskData.recommendation}</p>
                </div>
              </div>
            </div>

            {/* 5 FACTOR BREAKDOWNS (RIGHT) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 sm:p-8 backdrop-blur-xl">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity size={18} className="text-teal-400" /> Factor Contribution Matrix
                </h3>
                <p className="text-xs text-white/50 mt-1">
                  Individual risk weights computed via microclimate Open-Meteo feeds, crop phenology, and regional outbreak history.
                </p>

                <div className="mt-6 space-y-5">
                  {/* Factor 1: Weather */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-white flex items-center gap-2">
                        <CloudRain size={14} className="text-blue-400" /> Agrometeorological Weather Risk
                      </span>
                      <span className="font-mono font-bold text-blue-400">{riskData.factors?.weather || 0}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${riskData.factors?.weather || 0}%` }} />
                    </div>
                    <p className="text-[10px] text-white/40 mt-1">Relative humidity & consecutive wet hours favor fungal sporulation.</p>
                  </div>

                  {/* Factor 2: Crop Stage */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-white flex items-center gap-2">
                        <Sprout size={14} className="text-emerald-400" /> Phenological Stage Susceptibility
                      </span>
                      <span className="font-mono font-bold text-emerald-400">{riskData.factors?.crop_stage || 0}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${riskData.factors?.crop_stage || 0}%` }} />
                    </div>
                    <p className="text-[10px] text-white/40 mt-1">Vegetative & tillering canopies have maximum foliar density.</p>
                  </div>

                  {/* Factor 3: Variety */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-white flex items-center gap-2">
                        <Dna size={14} className="text-purple-400" /> Cultivar Genetic Resistance Index
                      </span>
                      <span className="font-mono font-bold text-purple-400">{riskData.factors?.variety || 0}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-purple-500" style={{ width: `${riskData.factors?.variety || 0}%` }} />
                    </div>
                    <p className="text-[10px] text-white/40 mt-1">Cultivar susceptibility against regional pathogen strains.</p>
                  </div>

                  {/* Factor 4: Soil */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-white flex items-center gap-2">
                        <Layers size={14} className="text-amber-400" /> Soil Drainage & Organic Status
                      </span>
                      <span className="font-mono font-bold text-amber-400">{riskData.factors?.soil || 0}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${riskData.factors?.soil || 0}%` }} />
                    </div>
                    <p className="text-[10px] text-white/40 mt-1">Waterlogging risk and soil-borne fungal spore persistence.</p>
                  </div>

                  {/* Factor 5: Regional History */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-white flex items-center gap-2">
                        <MapPin size={14} className="text-rose-400" /> Regional Outbreak Corridor Radius
                      </span>
                      <span className="font-mono font-bold text-rose-400">{riskData.factors?.regional_history || 0}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-rose-500" style={{ width: `${riskData.factors?.regional_history || 0}%` }} />
                    </div>
                    <p className="text-[10px] text-white/40 mt-1">Active verified disease clusters within 25km radius.</p>
                  </div>
                </div>

                {/* CTA Links */}
                <div className="mt-8 pt-5 border-t border-white/10 flex flex-wrap gap-3">
                  <Link
                    href="/dashboard/hotspots"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition"
                  >
                    View Outbreak Heatmap <ArrowUpRight size={13} />
                  </Link>
                  <Link
                    href="/dashboard/traps"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 px-4 py-2 text-xs font-bold hover:bg-teal-500/30 transition"
                  >
                    Check Pest Traps <ArrowUpRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
