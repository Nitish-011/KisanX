"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  ShieldCheck,
  CheckCircle2,
  Store,
  Phone,
  MapPin,
  RefreshCw,
  Search,
  Filter,
  Plus,
  X,
  ExternalLink
} from "lucide-react";
import { KisanXAPI } from "@/lib/api";

const CATEGORIES = [
  { id: "all", name: "All Inputs" },
  { id: "pesticide", name: "Bio & Chemical Pesticides" },
  { id: "fertilizer", name: "Nutrients & Fertilizers" },
  { id: "seed", name: "Certified Hybrid Seeds" },
  { id: "bio_control", name: "Biological Control Agents" },
];

export default function VerifiedInputsMarketplacePage() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [sellers, setSellers] = useState<any[]>([]);
  const [sellersLoading, setSellersLoading] = useState(false);

  // Register Merchant Modal
  const [showMerchantModal, setShowMerchantModal] = useState(false);
  const [merchantName, setMerchantName] = useState("");
  const [merchantLicense, setMerchantLicense] = useState("");
  const [merchantDistrict, setMerchantDistrict] = useState("Ahmednagar");
  const [merchantPhone, setMerchantPhone] = useState("");
  const [merchantSubmitting, setMerchantSubmitting] = useState(false);
  const [merchantSuccess, setMerchantSuccess] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      try {
        const catQuery = category === "all" ? undefined : category;
        const res = await KisanXAPI.listInputProducts(catQuery);
        setProducts(res.products || []);
      } catch (err) {
        // non-critical
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [category]);

  const viewSellers = async (prod: any) => {
    setSelectedProduct(prod);
    setSellersLoading(true);
    try {
      const res = await KisanXAPI.getProductSellers(prod.id);
      setSellers(res.sellers || []);
    } catch (err) {
      setSellers([]);
    } finally {
      setSellersLoading(false);
    }
  };

  const handleRegisterMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    setMerchantSubmitting(true);
    try {
      await KisanXAPI.registerSeller({
        name: merchantName,
        license_no: merchantLicense,
        district: merchantDistrict,
        phone: merchantPhone,
      });
      setMerchantSuccess(true);
      setTimeout(() => {
        setMerchantSuccess(false);
        setShowMerchantModal(false);
      }, 1500);
    } catch (err: any) {
      alert("Failed to register merchant: " + err.message);
    } finally {
      setMerchantSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) =>
    (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.active_ingredient || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#030604] text-white selection:bg-emerald-500/30 selection:text-white">
      {/* Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-10 left-1/4 w-[600px] h-[600px] rounded-full blur-[180px] opacity-10 bg-emerald-600" />
        <div className="absolute top-1/2 right-10 w-[500px] h-[500px] rounded-full blur-[180px] opacity-10 bg-teal-600" />
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
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                  🌱
                </span>
                <h1 className="text-lg font-bold text-white tracking-tight">Verified Agri-Inputs Marketplace</h1>
              </div>
              <p className="text-[11px] text-white/50">CIB-registered certified pesticides, bio-controls & seeds</p>
            </div>
          </div>

          <button
            onClick={() => setShowMerchantModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/15 transition border border-white/10"
          >
            <Store size={14} /> Register as Merchant
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
        {/* FILTERS & SEARCH */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  category === cat.id
                    ? "bg-emerald-500 text-black font-extrabold"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {cat.name}
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
              placeholder="Search ingredient or brand..."
              className="w-full rounded-xl border border-white/15 bg-black/40 pl-9 pr-4 py-2 text-xs text-white placeholder-white/40 focus:border-emerald-400 focus:outline-none"
            />
          </div>
        </div>

        {/* PRODUCTS GRID */}
        {loading ? (
          <div className="py-20 text-center text-xs text-white/40">
            <RefreshCw size={24} className="animate-spin text-emerald-400 mx-auto" />
            <p className="mt-2">Loading certified input registry...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-white/10 rounded-3xl">
            <Package size={36} className="text-white/30 mx-auto" />
            <h4 className="mt-3 text-sm font-bold text-white">No Products Found</h4>
            <p className="text-xs text-white/50 mt-1">Try switching categories or clearing search keywords.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((prod) => (
              <div
                key={prod.id}
                className="group rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 backdrop-blur-xl hover:border-emerald-500/40 transition"
              >
                <div className="flex items-start justify-between">
                  <span className="rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase">
                    {prod.category || "Input"}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-300">
                    <ShieldCheck size={13} /> Verified
                  </span>
                </div>

                <h3 className="mt-3 text-lg font-bold text-white group-hover:text-emerald-300 transition">
                  {prod.name}
                </h3>
                <p className="text-xs text-white/60 mt-1 font-mono">Active: {prod.active_ingredient}</p>

                {prod.cib_registration_no && (
                  <div className="mt-4 rounded-xl border border-white/5 bg-black/30 p-2 text-[11px] font-mono text-white/50">
                    CIB Ref: <strong className="text-white/80">{prod.cib_registration_no}</strong>
                  </div>
                )}

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs font-mono text-white/50">Authorized Sellers</span>
                  <button
                    onClick={() => viewSellers(prod)}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 text-xs font-bold hover:bg-emerald-500/30 transition"
                  >
                    Compare Dealers <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DEALERS DRAWER / MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-[#090e0b] p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-5 right-5 text-white/50 hover:text-white"
            >
              <X size={18} />
            </button>

            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
              Regional Merchant Comparison
            </span>
            <h3 className="text-xl font-bold text-white mt-1">{selectedProduct.name}</h3>
            <p className="text-xs text-white/60 mt-0.5">Active Ingredient: {selectedProduct.active_ingredient}</p>

            <div className="mt-6">
              {sellersLoading ? (
                <div className="py-12 text-center text-xs text-white/40">
                  <RefreshCw size={20} className="animate-spin text-emerald-400 mx-auto" />
                  <p className="mt-2">Finding nearby licensed merchants...</p>
                </div>
              ) : sellers.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-white/10 rounded-2xl">
                  <Store size={32} className="text-white/30 mx-auto" />
                  <p className="mt-2 text-xs text-white/50">No regional merchants currently listed with live inventory.</p>
                  <p className="text-[10px] text-white/30 mt-1">Merchants can register via the button on top.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {sellers.map((s: any, idx) => (
                    <div
                      key={s.id || idx}
                      className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-bold text-sm text-white">{s.seller_name || "Agri Dealer"}</h4>
                        <div className="flex items-center gap-3 text-[11px] font-mono text-white/50 mt-1">
                          <span className="flex items-center gap-1">
                            <MapPin size={11} /> {s.district || "Local Mandi"}
                          </span>
                          {s.phone && (
                            <span className="flex items-center gap-1 text-emerald-400">
                              <Phone size={11} /> {s.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-extrabold font-mono text-emerald-400">₹{s.price}</span>
                        <span className="block text-[10px] text-white/40">/ {s.unit || "pack"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REGISTER MERCHANT MODAL */}
      {showMerchantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-[#090e0b] p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setShowMerchantModal(false)}
              className="absolute top-5 right-5 text-white/50 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-emerald-400">
              <Store size={20} />
              <h3 className="text-lg font-bold text-white">Register Agricultural Store</h3>
            </div>
            <p className="text-xs text-white/60 mt-1">
              List certified bio-pesticides and inputs directly to regional farmers.
            </p>

            {merchantSuccess ? (
              <div className="my-8 text-center text-emerald-400">
                <CheckCircle2 size={40} className="mx-auto" />
                <p className="mt-2 text-sm font-bold">Store Registered (Pending CIB Review)!</p>
              </div>
            ) : (
              <form onSubmit={handleRegisterMerchant} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-white/60 mb-1">Store / Business Name</label>
                  <input
                    type="text"
                    required
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    placeholder="e.g. Kisan Krishi Seva Kendra"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-white/60 mb-1">Pesticide / Seed License No</label>
                  <input
                    type="text"
                    required
                    value={merchantLicense}
                    onChange={(e) => setMerchantLicense(e.target.value)}
                    placeholder="e.g. LIC-MH-2026-881"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-xs font-mono text-white focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono uppercase text-white/60 mb-1">District</label>
                    <input
                      type="text"
                      value={merchantDistrict}
                      onChange={(e) => setMerchantDistrict(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-white/60 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={merchantPhone}
                      onChange={(e) => setMerchantPhone(e.target.value)}
                      placeholder="+91..."
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs font-mono text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={merchantSubmitting}
                  className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition disabled:opacity-50"
                >
                  {merchantSubmitting ? "Submitting License..." : "Submit for Verification"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
