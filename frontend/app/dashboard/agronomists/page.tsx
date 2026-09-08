"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  GraduationCap,
  Star,
  Video,
  MessageSquare,
  PhoneCall,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Sparkles,
  X,
  UserCheck
} from "lucide-react";
import { KisanXAPI } from "@/lib/api";

const SPECIALTIES = ["All", "Cotton Pest Management", "Sugarcane Red Rot & Yield", "Biological Crop Protection", "Soil & Fertilizer Optimization"];

export default function AskAnAgronomistPage() {
  const [agronomists, setAgronomists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");
  const [search, setSearch] = useState("");

  // Booking Modal State
  const [selectedAgro, setSelectedAgro] = useState<any | null>(null);
  const [channel, setChannel] = useState<"chat" | "voice" | "video">("chat");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingReceipt, setBookingReceipt] = useState<any | null>(null);

  const fetchAgronomists = async () => {
    setLoading(true);
    try {
      const specQuery = selectedSpecialty === "All" ? undefined : selectedSpecialty;
      const res = await KisanXAPI.listAgronomists(specQuery);
      setAgronomists(res.agronomists || []);
    } catch (err) {
      setAgronomists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgronomists();
  }, [selectedSpecialty]);

  const handleBookSession = async () => {
    if (!selectedAgro) return;
    setBookingLoading(true);
    try {
      const res = await KisanXAPI.bookConsultation({
        agronomist_id: selectedAgro.id,
        channel: channel,
      });
      setBookingReceipt(res);
    } catch (err: any) {
      alert("Booking failed: " + err.message);
    } finally {
      setBookingLoading(false);
    }
  };

  const filteredAgronomists = agronomists.filter((a) =>
    (a.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.specialisation || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.credentials || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#030604] text-white selection:bg-purple-500/30 selection:text-white">
      {/* Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-10 left-1/3 w-[600px] h-[600px] rounded-full blur-[190px] opacity-10 bg-purple-600" />
        <div className="absolute top-2/3 right-10 w-[500px] h-[500px] rounded-full blur-[180px] opacity-10 bg-teal-600" />
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
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 text-xs font-bold">
                  👨‍🌾
                </span>
                <h1 className="text-lg font-bold text-white tracking-tight">Ask-an-Agronomist (Expert Consultations)</h1>
              </div>
              <p className="text-[11px] text-white/50">Verified ICAR & KVK agricultural scientists available for 1-on-1 calls</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs text-purple-300 font-mono">
            <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
            10 Experts Online
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
        {/* FILTERS & SEARCH */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          {/* Specialty Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {SPECIALTIES.map((spec) => (
              <button
                key={spec}
                onClick={() => setSelectedSpecialty(spec)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  selectedSpecialty === spec
                    ? "bg-purple-500 text-white font-extrabold"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {spec}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by doctor or KVK..."
              className="w-full rounded-xl border border-white/15 bg-black/40 pl-9 pr-4 py-2 text-xs text-white placeholder-white/40 focus:border-purple-400 focus:outline-none"
            />
          </div>
        </div>

        {/* AGRONOMISTS DIRECTORY */}
        {loading ? (
          <div className="py-20 text-center text-xs text-white/40">
            <RefreshCw size={24} className="animate-spin text-purple-400 mx-auto" />
            <p className="mt-2">Finding available agronomists...</p>
          </div>
        ) : filteredAgronomists.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-white/10 rounded-3xl">
            <GraduationCap size={40} className="text-white/30 mx-auto" />
            <h4 className="mt-3 text-sm font-bold text-white">No Specialists Found for Selected Filter</h4>
            <p className="text-xs text-white/50 mt-1">
              Switch back to "All" to browse all verified ICAR/KVK agronomists.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAgronomists.map((agro) => (
              <div
                key={agro.id}
                className="group rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 backdrop-blur-xl hover:border-purple-500/40 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20 px-2.5 py-0.5 text-[10px] font-mono font-bold">
                        {agro.kvk_affiliation || "ICAR Research Scientist"}
                      </span>
                      <h3 className="mt-2.5 text-lg font-bold text-white group-hover:text-purple-300 transition">
                        {agro.name}
                      </h3>
                      <p className="text-xs text-white/60">{agro.credentials || "MSc/PhD Agri"}</p>
                    </div>

                    <div className="flex items-center gap-1 rounded-xl bg-amber-500/15 text-amber-300 px-2 py-1 text-xs font-bold font-mono">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      {agro.rating ? agro.rating.toFixed(1) : "4.9"}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/5 bg-black/30 p-3 text-xs text-white/70">
                    <span className="text-[10px] font-mono uppercase text-white/40 block mb-1">Domain Focus</span>
                    {agro.specialisation || "Cotton & Sugarcane Diagnostics"}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs font-mono text-white/50">
                    <span>{agro.total_sessions || 42}+ Sessions</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <UserCheck size={12} /> Available Now
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-xl font-extrabold font-mono text-white">₹{agro.fee_per_session || 30}</span>
                    <span className="text-[10px] text-white/40 block">per session</span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedAgro(agro);
                      setBookingReceipt(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.03] transition"
                  >
                    Book Session
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOOKING MODAL */}
      {selectedAgro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-[#090e0b] p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setSelectedAgro(null)}
              className="absolute top-5 right-5 text-white/50 hover:text-white"
            >
              <X size={18} />
            </button>

            {bookingReceipt ? (
              <div className="text-center py-6">
                <CheckCircle2 size={48} className="text-emerald-400 mx-auto" />
                <h3 className="text-lg font-bold text-white mt-3">Consultation Confirmed!</h3>
                <p className="text-xs text-white/60 mt-1">{bookingReceipt.message}</p>
                <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4 text-left text-xs font-mono space-y-1">
                  <p className="text-white/40">Session ID: <span className="text-white">{bookingReceipt.consultation?.id}</span></p>
                  <p className="text-white/40">Channel: <span className="text-purple-300 uppercase font-bold">{bookingReceipt.consultation?.channel}</span></p>
                  <p className="text-white/40">Status: <span className="text-emerald-400 font-bold">PENDING DOCTOR JOIN</span></p>
                </div>
                <button
                  onClick={() => setSelectedAgro(null)}
                  className="mt-6 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition"
                >
                  Return to Directory
                </button>
              </div>
            ) : (
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold">
                  Direct Expert Consultation
                </span>
                <h3 className="text-xl font-bold text-white mt-1">Book {selectedAgro.name}</h3>
                <p className="text-xs text-white/60">{selectedAgro.credentials}</p>

                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-white/60 mb-2">Select Channel</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setChannel("chat")}
                        className={`p-3 rounded-2xl border text-center transition ${
                          channel === "chat"
                            ? "border-purple-500 bg-purple-500/20 text-white font-bold"
                            : "border-white/10 bg-white/[0.02] text-white/60"
                        }`}
                      >
                        <MessageSquare size={18} className="mx-auto mb-1 text-purple-400" />
                        <span className="text-xs block">Chat</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setChannel("voice")}
                        className={`p-3 rounded-2xl border text-center transition ${
                          channel === "voice"
                            ? "border-purple-500 bg-purple-500/20 text-white font-bold"
                            : "border-white/10 bg-white/[0.02] text-white/60"
                        }`}
                      >
                        <PhoneCall size={18} className="mx-auto mb-1 text-purple-400" />
                        <span className="text-xs block">Voice Call</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setChannel("video")}
                        className={`p-3 rounded-2xl border text-center transition ${
                          channel === "video"
                            ? "border-purple-500 bg-purple-500/20 text-white font-bold"
                            : "border-white/10 bg-white/[0.02] text-white/60"
                        }`}
                      >
                        <Video size={18} className="mx-auto mb-1 text-purple-400" />
                        <span className="text-xs block">Video Call</span>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/40 p-4 flex items-center justify-between text-xs">
                    <span className="text-white/60">Session Fee (Subsidized):</span>
                    <span className="text-lg font-bold font-mono text-emerald-400">₹{selectedAgro.fee_per_session || 30}</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleBookSession}
                    disabled={bookingLoading}
                    className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-extrabold text-xs shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {bookingLoading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Scheduling Session...
                      </>
                    ) : (
                      "Confirm & Connect with Scientist"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
