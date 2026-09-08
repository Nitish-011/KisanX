"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Cpu, 
  Globe2, 
  Leaf, 
  Lock, 
  MapPin, 
  Sparkles, 
  Trees 
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Language = "en" | "hi" | "mr";
type CropType = "Cotton" | "Sugarcane";

type FormData = {
  farmName: string;
  village: string;
  district: string;
  farmArea: string;
  latitude: string;
  longitude: string;
  plotName: string;
  plotArea: string;
  selectedCrop: CropType;
  variety: string;
  cropStage: string;
  plantingDate: string;
  soilType: string;
};

const initialForm: FormData = {
  farmName: "",
  village: "",
  district: "",
  farmArea: "",
  latitude: "",
  longitude: "",
  plotName: "",
  plotArea: "",
  selectedCrop: "Cotton",
  variety: "",
  cropStage: "",
  plantingDate: "",
  soilType: "",
};

const translations = {
  en: {
    language: "English",
    title: "Register Your Farm & Field",
    subtitle:
      "Configure your farm details and assign dedicated AI crop models for precise health intelligence.",
    farmSection: "1. Farm Identification",
    farmDesc: "General geography and overall operational land holding.",
    farmName: "Farm / Estate Name",
    farmNamePlaceholder: "e.g. Green Valley Farm",
    village: "Village / Town",
    villagePlaceholder: "e.g. Baramati",
    district: "District",
    districtPlaceholder: "e.g. Pune",
    farmArea: "Total Farm Area (Acres)",
    farmAreaPlaceholder: "e.g. 10.5",
    
    geoSection: "2. Geolocation Telemetry",
    geoDesc: "Tag GPS coordinates for hyper-localized satellite and weather intelligence.",
    useGps: "Acquire GPS Coordinates",
    gpsAcquiring: "Locking Satellites...",
    latitude: "Latitude",
    longitude: "Longitude",

    plotSection: "3. Field Plot & Crop Assignment",
    plotDesc: "Assign the target crop pipeline to this plot. Supported models run isolated neural weights.",
    plotName: "Plot Name / Sector",
    plotNamePlaceholder: "e.g. North Plot Sector A",
    plotArea: "Plot Area (Acres)",
    plotAreaPlaceholder: "e.g. 4.0",
    selectCrop: "Select Target Crop Pipeline",

    cropDetailsSection: "4. Agronomic Parameters",
    variety: "Crop Variety / Hybrid",
    varietyPlaceholder: "Select or specify variety",
    cropStage: "Current Growth Stage",
    plantingDate: "Planting / Sowing Date",
    soilType: "Primary Soil Composition",

    submitBtn: "Register Farm & Plot",
    submittingBtn: "Registering in KisanX Registry...",
    successMsg: "Farm registered successfully! Crop model pipeline linked.",
    requiredMsg: "Please fill in all required fields (Farm name, area, plot name, plot area).",
    sessionError: "Authentication expired. Please log in again.",
    backToDash: "Back to Dashboard",
  },
  hi: {
    language: "हिंदी",
    title: "अपना खेत और फसल दर्ज करें",
    subtitle: "अपने खेत और फसल की जानकारी दर्ज करें ताकि KisanX AI आपको सही सलाह दे सके।",
    farmSection: "1. खेत की जानकारी",
    farmDesc: "आपके खेत की सामान्य जानकारी और स्थान।",
    farmName: "खेत का नाम",
    farmNamePlaceholder: "उदाहरण: पाटिल फार्म",
    village: "गाँव",
    villagePlaceholder: "गाँव का नाम",
    district: "जिला",
    districtPlaceholder: "जिले का नाम",
    farmArea: "कुल खेत का रकबा (एकड़)",
    farmAreaPlaceholder: "उदाहरण: 5",

    geoSection: "2. GPS लोकेशन",
    geoDesc: "मौसम और सटीक सलाह के लिए फोन का GPS इस्तेमाल करें।",
    useGps: "मेरी लोकेशन लें",
    gpsAcquiring: "लोकेशन मिल रही है...",
    latitude: "अक्षांश (Latitude)",
    longitude: "देशांतर (Longitude)",

    plotSection: "3. खेत का हिस्सा और फसल",
    plotDesc: "इस हिस्से की फसल चुनें। प्रशिक्षित मॉडल अलग से काम करते हैं।",
    plotName: "हिस्से का नाम",
    plotNamePlaceholder: "उदाहरण: मुख्य प्लाॅट",
    plotArea: "हिस्से का रकबा (एकड़)",
    plotAreaPlaceholder: "उदाहरण: 2.5",
    selectCrop: "लगाई गई फसल चुनें",

    cropDetailsSection: "4. फसल और मिट्टी की जानकारी",
    variety: "फसल की किस्म / वैरायटी",
    varietyPlaceholder: "किस्म चुनें",
    cropStage: "वर्तमान फसल की अवस्था",
    plantingDate: "बुवाई की तारीख",
    soilType: "खेत की मिट्टी का प्रकार",

    submitBtn: "खेत और प्लाॅट दर्ज करें",
    submittingBtn: "दर्ज हो रहा है...",
    successMsg: "खेत सफलतापूर्वक दर्ज हो गया!",
    requiredMsg: "कृपया सभी जरूरी जानकारी भरें।",
    sessionError: "सत्र समाप्त हो गया है। कृपया दोबारा लॉगिन करें।",
    backToDash: "डैशबोर्ड पर वापस जाएँ",
  },
  mr: {
    language: "मराठी",
    title: "तुमचे शेत आणि पीक नोंदवा",
    subtitle: "तुमच्या शेताची माहिती द्या जेणेकरून KisanX AI योग्य व अचूक सल्ला देऊ शकेल.",
    farmSection: "१. शेताची माहिती",
    farmDesc: "शेताचे नाव आणि पत्ता.",
    farmName: "शेताचे नाव",
    farmNamePlaceholder: "उदाहरण: पाटील फार्म",
    village: "गाव",
    villagePlaceholder: "गावाचे नाव",
    district: "जिल्हा",
    districtPlaceholder: "जिल्ह्याचे नाव",
    farmArea: "एकूण क्षेत्रफळ (एकर)",
    farmAreaPlaceholder: "उदाहरण: ५",

    geoSection: "२. GPS स्थान",
    geoDesc: "हवामान व अचूक सल्ल्यासाठी GPS वापरा.",
    useGps: "माझे स्थान घ्या",
    gpsAcquiring: "स्थान शोधत आहे...",
    latitude: "अक्षांश (Latitude)",
    longitude: "रेखांश (Longitude)",

    plotSection: "३. शेताचा तुकडा आणि पीक",
    plotDesc: "या तुकड्यातील पीक निवडा. प्रशिक्षित AI मॉडेल थेट जोडले जाईल.",
    plotName: "तुकड्याचे नाव",
    plotNamePlaceholder: "उदाहरण: विहिरीचा तुकडा",
    plotArea: "तुकड्याचे क्षेत्रफळ (एकर)",
    plotAreaPlaceholder: "उदाहरण: २",
    selectCrop: "पिकाचा प्रकार निवडा",

    cropDetailsSection: "४. पीक आणि माती तपशील",
    variety: "पिकाची जात / वाण",
    varietyPlaceholder: "जात निवडा",
    cropStage: "सध्याची पिकाची अवस्था",
    plantingDate: "लागवडीची तारीख",
    soilType: "मातीचा प्रकार",

    submitBtn: "शेत व तुकडा नोंदवा",
    submittingBtn: "नोंदणी होत आहे...",
    successMsg: "शेत यशस्वीरित्या नोंदवले गेले!",
    requiredMsg: "कृपया सर्व आवश्यक माहिती भरा.",
    sessionError: "लॉगिन संपले आहे. कृपया पुन्हा लॉगिन करा.",
    backToDash: "डॅशबोर्डवर परत जा",
  },
};

const VARIETIES = {
  Cotton: [
    "Bt Cotton (Bollgard II)",
    "RCH-2 / RCH-659",
    "Ankur 651 / 3028",
    "Bunny Bt",
    "DCH-32",
    "Suvin Hybrid",
    "Other / Desi Cotton",
  ],
  Sugarcane: [
    "Co 86032 (Nira)",
    "CoM 0265 (Phule 265)",
    "Co 0238 (Karan 4)",
    "CoC 671",
    "Co 8014",
    "Other / Local Variety",
  ],
};

const STAGES = {
  Cotton: [
    "Germination / Emergence (0-15 days)",
    "Vegetative Growth (15-45 days)",
    "Square Formation / Flowering (45-75 days)",
    "Boll Development (75-120 days)",
    "Boll Maturation & Bursting (120+ days)",
  ],
  Sugarcane: [
    "Germination & Sprouting (0-30 days)",
    "Tillering Phase (30-120 days)",
    "Grand Growth / Cane Elongation (120-270 days)",
    "Ripening & Sucrose Accumulation (270-360 days)",
    "Ready for Harvest",
  ],
};

const SOILS = [
  "Deep Black Cotton Soil (Regur)",
  "Medium Black Soil",
  "Red Sandy Loam",
  "Alluvial River Bed Soil",
  "Laterite Soil",
  "Clayey Loam",
  "Other / Mixed",
];

export default function NewFarmPage() {
  const router = useRouter();
  const supabase = createClient();

  const [lang, setLang] = useState<Language>("en");
  const [form, setForm] = useState<FormData>(initialForm);
  const [locationLoading, setLocationLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const t = translations[lang];

  const updateField = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleLocation = () => {
    setError("");
    setLocationLoading(true);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateField("latitude", pos.coords.latitude.toFixed(6));
        updateField("longitude", pos.coords.longitude.toFixed(6));
        setLocationLoading(false);
      },
      () => {
        setError("Could not retrieve GPS coordinates. Please allow location access.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (
      !form.farmName.trim() ||
      !form.farmArea ||
      !form.plotName.trim() ||
      !form.plotArea
    ) {
      setError(t.requiredMsg);
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(t.sessionError);
      }

      const payload = {
        farm: {
          name: form.farmName.trim(),
          village: form.village.trim() || null,
          district: form.district.trim() || null,
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
          area_acres: Number(form.farmArea),
        },
        plot: {
          name: form.plotName.trim(),
          area_acres: Number(form.plotArea),
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
          boundary: null,
        },
        crop_cycle: {
          crop_name: form.selectedCrop, // Dynamic Crop!
          variety: form.variety || null,
          crop_stage: form.cropStage || null,
          planting_date: form.plantingDate || null,
          soil_type: form.soilType || null,
        },
      };

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${API_URL}/api/farms/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      let resData: any = {};
      try {
        resData = await res.json();
      } catch {
        throw new Error("Invalid response from KisanX API server.");
      }

      if (!res.ok) {
        throw new Error(resData?.detail || resData?.message || "Farm registration failed.");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (err) {
      console.error("REGISTRATION ERROR:", err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#030604] text-white selection:bg-emerald-500/30 selection:text-white pb-16">
      {/* Subtle background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-10 left-1/3 w-[500px] h-[500px] rounded-full blur-[140px] opacity-15 bg-emerald-600" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Top bar with back link & language toggle */}
        <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/50 transition hover:text-white"
          >
            <ArrowLeft size={14} />
            {t.backToDash}
          </Link>

          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1 text-xs">
            {(["en", "hi", "mr"] as Language[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`rounded-xl px-3 py-1.5 font-semibold transition ${
                  lang === code
                    ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {code === "en" ? "EN" : code === "hi" ? "हिंदी" : "मराठी"}
              </button>
            ))}
          </div>
        </div>

        {/* Title Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
            <Trees size={13} className="text-emerald-400" />
            Field Registry
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            {t.title}
          </h1>
          <p className="mt-2 text-sm text-white/60 max-w-2xl leading-relaxed">
            {t.subtitle}
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SECTION 1: FARM IDENTIFICATION */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
            <h2 className="text-lg font-bold text-white tracking-wide">{t.farmSection}</h2>
            <p className="text-xs text-white/50 mt-1">{t.farmDesc}</p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  {t.farmName} <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.farmName}
                  onChange={(e) => updateField("farmName", e.target.value)}
                  placeholder={t.farmNamePlaceholder}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500/70"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  {t.village}
                </label>
                <input
                  type="text"
                  value={form.village}
                  onChange={(e) => updateField("village", e.target.value)}
                  placeholder={t.villagePlaceholder}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500/70"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  {t.district}
                </label>
                <input
                  type="text"
                  value={form.district}
                  onChange={(e) => updateField("district", e.target.value)}
                  placeholder={t.districtPlaceholder}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500/70"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  {t.farmArea} <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.farmArea}
                  onChange={(e) => updateField("farmArea", e.target.value)}
                  placeholder={t.farmAreaPlaceholder}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500/70"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: GPS TELEMETRY */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">{t.geoSection}</h2>
                <p className="text-xs text-white/50 mt-1">{t.geoDesc}</p>
              </div>

              <button
                type="button"
                onClick={handleLocation}
                disabled={locationLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
              >
                <MapPin size={15} />
                {locationLoading ? t.gpsAcquiring : t.useGps}
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">{t.latitude}</label>
                <input
                  type="text"
                  readOnly
                  value={form.latitude}
                  placeholder="e.g. 18.1524"
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 text-sm font-mono text-white/80"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">{t.longitude}</label>
                <input
                  type="text"
                  readOnly
                  value={form.longitude}
                  placeholder="e.g. 74.5768"
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 text-sm font-mono text-white/80"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: PLOT & CROP SELECTION */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
            <h2 className="text-lg font-bold text-white tracking-wide">{t.plotSection}</h2>
            <p className="text-xs text-white/50 mt-1">{t.plotDesc}</p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  {t.plotName} <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.plotName}
                  onChange={(e) => updateField("plotName", e.target.value)}
                  placeholder={t.plotNamePlaceholder}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500/70"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  {t.plotArea} <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.plotArea}
                  onChange={(e) => updateField("plotArea", e.target.value)}
                  placeholder={t.plotAreaPlaceholder}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500/70"
                />
              </div>
            </div>

            {/* CROP CHOOSER CARDS (SEGREGATED) */}
            <div className="mt-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
                {t.selectCrop}
              </label>

              <div className="grid gap-3 sm:grid-cols-4">
                {/* 1. Cotton */}
                <div
                  onClick={() => updateField("selectedCrop", "Cotton")}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    form.selectedCrop === "Cotton"
                      ? "border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500"
                      : "border-white/10 bg-black/30 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🌿</span>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      Trained
                    </span>
                  </div>
                  <h3 className="mt-3 font-bold text-white text-sm">Cotton</h3>
                  <p className="text-[11px] font-mono text-white/50 mt-0.5">YOLOv11 AI</p>
                </div>

                {/* 2. Sugarcane */}
                <div
                  onClick={() => updateField("selectedCrop", "Sugarcane")}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    form.selectedCrop === "Sugarcane"
                      ? "border-amber-500 bg-amber-950/30 ring-1 ring-amber-500"
                      : "border-white/10 bg-black/30 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🎋</span>
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                      Trained
                    </span>
                  </div>
                  <h3 className="mt-3 font-bold text-white text-sm">Sugarcane</h3>
                  <p className="text-[11px] font-mono text-white/50 mt-0.5">MobileNetV2</p>
                </div>

                {/* 3. Barley (Locked) */}
                <div className="cursor-not-allowed rounded-2xl border border-white/5 bg-black/40 p-4 opacity-50">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🌾</span>
                    <Lock size={13} className="text-white/40" />
                  </div>
                  <h3 className="mt-3 font-bold text-white/60 text-sm">Barley</h3>
                  <p className="text-[11px] text-white/40 mt-0.5">In Training</p>
                </div>

                {/* 4. Maize (Locked) */}
                <div className="cursor-not-allowed rounded-2xl border border-white/5 bg-black/40 p-4 opacity-50">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🌽</span>
                    <Lock size={13} className="text-white/40" />
                  </div>
                  <h3 className="mt-3 font-bold text-white/60 text-sm">Maize</h3>
                  <p className="text-[11px] text-white/40 mt-0.5">In Training</p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: AGRONOMIC PARAMETERS */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
            <h2 className="text-lg font-bold text-white tracking-wide">{t.cropDetailsSection}</h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {/* Variety */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">{t.variety}</label>
                <select
                  value={form.variety}
                  onChange={(e) => updateField("variety", e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500/70"
                >
                  <option value="" className="bg-[#0b130e]">-- {t.varietyPlaceholder} --</option>
                  {VARIETIES[form.selectedCrop].map((v) => (
                    <option key={v} value={v} className="bg-[#0b130e]">{v}</option>
                  ))}
                </select>
              </div>

              {/* Crop Stage */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">{t.cropStage}</label>
                <select
                  value={form.cropStage}
                  onChange={(e) => updateField("cropStage", e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500/70"
                >
                  <option value="" className="bg-[#0b130e]">-- Select Stage --</option>
                  {STAGES[form.selectedCrop].map((s) => (
                    <option key={s} value={s} className="bg-[#0b130e]">{s}</option>
                  ))}
                </select>
              </div>

              {/* Planting Date */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">{t.plantingDate}</label>
                <input
                  type="date"
                  value={form.plantingDate}
                  onChange={(e) => updateField("plantingDate", e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500/70"
                />
              </div>

              {/* Soil Type */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">{t.soilType}</label>
                <select
                  value={form.soilType}
                  onChange={(e) => updateField("soilType", e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500/70"
                >
                  <option value="" className="bg-[#0b130e]">-- Select Soil Type --</option>
                  {SOILS.map((soil) => (
                    <option key={soil} value={soil} className="bg-[#0b130e]">{soil}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-5 py-4 font-extrabold text-black shadow-[0_0_30px_rgba(16,185,129,0.3)] transition hover:shadow-[0_0_45px_rgba(16,185,129,0.5)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
          >
            {submitting ? t.submittingBtn : t.submitBtn}
          </button>

          {/* ERROR / SUCCESS ALERTS */}
          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={16} />
              {t.successMsg}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
