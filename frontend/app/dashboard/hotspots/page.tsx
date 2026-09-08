"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  AlertTriangle,
  Flame,
  Filter,
  Plus,
  RefreshCw,
  Calendar,
  Layers,
  CheckCircle2,
  X
} from "lucide-react";
import { KisanXAPI } from "@/lib/api";

const COMMON_DISEASES = ["RedRot", "LeafCurl", "BacterialBlight", "Mosaic", "Rust"];

export default function HotspotsHeatmapPage() {
  const [days, setDays] = useState<number>(30);
  const [selectedDisease, setSelectedDisease] = useState<string>("All");
  const [hotspotsData, setHotspotsData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Report Outbreak Modal
  const [showModal, setShowModal] = useState(false);
  const [reportDisease, setReportDisease] = useState("RedRot");
  const [reportLat, setReportLat] = useState("19.5682");
  const [reportLng, setReportLng] = useState("74.2111");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const fetchHotspots = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = `days=${days}`;
      if (selectedDisease !== "All") {
        query += `&disease=${selectedDisease}`;
      }
      const data = await KisanXAPI.getHotspots(query);
      setHotspotsData(data);
    } catch (err: any) {
      setError(err.message || "Failed to load outbreak heatmap data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHotspots();
  }, [days, selectedDisease]);

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportLoading(true);
    try {
      await KisanXAPI.reportHotspot({
        disease: reportDisease,
        latitude: parseFloat(reportLat) || 19.5682,
        longitude: parseFloat(reportLng) || 74.2111,
        confirmed_by: "farmer",
      });
      setReportSuccess(true);
      setTimeout(() => {
        setReportSuccess(false);
        setShowModal(false);
        fetchHotspots();
      }, 1500);
    } catch (err: any) {
      alert("Failed to report outbreak: " + err.message);
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#030604] text-white selection:bg-rose-500/30 selection:text-white">
      {/* Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-10 left-1/3 w-[650px] h-[650px] rounded-full blur-[190px] opacity-15 bg-rose-600" />
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
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 text-xs font-bold">
                  🔥
                </span>
                <h1 className="text-lg font-bold text-white tracking-tight">Pest Migration Corridors & Outbreak Map</h1>
              </div>
              <p className="text-[11px] text-white/50">Regional geo-coded pathogen cluster intelligence</p>
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-500/20 hover:scale-105 transition"
          >
            <Plus size={14} /> Log Outbreak Case
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
        {/* FILTERS & WINDOW CONTROL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          {/* Disease Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-mono text-white/50 mr-1 flex items-center gap-1">
              <Filter size={12} /> Filter:
            </span>
            <button
              onClick={() => setSelectedDisease("All")}
              className={`rounded-full px-3 py-1 text-xs font-bold transition font-mono ${
                selectedDisease === "All" ? "bg-rose-500 text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              All Diseases
            </button>
            {COMMON_DISEASES.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDisease(d)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition font-mono ${
                  selectedDisease === d ? "bg-rose-500 text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Time Window */}
          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-white/40" />
            <span className="text-xs font-mono text-white/50">Window:</span>
            {[7, 30, 90].map((w) => (
              <button
                key={w}
                onClick={() => setDays(w)}
                className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition ${
                  days === w ? "bg-white/20 text-white" : "text-white/40 hover:text-white"
                }`}
              >
                {w}d
              </button>
            ))}
          </div>
        </div>

        {/* SUMMARY STATS BAR */}
        {hotspotsData && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
              <span className="text-xs uppercase font-mono tracking-wider text-white/50">Verified Outbreaks</span>
              <p className="mt-2 text-3xl font-extrabold font-mono text-rose-400">{hotspotsData.count || 0}</p>
              <p className="text-[11px] text-white/40 mt-1">Confirmed field cases in past {days} days</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
              <span className="text-xs uppercase font-mono tracking-wider text-white/50">Top Pathogen</span>
              <p className="mt-2 text-2xl font-extrabold text-amber-300">
                {Object.keys(hotspotsData.disease_summary || {})[0] || "None Recorded"}
              </p>
              <p className="text-[11px] text-white/40 mt-1">Highest regional incidence rate</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
              <span className="text-xs uppercase font-mono tracking-wider text-white/50">Bio-Security Status</span>
              <p className="mt-2 text-xl font-extrabold text-emerald-400 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                Active Surveillance
              </p>
              <p className="text-[11px] text-white/40 mt-1">Pest migration alerts synced</p>
            </div>
          </div>
        )}

        {/* RADAR MAP / CLUSTER CANVAS */}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 sm:p-8 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Flame size={18} className="text-rose-400" /> Regional Outbreak Cluster Grid
              </h3>
              <p className="text-xs text-white/50">Geo-spatial disease occurrence mapped across key agricultural districts.</p>
            </div>

            <button onClick={fetchHotspots} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {loading ? (
            <div className="py-20 text-center text-xs text-white/40">
              <RefreshCw size={24} className="animate-spin text-rose-400 mx-auto" />
              <p className="mt-2">Rendering geo-coded disease clusters...</p>
            </div>
          ) : hotspotsData?.reports?.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl">
              <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
              <h4 className="mt-3 text-sm font-bold text-white">No Outbreaks Detected in this Window</h4>
              <p className="text-xs text-white/50 mt-1">Zero confirmed cases reported for the selected filters.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hotspotsData?.reports?.map((r: any) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-4 hover:border-rose-500/40 transition backdrop-blur-xl"
                >
                  <div className="flex items-start justify-between">
                    <span className="rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-bold font-mono uppercase">
                      {r.disease}
                    </span>
                    <span className="text-[10px] font-mono text-white/40">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-xs font-mono text-white/80">
                    <MapPin size={13} className="text-rose-400 shrink-0" />
                    <span>{r.latitude?.toFixed(4)}° N, {r.longitude?.toFixed(4)}° E</span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-white/50">
                    <span>Verified by: <strong className="text-white capitalize">{r.confirmed_by}</strong></span>
                    <span className="text-rose-400 text-xs">Active Hotspot</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* REPORT OUTBREAK MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-[#090e0b] p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 text-white/50 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-rose-400">
              <Flame size={20} />
              <h3 className="text-lg font-bold text-white">Report Confirmed Outbreak</h3>
            </div>
            <p className="text-xs text-white/60 mt-1">
              Add a verified pest or foliar infection case to protect surrounding growers.
            </p>

            {reportSuccess ? (
              <div className="my-8 text-center text-emerald-400">
                <CheckCircle2 size={40} className="mx-auto" />
                <p className="mt-2 text-sm font-bold">Outbreak Recorded Successfully!</p>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-white/60 mb-1">Pathogen / Disease</label>
                  <select
                    value={reportDisease}
                    onChange={(e) => setReportDisease(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-xs text-white focus:border-rose-400 focus:outline-none"
                  >
                    {COMMON_DISEASES.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono uppercase text-white/60 mb-1">Latitude</label>
                    <input
                      type="text"
                      value={reportLat}
                      onChange={(e) => setReportLat(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs font-mono text-white focus:border-rose-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-white/60 mb-1">Longitude</label>
                    <input
                      type="text"
                      value={reportLng}
                      onChange={(e) => setReportLng(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs font-mono text-white focus:border-rose-400 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={reportLoading}
                  className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white font-bold text-xs shadow-lg shadow-rose-500/20 hover:scale-[1.02] transition disabled:opacity-50"
                >
                  {reportLoading ? "Broadcasting Case..." : "Broadcast Outbreak Case"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
