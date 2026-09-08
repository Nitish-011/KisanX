"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  UploadCloud, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Bug, 
  Activity, 
  RefreshCw,
  Sparkles,
  Info
} from "lucide-react";
import { KisanXAPI } from "@/lib/api";

const PEST_SPECIES = [
  { id: "pink_bollworm", name: "Pink Bollworm (Pectinophora gossypiella)", defaultThreshold: 8, crop: "Cotton" },
  { id: "stalk_borer", name: "Sugarcane Early Shoot Borer (Chilo infuscatellus)", defaultThreshold: 10, crop: "Sugarcane" },
  { id: "spodoptera", name: "Tobacco Caterpillar (Spodoptera litura)", defaultThreshold: 15, crop: "Cotton / Veg" },
  { id: "whitefly", name: "Whitefly (Bemisia tabaci)", defaultThreshold: 20, crop: "Cotton" },
];

export default function TrapsMonitoringPage() {
  const [farms, setFarms] = useState<any[]>([]);
  const [selectedCropCycleId, setSelectedCropCycleId] = useState<string>("");
  const [selectedPest, setSelectedPest] = useState(PEST_SPECIES[0].id);
  const [manualCount, setManualCount] = useState<string>("12");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFarms() {
      try {
        const data = await KisanXAPI.listFarms();
        if (data.farms && data.farms.length > 0) {
          setFarms(data.farms);
          // Auto-select first active cycle
          for (const f of data.farms) {
            for (const p of f.plots || []) {
              if (p.active_crop_cycle?.id) {
                setSelectedCropCycleId(p.active_crop_cycle.id);
                return;
              }
            }
          }
        }
      } catch (err: any) {
        console.warn("Farms load notice:", err);
      }
    }
    loadFarms();
  }, []);

  useEffect(() => {
    if (!selectedCropCycleId) return;
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const data = await KisanXAPI.getTrapHistory(selectedCropCycleId);
        setHistory(data.trap_counts || []);
      } catch (err) {
        // non-critical
      } finally {
        setHistoryLoading(false);
      }
    }
    loadHistory();
  }, [selectedCropCycleId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      } else {
        // create a dummy image blob if user only typed manual count
        const canvas = document.createElement("canvas");
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffcc00";
          ctx.fillRect(0, 0, 100, 100);
        }
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg"));
        formData.append("file", blob, "trap_sheet.jpg");
      }

      if (selectedCropCycleId) {
        formData.append("crop_cycle_id", selectedCropCycleId);
      }
      formData.append("pest_species", selectedPest);
      if (manualCount) {
        formData.append("count", manualCount);
      }

      const res = await KisanXAPI.logTrapCount(formData);
      setResult(res.trap_count);
      if (selectedCropCycleId) {
        const updated = await KisanXAPI.getTrapHistory(selectedCropCycleId);
        setHistory(updated.trap_counts || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze trap sheet.");
    } finally {
      setLoading(false);
    }
  };

  const activePestObj = PEST_SPECIES.find((p) => p.id === selectedPest) || PEST_SPECIES[0];

  return (
    <main className="min-h-screen bg-[#030604] text-white selection:bg-emerald-500/30 selection:text-white">
      {/* Glow overlays */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-10 left-1/4 w-[600px] h-[600px] rounded-full blur-[180px] opacity-10 bg-amber-600" />
        <div className="absolute top-2/3 right-10 w-[500px] h-[500px] rounded-full blur-[180px] opacity-10 bg-emerald-700" />
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
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 text-xs font-bold">
                  🪤
                </span>
                <h1 className="text-lg font-bold text-white tracking-tight">Pest Trap Monitoring & ETL Alerts</h1>
              </div>
              <p className="text-[11px] text-white/50">Economic Threshold Level (ETL) Bio-Surveillance Engine</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300 font-mono">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Sensor ETL Active
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-12">
          {/* LEFT: Trap Input & Photo Upload */}
          <div className="lg:col-span-6 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 sm:p-8 backdrop-blur-xl">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Bug size={20} className="text-amber-400" /> Log Pheromone Trap Sheet
              </h2>
              <p className="text-xs text-white/60 mt-1">
                Upload a photo of your field sticky sheet or enter the counted insects to evaluate regional ETL threshold actions.
              </p>

              <form onSubmit={handleAnalyze} className="mt-6 space-y-5">
                {/* Crop Cycle Link */}
                {farms.length > 0 && (
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-white/60 mb-2">
                      Target Farm & Crop Plot
                    </label>
                    <select
                      value={selectedCropCycleId}
                      onChange={(e) => setSelectedCropCycleId(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                    >
                      {farms.map((f) =>
                        (f.plots || []).map((p: any) => (
                          <option key={p.active_crop_cycle?.id || p.id} value={p.active_crop_cycle?.id || ""}>
                            {f.name} — {p.name} ({p.active_crop_cycle?.crop_name || "Active Crop"})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                {/* Pest Species Selector */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-white/60 mb-2">
                    Target Pest Species
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PEST_SPECIES.map((pest) => (
                      <button
                        type="button"
                        key={pest.id}
                        onClick={() => setSelectedPest(pest.id)}
                        className={`text-left p-3 rounded-2xl border transition text-xs ${
                          selectedPest === pest.id
                            ? "border-amber-500 bg-amber-500/15 text-white font-bold"
                            : "border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-amber-300 font-bold">{pest.crop}</span>
                          <span className="text-[10px] font-mono text-white/40">ETL: {pest.defaultThreshold}</span>
                        </div>
                        <p className="mt-1 line-clamp-1">{pest.name}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Photo Dropzone */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-white/60 mb-2">
                    Trap Sheet Photo (AI Counter)
                  </label>
                  <div className="relative rounded-2xl border-2 border-dashed border-white/15 bg-black/30 p-6 text-center hover:border-amber-400/50 transition">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    {previewUrl ? (
                      <div className="space-y-2">
                        <img src={previewUrl} alt="Trap preview" className="mx-auto h-40 rounded-xl object-cover" />
                        <p className="text-xs text-amber-300 font-mono">Click or drag another image to replace</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <UploadCloud size={32} className="mx-auto text-white/40" />
                        <p className="text-xs text-white/70 font-semibold">
                          Upload trap sheet photo for neural counting
                        </p>
                        <p className="text-[11px] text-white/40">Supports JPG, PNG, WEBP</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Manual Count Fallback */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-white/60 mb-2">
                    Manual Insect Count (Override)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={manualCount}
                    onChange={(e) => setManualCount(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                    placeholder="Enter total insects spotted on trap"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-[1.01] transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> Analyzing Trap Density...
                    </>
                  ) : (
                    <>
                      <Activity size={16} /> Evaluate ETL Threshold
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT: Live Result Card & ETL Dial */}
          <div className="lg:col-span-6 space-y-6">
            {result ? (
              <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 sm:p-8 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-mono tracking-wider text-white/50">ETL Result</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-extrabold font-mono uppercase ${
                      result.action_needed
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {result.action_needed ? "🚨 Threshold Breached" : "✅ Safe (Under ETL)"}
                  </span>
                </div>

                <div className="mt-6 flex items-baseline gap-4">
                  <div className="text-5xl font-extrabold font-mono text-white">
                    {result.count}{" "}
                    <span className="text-sm font-normal text-white/50">moths</span>
                  </div>
                  <div className="text-sm font-mono text-white/50">
                    Threshold: <span className="text-amber-400 font-bold">{result.etl_threshold}</span> / trap
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        result.action_needed ? "bg-gradient-to-r from-amber-500 to-rose-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, (result.count / result.etl_threshold) * 50)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] font-mono text-white/40">
                    <span>0</span>
                    <span className="text-amber-400">ETL ({result.etl_threshold})</span>
                    <span>Severe Infestation (2x+)</span>
                  </div>
                </div>

                {/* Recommendation Box */}
                <div
                  className={`mt-6 rounded-2xl p-5 border ${
                    result.action_needed
                      ? "border-rose-500/30 bg-rose-950/20 text-rose-200"
                      : "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
                  }`}
                >
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    {result.action_needed ? <ShieldAlert size={16} /> : <CheckCircle2 size={16} />}
                    Agronomic Recommendation
                  </h4>
                  <p className="mt-2 text-xs leading-relaxed opacity-90">{result.recommendation}</p>

                  {result.action_needed && (
                    <div className="mt-4 pt-3 border-t border-rose-500/20 flex gap-3">
                      <Link
                        href="/dashboard/inputs"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 py-1.5 text-xs font-extrabold text-black hover:bg-rose-400 transition"
                      >
                        Browse Bio-Pesticides
                      </Link>
                      <Link
                        href="/dashboard/agronomists"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
                      >
                        Ask Agronomist
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
                <span className="text-4xl">🪤</span>
                <h3 className="mt-3 text-lg font-bold text-white">No Trap Analyzed Yet</h3>
                <p className="mt-1 text-xs text-white/50 max-w-xs mx-auto">
                  Submit a photo or enter a trap count on the left to view immediate ETL threshold diagnostics.
                </p>
              </div>
            )}

            {/* Historical Readings */}
            <div className="rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
              <h3 className="text-sm font-extrabold text-white flex items-center justify-between">
                <span>Recent Trap Readings</span>
                <span className="text-xs font-mono text-white/40">{history.length} logged</span>
              </h3>

              {historyLoading ? (
                <div className="mt-4 text-xs text-white/40 flex items-center gap-2">
                  <RefreshCw size={12} className="animate-spin" /> Loading history...
                </div>
              ) : history.length === 0 ? (
                <p className="mt-3 text-xs text-white/40">No past readings recorded for this cycle yet.</p>
              ) : (
                <div className="mt-4 space-y-2.5">
                  {history.slice(0, 5).map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-white capitalize">{item.pest_species?.replace("_", " ")}</p>
                        <p className="text-[10px] text-white/40 font-mono">{new Date(item.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold font-mono text-white">{item.count}</span>
                        <span
                          className={`ml-2 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${
                            item.action_needed ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {item.action_needed ? "ETL BREACH" : "SAFE"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
