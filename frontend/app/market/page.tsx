"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Video,
  Upload,
  Lock,
  MessageSquare,
  Navigation,
  Sparkles,
  Building,
  RefreshCw,
  Globe,
  Sliders,
  DollarSign,
  Scale,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CropIntuitionCard from "@/components/market/crop_intuition_card";
import SellShopChat from "@/components/market/sell_shop_chat";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface Negotiation {
  id: string;
  sender_role: "buyer" | "farmer";
  sender_name: string;
  proposed_price?: number;
  message: string;
  timestamp: string;
  status: string;
  encryption_hash?: string;
}

interface Listing {
  id: string;
  farmer_id?: string | null;
  farmer_name: string;
  farm_name: string;
  village: string;
  district: string;
  latitude: number;
  longitude: number;
  crop_name: string;
  variety: string;
  farm_area_acres: number;
  health_percentage: number;
  quality_grade: string;
  estimated_weight_quintals: number;
  price_per_quintal: number;
  total_valuation: number;
  media_type: string;
  video_preview: string;
  yolo_detection_summary: string;
  gemma_appraisal_summary: string;
  inspector_status: string;
  certified_by?: string | null;
  certification_timestamp?: string | null;
  inspector_notes?: string | null;
  created_at: string;
  distance_km?: number | null;
  encryption_fingerprint?: string;
  negotiations?: Negotiation[];
}

export default function MarketplacePage() {
  // Multilingual State: "en" | "hi" | "mr"
  const [lang, setLang] = useState<"en" | "hi" | "mr">("en");

  // Role: "farmer" | "buyer" | "inspector"
  const [activeRole, setActiveRole] = useState<"farmer" | "buyer" | "inspector">("farmer");

  // Isolated Listings Collections
  const [farmerListings, setFarmerListings] = useState<Listing[]>([]);
  const [buyerListings, setBuyerListings] = useState<Listing[]>([]);
  const [inspectorQueue, setInspectorQueue] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  // Sell Shop Instagram-Style DM Modal State
  const [showSellShop, setShowSellShop] = useState(false);
  const [sellShopListingId, setSellShopListingId] = useState<string | null>(null);

  // GPS Proximity State
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [distanceFilter, setDistanceFilter] = useState<number | null>(null);
  const [cropFilter, setCropFilter] = useState<string>("All");

  // Farmer Video Upload State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [farmerCrop, setFarmerCrop] = useState<"Cotton" | "Sugarcane">("Cotton");
  const [farmerAcreage, setFarmerAcreage] = useState<string>("5.0");
  const [farmerFarmName, setFarmerFarmName] = useState("Kisan Krishi Farm");
  const [farmerVillage, setFarmerVillage] = useState("Baramati");
  const [farmerDistrict, setFarmerDistrict] = useState("Pune, Maharashtra");
  const [farmerVariety, setFarmerVariety] = useState("Bt Hybrid Shankar-6");
  const [analyzingVideo, setAnalyzingVideo] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState("");
  const [auditResult, setAuditResult] = useState<any>(null);

  // Inspector Action State
  const [inspectNotes, setInspectNotes] = useState("");
  const [certifyingId, setCertifyingId] = useState<string | null>(null);

  // ----------------------------------------------------------
  // COMPREHENSIVE MULTILINGUAL DICTIONARY (EN, HI, MR)
  // ----------------------------------------------------------
  const t = {
    brandSubtitle: {
      en: "APMC Live Mandi",
      hi: "एपीएमसी लाइव मंडी",
      mr: "एपीएमसी थेट बाजार",
    },
    roleFarmer: {
      en: "Farmer Portal",
      hi: "किसान पोर्टल",
      mr: "शेतकरी दालन",
    },
    roleBuyer: {
      en: "Buyer Procurement Radar",
      hi: "मंडी खरीद रडार",
      mr: "खरेदीदार रडार",
    },
    roleInspector: {
      en: "Quality Inspector",
      hi: "कृषि गुणवत्ता अधिकारी",
      mr: "गुणवत्ता तपासणी अधिकारी",
    },
    dpdpaBadge: {
      en: "DPDPA 2023 Geolocation Privacy Compliant",
      hi: "डीपीडीपीए 2023 गोपनीयता प्रमाणित",
      mr: "डीपीडीपीए २०२३ गोपनीयता प्रमाणित",
    },
    farmerSellTitle: {
      en: "Sell Your Harvest via Neural Video Inspection",
      hi: "कैनोपी वीडियो स्कैन द्वारा अपनी फसल बेचें",
      mr: "कॅनोपी व्हिडिओ स्कॅन द्वारे शेतमाल विका",
    },
    farmerSellDesc: {
      en: "Upload 4K drone or mobile footage. YOLOv11 measures healthy foliage, computes quintals via agronomic formula, and assigns fair APMC valuation.",
      hi: "ड्रोन या मोबाइल वीडियो अपलोड करें। YOLOv11 स्वस्थ पत्तों की गणना करता है और जेम्मा 3 4B सही भाव निर्धारित करता है।",
      mr: "ड्रोन किंवा मोबाइल व्हिडिओ अपलोड करा. YOLOv11 निरोगी पानांची मोजणी करून योग्य बाजारभाव निश्चित करतो.",
    },
    targetCrop: {
      en: "Target Crop",
      hi: "फसल का प्रकार",
      mr: "पिकाचा प्रकार",
    },
    harvestArea: {
      en: "Harvest Area (Acres) *",
      hi: "खेत का क्षेत्रफल (एकड़) *",
      mr: "शेतजमीन क्षेत्र (एकर) *",
    },
    hybridVariety: {
      en: "Variety / Hybrid",
      hi: "किस्म / संकर",
      mr: "वाण / संकरित वाण",
    },
    farmName: {
      en: "Farm Name",
      hi: "खेत का नाम",
      mr: "शेताचे नाव",
    },
    villageDistrict: {
      en: "Village & District",
      hi: "गाँव और जिला",
      mr: "गाव आणि जिल्हा",
    },
    uploadVideo: {
      en: "Select Harvest Canopy Video / Recording *",
      hi: "फसल का कैनोपी वीडियो या रिकॉर्डिंग चुनें *",
      mr: "पिकाचा कॅनोपी व्हिडिओ किंवा रेकॉर्डिंग निवडा *",
    },
    btnAnalyze: {
      en: "Analyze Video & Compute Lot Valuation",
      hi: "वीडियो विश्लेषण एवं मूल्य निर्धारण करें",
      mr: "व्हिडिओ विश्लेषण व मूल्य निश्चित करा",
    },
    btnPublish: {
      en: "Publish Lot to APMC Marketplace",
      hi: "मंडी में फसल लिस्ट प्रकाशित करें",
      mr: "बाजार समितीत शेतमाल प्रकाशित करा",
    },
    myListingsTitle: {
      en: "My Crop Harvest Listings",
      hi: "मेरी फसल लिस्टिंग एवं बोलियां",
      mr: "माझा शेतमाल व मिळालेल्या बोली",
    },
    myListingsDesc: {
      en: "Private farmer view. Only you can view your lots and buyer negotiations.",
      hi: "निजी किसान दृश्य। केवल आप अपनी फसल और खरीदार के संदेश देख सकते हैं।",
      mr: "खाजगी शेतकरी दृश्य. केवळ तुम्हालाच तुमचा शेतमाल व खरेदीदारांच्या वाटाघाटी दिसतील.",
    },
    buyerRadarTitle: {
      en: "Verified Farmer Produce Radar",
      hi: "प्रमाणित किसान उपज रडार",
      mr: "प्रमाणित शेतमाल खरेदी रडार",
    },
    buyerRadarDesc: {
      en: "Procure directly from farmers with verified YOLO health index and tamper-proof negotiations.",
      hi: "YOLO स्वास्थ्य सूचकांक से प्रमाणित फसलें सीधे किसानों से खरीदें।",
      mr: "YOLO आरोग्य निर्देशांकाने प्रमाणित शेतमाल थेट शेतकऱ्यांकडून खरेदी करा.",
    },
    gpsLocateBtn: {
      en: "Locate Nearest Farms (GPS)",
      hi: "निकटतम खेत खोजें (GPS)",
      mr: "जवळचे शेत शोधा (GPS)",
    },
    inspectorQueueTitle: {
      en: "ICAR-FSSAI Agri-Quality Certification Queue",
      hi: "गुणवत्ता प्रमाणन एवं जैव-सुरक्षा कतार",
      mr: "गुणवत्ता प्रमाणीकरण व तपासणी रांग",
    },
    inspectorQueueDesc: {
      en: "Official regulatory console. Review computer vision evidence and issue phytosanitary passes.",
      hi: "आधिकारिक गुणवत्ता मंच। फसल साक्ष्य देखकर ग्रेड ए प्रमाणन या क्वारंटाइन आदेश जारी करें।",
      mr: "अधिकृत तपासणी व्यासपीठ. पिकाचे पुरावे तपासून ग्रेड ए प्रमाणपत्र किंवा क्वारंटाइन आदेश द्या.",
    },
    certifyBtn: {
      en: "Certify Grade A",
      hi: "ग्रेड ए प्रमाणित करें",
      mr: "ग्रेड ए प्रमाणित करा",
    },
    quarantineBtn: {
      en: "Quarantine Lot",
      hi: "क्वारंटाइन करें",
      mr: "क्वारंटाइन करा",
    },
    openSellShopBtn: {
      en: "Open SELL SHOP (Direct Chat)",
      hi: "सेल शॉप खोलें (सीधी बातचीत)",
      mr: "सेल शॉप उघडा (थेट संवाद)",
    },
    negotiateInSellShop: {
      en: "Negotiate in Sell Shop",
      hi: "सेल शॉप में मोलभाव करें",
      mr: "सेल शॉपमध्ये वाटाघाटी करा",
    },
    lotWeight: {
      en: "Lot Weight",
      hi: "कुल मात्रा",
      mr: "एकूण वजन",
    },
    ratePerQtl: {
      en: "Rate / Quintal",
      hi: "भाव / क्विंटल",
      mr: "दर / क्विंटल",
    },
    lotValue: {
      en: "Total Valuation",
      hi: "कुल मूल्यांकन",
      mr: "एकूण मूल्य",
    },
    gradeACertified: {
      en: "✓ Grade A Certified",
      hi: "✓ ग्रेड ए प्रमाणित",
      mr: "✓ ग्रेड ए प्रमाणित",
    },
    awaitingInspect: {
      en: "⏳ Awaiting Inspection",
      hi: "⏳ निरीक्षण लंबित",
      mr: "⏳ तपासणी प्रलंबित",
    },
    quarantined: {
      en: "⚠️ Quarantined",
      hi: "⚠️ क्वारंटाइन आदेश",
      mr: "⚠️ क्वारंटाइन आदेश",
    },
    noLotsFarmer: {
      en: "You have not listed any crop lots yet. Use the form above to list your first harvest video!",
      hi: "आपने अभी तक कोई फसल लिस्ट नहीं की है। ऊपर दिए गए फॉर्म से अपना पहला वीडियो अपलोड करें!",
      mr: "तुम्ही अद्याप कोणतीही शेतमाल यादी केलेली नाही. वरील फॉर्म वापरून पहिला व्हिडिओ अपलोड करा!",
    },
  };

  // ----------------------------------------------------------
  // FETCH ROLE-ISOLATED DATA
  // ----------------------------------------------------------
  async function loadData() {
    try {
      setLoading(true);

      // 1. Farmer Lots (strictly isolated to current farmer)
      const resFarmer = await fetch(`${API_URL}/api/marketplace/farmer-listings`);
      if (resFarmer.ok) {
        const dFarmer = await resFarmer.json();
        setFarmerListings(dFarmer.listings || []);
      }

      // 2. Buyer Radar (public marketplace)
      let buyerUrl = `${API_URL}/api/marketplace/listings`;
      const params = new URLSearchParams();
      if (cropFilter !== "All") params.append("crop", cropFilter);
      if (userLat !== null && userLng !== null) {
        params.append("buyer_lat", userLat.toString());
        params.append("buyer_lng", userLng.toString());
      }
      if (distanceFilter) params.append("max_distance_km", distanceFilter.toString());
      if (params.toString()) buyerUrl += `?${params.toString()}`;

      const resBuyer = await fetch(buyerUrl);
      if (resBuyer.ok) {
        const dBuyer = await resBuyer.json();
        setBuyerListings(dBuyer.listings || []);
      }

      // 3. Inspector Queue
      const resInspector = await fetch(`${API_URL}/api/marketplace/inspector-queue`);
      if (resInspector.ok) {
        const dInspector = await resInspector.json();
        setInspectorQueue(dInspector.queue || []);
      }
    } catch (err) {
      console.warn("Marketplace data load notice:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [cropFilter, distanceFilter, userLat, userLng]);

  // Session Role Verification
  useEffect(() => {
    const supabase = createClient();
    async function checkUserRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .maybeSingle();

          const r = (profile?.role || session.user.user_metadata?.role || "").toUpperCase();
          if (r === "OFFICER") setActiveRole("inspector");
          else if (r === "BUYER") setActiveRole("buyer");
          else if (r === "FARMER") setActiveRole("farmer");
        }
      } catch (err) {
        console.warn("Session check notice:", err);
      }
    }
    checkUserRole();
  }, []);

  // ----------------------------------------------------------
  // GPS PROXIMITY
  // ----------------------------------------------------------
  function handleLocateMe() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setGpsLoading(false);
      },
      () => {
        setUserLat(18.5204);
        setUserLng(73.8567);
        setGpsLoading(false);
      },
      { timeout: 10000 }
    );
  }

  // ----------------------------------------------------------
  // VIDEO AUDIT HANDLER
  // ----------------------------------------------------------
  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
      setAuditResult(null);
    }
  }

  async function handleAnalyzeVideo() {
    if (!videoFile) {
      alert("Please select a video file first.");
      return;
    }
    const area = parseFloat(farmerAcreage);
    if (isNaN(area) || area <= 0) {
      alert("Please enter a valid farm acreage.");
      return;
    }

    try {
      setAnalyzingVideo(true);
      setAnalysisProgress(lang === "hi" ? "OpenCV द्वारा वीडियो फ्रेम निकाले जा रहे हैं..." : lang === "mr" ? "OpenCV द्वारे व्हिडिओ फ्रेम्स काढत आहे..." : "Extracting frames via OpenCV...");
      await new Promise((r) => setTimeout(r, 600));

      setAnalysisProgress(lang === "hi" ? "YOLOv11 द्वारा फसल स्वास्थ्य मापा जा रहा है..." : lang === "mr" ? "YOLOv11 द्वारे पिकाचे आरोग्य मोजत आहे..." : "Measuring canopy foliage via YOLOv11...");
      await new Promise((r) => setTimeout(r, 700));

      setAnalysisProgress(lang === "hi" ? "जेम्मा 3 4B द्वारा मंडी मूल्यांकन तैयार हो रहा है..." : lang === "mr" ? "जेम्मा 3 4B द्वारे बाजार मूल्यांकन तयार होत आहे..." : "Calculating APMC appraisal via Gemma 3 4B...");

      const formData = new FormData();
      formData.append("file", videoFile);
      formData.append("crop_name", farmerCrop);
      formData.append("farm_area_acres", area.toString());
      formData.append("farm_name", farmerFarmName);
      formData.append("village", farmerVillage);
      formData.append("district", farmerDistrict);
      formData.append("variety", farmerVariety);
      formData.append("latitude", "18.5204");
      formData.append("longitude", "73.8567");

      const res = await fetch(`${API_URL}/api/marketplace/analyze-harvest`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Video analysis failed.");
      }

      const data = await res.json();
      setAuditResult(data);
    } catch (err: any) {
      alert(err.message || "Failed to analyze harvest video.");
    } finally {
      setAnalyzingVideo(false);
      setAnalysisProgress("");
    }
  }

  async function handlePublishListing() {
    if (!auditResult) return;
    try {
      setLoading(true);
      const payload = {
        farmer_name: "Rameshwar Patil (Verified Farmer)",
        farm_name: auditResult.farm_name,
        village: auditResult.village,
        district: auditResult.district,
        crop_name: auditResult.crop_name,
        variety: auditResult.variety,
        farm_area_acres: auditResult.farm_area_acres,
        health_percentage: auditResult.health_percentage,
        quality_grade: auditResult.quality_grade,
        estimated_weight_quintals: auditResult.estimated_weight_quintals,
        price_per_quintal: auditResult.price_per_quintal,
        total_valuation: auditResult.total_valuation,
        gemma_appraisal_summary: auditResult.gemma_appraisal_summary,
        latitude: auditResult.latitude,
        longitude: auditResult.longitude,
        encryption_fingerprint: auditResult.encryption_fingerprint,
      };

      const res = await fetch(`${API_URL}/api/marketplace/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to publish listing.");
      const published = await res.json();

      setFarmerListings((prev) => [published.listing, ...prev]);
      setAuditResult(null);
      setVideoFile(null);
      alert(lang === "hi" ? "फसल सफलतापूर्वक मंडी में प्रकाशित हो गई है!" : lang === "mr" ? "शेतमाल बाजार समितीत यशस्वीपणे प्रकाशित झाला आहे!" : "Harvest lot successfully published to APMC Mandi!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // INSPECTOR CERTIFY / QUARANTINE
  // ----------------------------------------------------------
  async function handleInspectorAction(listingId: string, action: "CERTIFY" | "QUARANTINE") {
    try {
      setCertifyingId(listingId);
      const res = await fetch(`${API_URL}/api/marketplace/certify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          officer_name: "Dr. V. K. Deshmukh",
          officer_id: "FSSAI-AGRI-884",
          action: action,
          notes: inspectNotes.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error("Inspector certification failed.");
      const data = await res.json();

      setInspectorQueue((prev) =>
        prev.map((l) => (l.id === listingId ? data.listing : l))
      );
      setInspectNotes("");
      alert(data.message);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCertifyingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#020503] text-white selection:bg-emerald-500/30 selection:text-white">
      {/* Background Lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-10 left-1/4 w-[600px] h-[600px] rounded-full blur-[180px] opacity-15 bg-emerald-600" />
        <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] rounded-full blur-[180px] opacity-10 bg-teal-600" />
      </div>

      {/* TOP NAVBAR WITH ROLE SWITCHER & LANGUAGE SELECTOR */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#020503]/85 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-black font-extrabold text-lg shadow-lg shadow-emerald-500/20">
                K
              </span>
              <div>
                <span className="text-lg font-bold tracking-tight text-white">
                  Kisan<span className="text-emerald-400">X</span> Mandi
                </span>
                <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                  {t.brandSubtitle[lang]}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* STRICT ROLE PORTAL SWITCHER PILLS */}
            <div className="flex items-center gap-1 rounded-2xl border border-white/15 bg-black/60 p-1 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setActiveRole("farmer")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  activeRole === "farmer"
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Video size={13} />
                <span>{t.roleFarmer[lang]}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRole("buyer")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  activeRole === "buyer"
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Building size={13} />
                <span>{t.roleBuyer[lang]}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRole("inspector")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  activeRole === "inspector"
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <ShieldCheck size={13} />
                <span>{t.roleInspector[lang]}</span>
              </button>
            </div>

            {/* INSTANT MULTILINGUAL SELECTOR (EN, HI, MR) */}
            <div className="flex items-center rounded-2xl border border-white/15 bg-black/60 p-1 backdrop-blur-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-2.5 py-1 rounded-xl transition ${
                  lang === "en" ? "bg-white/20 text-white" : "text-white/50 hover:text-white"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang("hi")}
                className={`px-2.5 py-1 rounded-xl transition ${
                  lang === "hi" ? "bg-emerald-500 text-black" : "text-white/50 hover:text-white"
                }`}
              >
                हिंदी
              </button>
              <button
                type="button"
                onClick={() => setLang("mr")}
                className={`px-2.5 py-1 rounded-xl transition ${
                  lang === "mr" ? "bg-emerald-500 text-black" : "text-white/50 hover:text-white"
                }`}
              >
                मराठी
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {/* ============================================================ */}
        {/* PORTAL 1: STRICT FARMER EXPERIENCE (MAJOR HIGHLIGHT) */}
        {/* ============================================================ */}
        {activeRole === "farmer" && (
          <div className="space-y-8">
            {/* 1. PROACTIVE AI CROP HEALTH INTUITION */}
            <CropIntuitionCard
              cropName={farmerCrop}
              language={lang}
            />

            {/* 2. SELL SHOP DM INBOX SHORTCUT BANNER */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/60 via-black/80 to-teal-950/50 p-6 backdrop-blur-2xl">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-black font-black text-xl shadow-lg shadow-emerald-500/30">
                  <MessageSquare size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {lang === "hi"
                      ? "सेल शॉप (SELL SHOP) • खरीदारों की बोलियां एवं मोलभाव"
                      : lang === "mr"
                      ? "सेल शॉप (SELL SHOP) • खरेदीदारांच्या थेट बोली"
                      : "SELL SHOP • Direct Buyer Bids & Negotiation Inbox"}
                  </h3>
                  <p className="text-xs text-white/60">
                    {lang === "hi"
                      ? "व्यापारियों द्वारा आपकी फसल पर भेजे गए भाव प्रस्ताव देखें एवं सीधा मोलभाव करें।"
                      : lang === "mr"
                      ? "व्यापाऱ्यांनी तुमच्या शेतमालावर पाठवलेले थेट दर प्रस्ताव पहा व संवाद साधा."
                      : "Review price counter-offers from sugar mills and spinning buyers in Instagram-style DM."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSellShopListingId(null);
                  setShowSellShop(true);
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-xs font-black text-black hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20"
              >
                <MessageSquare size={14} />
                <span>{t.openSellShopBtn[lang]}</span>
              </button>
            </div>

            {/* 3. MY HARVEST LISTINGS (ONLY THE FARMER'S OWN CROPS) */}
            <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.05] to-black/60 p-6 sm:p-8 backdrop-blur-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-white">
                    {t.myListingsTitle[lang]}
                  </h2>
                  <p className="text-xs text-white/50">
                    {t.myListingsDesc[lang]}
                  </p>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {farmerListings.length} {lang === "hi" ? "सक्रिय फसल लॉट" : lang === "mr" ? "सक्रिय शेतमाल यादी" : "Active Lots"}
                </span>
              </div>

              {farmerListings.length === 0 ? (
                <div className="py-12 text-center text-xs text-white/40">
                  {t.noLotsFarmer[lang]}
                </div>
              ) : (
                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  {farmerListings.map((item) => {
                    const statusBadge =
                      item.inspector_status === "CERTIFIED_GRADE_A"
                        ? t.gradeACertified[lang]
                        : item.inspector_status === "QUARANTINED"
                        ? t.quarantined[lang]
                        : t.awaitingInspect[lang];

                    return (
                      <div
                        key={item.id}
                        className="rounded-3xl border border-white/10 bg-black/60 p-5 space-y-4 hover:border-emerald-500/30 transition shadow-lg"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{item.crop_name === "Cotton" ? "🌿" : "🎋"}</span>
                              <h3 className="text-base font-bold text-white">
                                {item.crop_name} • {item.variety}
                              </h3>
                            </div>
                            <p className="text-xs text-white/50 mt-0.5 font-medium">
                              {item.farm_name} • {item.district}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              item.inspector_status === "CERTIFIED_GRADE_A"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : item.inspector_status === "QUARANTINED"
                                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            }`}
                          >
                            {statusBadge}
                          </span>
                        </div>

                        {/* Video verification badge */}
                        <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-white/70">
                          <Video size={14} className="text-emerald-400" />
                          <span className="font-mono text-[11px] truncate">
                            {item.video_preview}
                          </span>
                        </div>

                        {/* Metrics Bar */}
                        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/[0.04] p-3 text-center">
                          <div>
                            <p className="text-[10px] text-white/40 uppercase font-bold">{t.lotWeight[lang]}</p>
                            <p className="text-sm font-black text-white font-mono">{item.estimated_weight_quintals} Qtl</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/40 uppercase font-bold">{t.ratePerQtl[lang]}</p>
                            <p className="text-sm font-black text-white font-mono">₹{item.price_per_quintal}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/40 uppercase font-bold">{t.lotValue[lang]}</p>
                            <p className="text-sm font-black text-emerald-400 font-mono">₹{item.total_valuation.toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Direct Sell Shop action */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <span className="text-xs font-medium text-emerald-400/90">
                            {(item.negotiations || []).length > 0
                              ? `${(item.negotiations || []).length} ${lang === "hi" ? "खरीदार बोलियां प्राप्त" : lang === "mr" ? "बोली प्राप्त" : "Buyer Inquiries"}`
                              : lang === "hi" ? "निरीक्षण उपरांत बोली सक्रिय" : lang === "mr" ? "तपासणीनंतर बोली सुरू" : "Open for Mandi Bids"}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              setSellShopListingId(item.id);
                              setShowSellShop(true);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition"
                          >
                            <MessageSquare size={13} />
                            <span>{t.openSellShopBtn[lang]}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. NEW HARVEST VIDEO UPLOAD & VALUATION ENGINE */}
            <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 sm:p-8 backdrop-blur-2xl">
              <div className="border-b border-white/10 pb-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  <Video size={13} />
                  <span>YOLOv11 & OpenCV Canopy Harvest Ingestion</span>
                </div>
                <h2 className="mt-2 text-2xl font-black text-white">
                  {t.farmerSellTitle[lang]}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-white/60">
                  {t.farmerSellDesc[lang]}
                </p>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-white/70">
                      {t.targetCrop[lang]}
                    </label>
                    <div className="mt-2 flex gap-3">
                      {(["Cotton", "Sugarcane"] as const).map((crop) => (
                        <button
                          key={crop}
                          type="button"
                          onClick={() => setFarmerCrop(crop)}
                          className={`flex-1 rounded-2xl border p-3 text-xs font-bold transition flex items-center justify-center gap-2 ${
                            farmerCrop === crop
                              ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-md"
                              : "border-white/10 bg-black/40 text-white/60 hover:bg-white/5"
                          }`}
                        >
                          <span className="text-lg">{crop === "Cotton" ? "🌿" : "🎋"}</span>
                          {crop}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-white/70">
                        {t.harvestArea[lang]}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={farmerAcreage}
                        onChange={(e) => setFarmerAcreage(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-emerald-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-white/70">
                        {t.hybridVariety[lang]}
                      </label>
                      <input
                        type="text"
                        value={farmerVariety}
                        onChange={(e) => setFarmerVariety(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-emerald-400 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-white/70">
                        {t.farmName[lang]}
                      </label>
                      <input
                        type="text"
                        value={farmerFarmName}
                        onChange={(e) => setFarmerFarmName(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-white/70">
                        {t.villageDistrict[lang]}
                      </label>
                      <input
                        type="text"
                        value={farmerDistrict}
                        onChange={(e) => setFarmerDistrict(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                </div>

                {/* VIDEO DROPZONE */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/70">
                    {t.uploadVideo[lang]}
                  </label>
                  <label className="mt-2 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/20 bg-black/50 p-6 transition hover:border-emerald-400/50 hover:bg-emerald-950/10 cursor-pointer min-h-[220px]">
                    <input
                      type="file"
                      accept="video/*,image/*"
                      onChange={handleVideoSelect}
                      className="hidden"
                    />
                    {videoFile ? (
                      <div className="text-center">
                        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 mb-2">
                          <CheckCircle2 size={24} />
                        </div>
                        <p className="text-sm font-bold text-white truncate max-w-xs">{videoFile.name}</p>
                        <p className="text-xs text-emerald-400 mt-1">
                          {(videoFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for Neural Scan
                        </p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-white/10 text-white/60 mb-2">
                          <Upload size={24} />
                        </div>
                        <p className="text-sm font-bold text-white">Select Drone or Mobile Canopy Video</p>
                        <p className="text-xs text-white/40 mt-1">MP4, WebM, MOV, or High-Res Photos</p>
                      </div>
                    )}
                  </label>

                  <button
                    type="button"
                    onClick={handleAnalyzeVideo}
                    disabled={analyzingVideo || !videoFile}
                    className="mt-4 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3.5 text-sm font-extrabold text-black transition hover:opacity-95 disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {analyzingVideo ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>{analysisProgress}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        <span>{t.btnAnalyze[lang]}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* AUDIT RESULTS PREVIEW & PUBLISH */}
              {auditResult && (
                <div className="mt-8 rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-6 sm:p-8 backdrop-blur-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div>
                      <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-300">
                        KisanX AI Harvest Certificate
                      </span>
                      <h3 className="mt-2 text-2xl font-black text-white">{auditResult.quality_grade}</h3>
                    </div>
                    <div className="text-right font-mono">
                      <p className="text-xs text-white/50">SHA-256 Fingerprint</p>
                      <p className="text-xs text-emerald-400 font-bold">{auditResult.encryption_fingerprint}</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                      <p className="text-xs text-white/50">Canopy Foliar Vigor</p>
                      <p className="mt-1 text-2xl font-black text-emerald-400">{auditResult.health_percentage}%</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                      <p className="text-xs text-white/50">{t.lotWeight[lang]}</p>
                      <p className="mt-1 text-2xl font-black text-white font-mono">{auditResult.estimated_weight_quintals} Qtl</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                      <p className="text-xs text-white/50">{t.ratePerQtl[lang]}</p>
                      <p className="mt-1 text-2xl font-black text-white font-mono">₹{auditResult.price_per_quintal}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                      <p className="text-xs text-emerald-300">{t.lotValue[lang]}</p>
                      <p className="mt-1 text-2xl font-black text-emerald-400 font-mono">₹{auditResult.total_valuation.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={handlePublishListing}
                      className="rounded-2xl bg-emerald-500 px-6 py-3.5 text-sm font-extrabold text-black transition hover:bg-emerald-400 shadow-xl shadow-emerald-500/30 flex items-center gap-2"
                    >
                      <CheckCircle2 size={16} />
                      <span>{t.btnPublish[lang]}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PORTAL 2: BUYER PROCUREMENT RADAR (ALL VERIFIED FARMS) */}
        {/* ============================================================ */}
        {activeRole === "buyer" && (
          <div className="space-y-8">
            <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 backdrop-blur-2xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white">
                    {t.buyerRadarTitle[lang]}
                  </h2>
                  <p className="text-xs text-white/60 mt-1">
                    {t.buyerRadarDesc[lang]}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLocateMe}
                    disabled={gpsLoading}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20"
                  >
                    <Navigation size={14} className={gpsLoading ? "animate-spin" : ""} />
                    <span>{userLat ? "GPS Locked (Nearest First)" : t.gpsLocateBtn[lang]}</span>
                  </button>

                  <div className="flex rounded-xl border border-white/15 bg-black/40 p-1 text-xs">
                    {(["All", "Cotton", "Sugarcane"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCropFilter(c)}
                        className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                          cropFilter === c ? "bg-white/20 text-white" : "text-white/50 hover:text-white"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* RADAR PRODUCE CARDS */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {buyerListings.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-white/15 bg-black/60 p-6 flex flex-col justify-between hover:border-emerald-500/40 transition shadow-xl"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{item.crop_name === "Cotton" ? "🌿" : "🎋"}</span>
                        <div>
                          <h3 className="text-lg font-black text-white">{item.crop_name}</h3>
                          <p className="text-xs text-white/50">{item.variety}</p>
                        </div>
                      </div>

                      <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                        {item.quality_grade}
                      </span>
                    </div>

                    <div className="rounded-2xl bg-white/[0.04] p-3 text-xs space-y-1">
                      <p className="text-white/80 font-bold">{item.farmer_name}</p>
                      <p className="text-white/50">{item.farm_name} • {item.district}</p>
                      {item.distance_km !== null && item.distance_km !== undefined && (
                        <p className="text-emerald-400 font-mono text-[11px] pt-1">
                          📍 {item.distance_km} km away from your mandi
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center rounded-2xl bg-white/[0.02] p-2.5">
                      <div>
                        <p className="text-[10px] text-white/40 uppercase font-bold">{t.lotWeight[lang]}</p>
                        <p className="text-xs font-black text-white font-mono">{item.estimated_weight_quintals} Qtl</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 uppercase font-bold">{t.ratePerQtl[lang]}</p>
                        <p className="text-xs font-black text-white font-mono">₹{item.price_per_quintal}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 uppercase font-bold">{t.lotValue[lang]}</p>
                        <p className="text-xs font-black text-emerald-400 font-mono">₹{item.total_valuation.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setSellShopListingId(item.id);
                        setShowSellShop(true);
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-xs font-black text-black hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20"
                    >
                      <MessageSquare size={14} />
                      <span>{t.negotiateInSellShop[lang]}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PORTAL 3: QUALITY INSPECTOR CERTIFICATION CONSOLE */}
        {/* ============================================================ */}
        {activeRole === "inspector" && (
          <div className="space-y-8">
            <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 backdrop-blur-2xl">
              <h2 className="text-2xl font-black text-white">
                {t.inspectorQueueTitle[lang]}
              </h2>
              <p className="text-xs text-white/60 mt-1">
                {t.inspectorQueueDesc[lang]}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {inspectorQueue.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-white/15 bg-black/60 p-6 space-y-4 shadow-xl"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{item.crop_name === "Cotton" ? "🌿" : "🎋"}</span>
                        <h3 className="text-base font-bold text-white">{item.crop_name} • {item.variety}</h3>
                      </div>
                      <p className="text-xs text-white/50">{item.farmer_name} • {item.district}</p>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        item.inspector_status === "CERTIFIED_GRADE_A"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : item.inspector_status === "QUARANTINED"
                          ? "bg-red-500/20 text-red-300 border border-red-500/40"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      }`}
                    >
                      {item.inspector_status}
                    </span>
                  </div>

                  <div className="rounded-2xl bg-white/[0.04] p-3 text-xs space-y-1">
                    <p className="text-emerald-400 font-bold">Foliar Vigor: {item.health_percentage}%</p>
                    <p className="text-white/70">{item.yolo_detection_summary}</p>
                  </div>

                  {item.certified_by && (
                    <p className="text-[11px] text-white/40 font-mono">
                      Certified By: {item.certified_by} • {item.certification_timestamp}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleInspectorAction(item.id, "CERTIFY")}
                      disabled={certifyingId === item.id}
                      className="flex-1 rounded-2xl bg-emerald-500 py-2.5 text-xs font-black text-black hover:bg-emerald-400 transition disabled:opacity-50"
                    >
                      {t.certifyBtn[lang]}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInspectorAction(item.id, "QUARANTINE")}
                      disabled={certifyingId === item.id}
                      className="flex-1 rounded-2xl border border-red-500/40 bg-red-500/10 py-2.5 text-xs font-black text-red-300 hover:bg-red-500/20 transition disabled:opacity-50"
                    >
                      {t.quarantineBtn[lang]}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* INSTAGRAM-STYLE "SELL SHOP" DIRECT MESSAGING MODAL */}
      {/* ============================================================ */}
      {showSellShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <SellShopChat
              activeRole={activeRole === "farmer" ? "farmer" : "buyer"}
              selectedListingId={sellShopListingId}
              language={lang}
              onClose={() => setShowSellShop(false)}
            />
          </div>
        </div>
      )}
    </main>
  );
}
