import Link from "next/link";
import { redirect } from "next/navigation";
import { 
  Activity, 
  ArrowUpRight, 
  CheckCircle2, 
  Cpu, 
  Layers, 
  LogOut, 
  MapPin, 
  Plus, 
  Scan, 
  ShieldCheck, 
  Sparkles, 
  TrendingUp,
  CloudRain,
  Wind,
  Droplets,
  Thermometer,
  ShieldAlert,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Farm = {
  id: string;
  name: string;
  village: string | null;
  district: string | null;
  area_acres: number;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const { data: farms, error: farmsError } = await supabase
    .from("farms")
    .select(
      "id, name, village, district, area_acres, latitude, longitude, created_at"
    )
    .eq("owner_id", user.id)
    .order("created_at", {
      ascending: false,
    });

  // Fetch recent AI diagnoses
  const { data: recentDiagnoses } = await supabase
    .from("diagnoses")
    .select("id, disease, severity_stage, confidence, photo_url, created_at, crop_cycle_id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3);

  const farmList: Farm[] = farms ?? [];
  const totalFarms = farmList.length;
  const totalArea = farmList.reduce(
    (total, farm) => total + Number(farm.area_acres || 0),
    0
  );

  const metadata = user.user_metadata ?? {};
  const userRole = (profile?.role || metadata?.role || "FARMER").toUpperCase();
  const displayName =
    profile?.full_name ||
    metadata.full_name ||
    metadata.name ||
    user.email?.split("@")[0] ||
    "Farmer";

  // Live Microclimate & Spray Feasibility calculation
  const primaryFarm = farmList[0];
  const farmLat = primaryFarm?.latitude ?? 19.5682;
  const farmLon = primaryFarm?.longitude ?? 74.2111;
  const locationName = primaryFarm?.name ? `${primaryFarm.name} (${primaryFarm.district || "Ahmednagar"})` : "Rahata, Ahmednagar";

  let weatherData: any = null;
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${farmLat}&longitude=${farmLon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=auto`,
      { next: { revalidate: 180 } }
    );
    if (res.ok) {
      weatherData = await res.json();
    }
  } catch {
    // Non-critical fallback
  }

  const currentW = weatherData?.current || {};
  const tempC = currentW.temperature_2m ?? 26.5;
  const humidityPct = currentW.relative_humidity_2m ?? 68;
  const windKmh = currentW.wind_speed_10m ?? 8.5;
  const rainMm = currentW.precipitation ?? 0.0;

  let sprayStatus = "OPTIMAL";
  let sprayBadgeBg = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  let sprayTitle = "Optimal for Foliar Application";
  let sprayDesc = "Temperature, humidity, and low wind drift risk are ideal for biopesticide and foliar fertilizer application.";

  if (rainMm > 0.1) {
    sprayStatus = "DO NOT SPRAY";
    sprayBadgeBg = "bg-rose-500/20 text-rose-300 border-rose-500/40";
    sprayTitle = "Rain Wash-Off Risk";
    sprayDesc = "Active rainfall detected in microclimate. Sprayed inputs will wash off foliage before systemic uptake.";
  } else if (windKmh > 16) {
    sprayStatus = "UNFAVORABLE";
    sprayBadgeBg = "bg-rose-500/20 text-rose-300 border-rose-500/40";
    sprayTitle = "High Wind Drift Alert";
    sprayDesc = `Wind speed (${windKmh} km/h) exceeds safe 15 km/h threshold; droplet drift will contaminate off-target areas.`;
  } else if (windKmh > 11) {
    sprayStatus = "CAUTION";
    sprayBadgeBg = "bg-amber-500/20 text-amber-300 border-amber-500/40";
    sprayTitle = "Moderate Wind Advisory";
    sprayDesc = `Wind speed ${windKmh} km/h. Maintain low boom height and use air-induction low-drift spray nozzles.`;
  }

  return (
    <main className="min-h-screen bg-[#030604] text-white selection:bg-emerald-500/30 selection:text-white">
      {/* Dynamic Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/3 w-[650px] h-[650px] rounded-full blur-[160px] opacity-15 bg-emerald-600" />
        <div className="absolute top-1/2 -right-32 w-[500px] h-[500px] rounded-full blur-[180px] opacity-10 bg-teal-700" />
      </div>

      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#030604]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-black font-extrabold text-lg shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition">
              K
            </span>
            <span className="text-xl font-bold tracking-tight text-white">
              Kisan<span className="text-emerald-400">X</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              AI Engines Online
            </div>

            <Link
              href="/market?tab=buyer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-xs font-bold text-teal-300 transition hover:bg-teal-500/20"
            >
              <span>🏭</span>
              <span>Buyer Radar</span>
            </Link>

            <form action="/auth/logout" method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <LogOut size={13} />
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">

        {/* ROLE PERSONA PROMINENT BANNER (Buyer / Officer) */}
        {userRole === "BUYER" && (
          <div className="mb-8 rounded-3xl border border-teal-500/40 bg-gradient-to-r from-teal-950/40 to-teal-900/20 p-6 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 shadow-[0_0_35px_rgba(20,184,166,0.15)]">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-300 text-3xl border border-teal-500/30">
                🏭
              </span>
              <div>
                <span className="rounded-full bg-teal-500/20 px-2.5 py-0.5 text-[10px] font-bold text-teal-300 font-mono">
                  MANDI BUYER ACCOUNT ACTIVE
                </span>
                <h3 className="font-extrabold text-white text-lg mt-1">Procurement & Trade Negotiation Radar</h3>
                <p className="text-xs text-white/60 mt-0.5 max-w-xl">
                  You are authenticated with buyer privileges. Discover verified farm lots with YOLO leaf health index, inspect Grade-A certificates, and negotiate prices directly in Sell Shop.
                </p>
              </div>
            </div>
            <Link
              href="/market?tab=buyer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-500 px-6 py-3.5 text-sm font-extrabold text-black shadow-lg shadow-teal-500/25 hover:bg-teal-400 transition whitespace-nowrap"
            >
              Open Buyer Radar <ArrowUpRight size={16} />
            </Link>
          </div>
        )}

        {userRole === "OFFICER" && (
          <div className="mb-8 rounded-3xl border border-purple-500/40 bg-gradient-to-r from-purple-950/40 to-purple-900/20 p-6 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 shadow-[0_0_35px_rgba(168,85,247,0.15)]">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-300 text-3xl border border-purple-500/30">
                🛡️
              </span>
              <div>
                <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 font-mono">
                  PHYTOSANITARY INSPECTION ACTIVE
                </span>
                <h3 className="font-extrabold text-white text-lg mt-1">Quality Inspection & Certification Portal</h3>
                <p className="text-xs text-white/60 mt-0.5 max-w-xl">
                  You are authenticated as an agricultural officer. Review harvest batch submissions, evaluate AI vision health scores, and issue digital certification records.
                </p>
              </div>
            </div>
            <Link
              href="/market?tab=inspector"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-500 px-6 py-3.5 text-sm font-extrabold text-black shadow-lg shadow-purple-500/25 hover:bg-purple-400 transition whitespace-nowrap"
            >
              Open Certification Queue <ArrowUpRight size={16} />
            </Link>
          </div>
        )}

        {/* Welcome Section */}
        <section className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <Sparkles size={12} className="text-emerald-400" />
              Agronomic Command Center
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              Welcome back, {displayName}
            </h1>
            <p className="mt-2 text-sm text-white/60 max-w-2xl leading-relaxed">
              Monitor multi-crop disease risks, run real-time computer vision models, and review live microclimate telemetry.
            </p>
          </div>

          <Link
            href="/dashboard/scan"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-5 py-3.5 text-sm font-extrabold text-black shadow-[0_0_30px_rgba(16,185,129,0.3)] transition hover:shadow-[0_0_45px_rgba(16,185,129,0.5)] hover:scale-[1.02]"
          >
            <Scan size={18} />
            Start AI Crop Scan
          </Link>
        </section>

        {/* LIVE MICROCLIMATE & SPRAY FEASIBILITY TELEMETRY */}
        <section className="mb-8 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 backdrop-blur-xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  Live Farm Telemetry & Open-Meteo Radar
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-white mt-1 flex items-center gap-2">
                <span>Field Microclimate: {locationName}</span>
              </h3>
              <p className="text-xs text-white/50 mt-1">
                Real-time meteorological feed used for 5-factor epidemiological risk and foliar spray window calculations.
              </p>
            </div>

            {/* Spray Advisory Badge */}
            <div className={`rounded-2xl border px-4 py-3 ${sprayBadgeBg} flex items-center gap-3`}>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider block opacity-75">
                  Foliar Spray Feasibility
                </span>
                <span className="font-extrabold text-sm">{sprayStatus}: {sprayTitle}</span>
              </div>
            </div>
          </div>

          {/* Telemetry Metrics Grid */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-white/10">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3.5">
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <Thermometer size={14} className="text-amber-400" />
                <span>Ambient Temp</span>
              </div>
              <p className="mt-1.5 text-2xl font-extrabold text-white font-mono">{tempC}°C</p>
              <p className="text-[11px] text-white/40 mt-0.5">Crop canopy range</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-3.5">
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <Droplets size={14} className="text-cyan-400" />
                <span>Relative Humidity</span>
              </div>
              <p className="mt-1.5 text-2xl font-extrabold text-white font-mono">{humidityPct}%</p>
              <p className="text-[11px] text-white/40 mt-0.5">Fungal spore vector</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-3.5">
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <Wind size={14} className="text-teal-400" />
                <span>Wind Velocity</span>
              </div>
              <p className="mt-1.5 text-2xl font-extrabold text-white font-mono">{windKmh} <span className="text-xs text-white/50 font-normal">km/h</span></p>
              <p className="text-[11px] text-white/40 mt-0.5">Threshold: &lt;15 km/h</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-3.5">
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <CloudRain size={14} className="text-blue-400" />
                <span>Precipitation</span>
              </div>
              <p className="mt-1.5 text-2xl font-extrabold text-white font-mono">{rainMm} <span className="text-xs text-white/50 font-normal">mm</span></p>
              <p className="text-[11px] text-white/40 mt-0.5">Wash-off index</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-white/[0.03] border border-white/5 px-4 py-2.5 flex items-center gap-2.5 text-xs text-white/70">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            <span><strong>Agronomic Advisory:</strong> {sprayDesc}</span>
          </div>
        </section>

        {/* AI PIPELINE STATUS CHIPS (Live Operational Engines) */}
        <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Cotton Pipeline */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xl">🌿</span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 font-mono">
                OPERATIONAL
              </span>
            </div>
            <h3 className="mt-2 font-bold text-white text-sm">Cotton SegNet</h3>
            <p className="text-xs text-white/50 font-mono mt-0.5">YOLOv11 Instance Seg</p>
          </div>

          {/* Sugarcane Pipeline */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xl">🎋</span>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 font-mono">
                OPERATIONAL
              </span>
            </div>
            <h3 className="mt-2 font-bold text-white text-sm">Sugarcane BioNet</h3>
            <p className="text-xs text-white/50 font-mono mt-0.5">MobileNetV2 Deep Classifier</p>
          </div>

          {/* Gemma RAG */}
          <div className="rounded-2xl border border-teal-500/30 bg-teal-950/20 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xl">🧠</span>
              <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-bold text-teal-400 font-mono">
                OPERATIONAL
              </span>
            </div>
            <h3 className="mt-2 font-bold text-white text-sm">Gemma Advisory RAG</h3>
            <p className="text-xs text-white/50 font-mono mt-0.5">MiniLM + Vector Knowledge</p>
          </div>

          {/* Epidemiological Risk */}
          <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xl">⚡</span>
              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-400 font-mono">
                OPERATIONAL
              </span>
            </div>
            <h3 className="mt-2 font-bold text-white text-sm">5-Factor Risk Radar</h3>
            <p className="text-xs text-white/50 font-mono mt-0.5">Microclimate + Regional ETL</p>
          </div>
        </section>


        {/* FEATURE BENTO ACTIONS */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. AI SCANNER */}
          <Link
            href="/dashboard/scan"
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 transition-all duration-300 hover:border-emerald-500/50 hover:bg-emerald-950/20 hover:shadow-[0_0_35px_rgba(16,185,129,0.15)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-emerald-400 font-bold">
                  AI Computer Vision
                </p>
                <h3 className="mt-2 text-xl font-extrabold text-white">
                  Scan Crop Foliage
                </h3>
                <p className="mt-1.5 text-xs text-white/55 leading-relaxed">
                  Analyze Cotton (YOLOv11) or Sugarcane leaves with real-time severity grading.
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 group-hover:scale-110 transition">
                <Scan size={20} />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition">
              Open Scanner <ArrowUpRight size={14} />
            </div>
          </Link>

          {/* 2. REGISTER FARM */}
          <Link
            href="/dashboard/farm/new"
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 transition-all duration-300 hover:border-amber-500/50 hover:bg-amber-950/20 hover:shadow-[0_0_35px_rgba(245,158,11,0.15)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-amber-400 font-bold">
                  Field Registry
                </p>
                <h3 className="mt-2 text-xl font-extrabold text-white">
                  Add Farm & Plot
                </h3>
                <p className="mt-1.5 text-xs text-white/55 leading-relaxed">
                  Register new farmland, plot boundaries, and link crop cycles.
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 group-hover:scale-110 transition">
                <Plus size={20} />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-amber-400 group-hover:translate-x-1 transition">
              New Registration <ArrowUpRight size={14} />
            </div>
          </Link>

          {/* 3. FIELD RISK */}
          <Link
            href="/dashboard/risk"
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 transition-all duration-300 hover:border-teal-500/50 hover:bg-teal-950/20 hover:shadow-[0_0_35px_rgba(20,184,166,0.15)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-teal-400 font-bold">
                  Intelligence
                </p>
                <h3 className="mt-2 text-xl font-extrabold text-white">
                  Field Risk Advisory
                </h3>
                <p className="mt-1.5 text-xs text-white/55 leading-relaxed">
                  5-factor epidemiological pathogen progression & vulnerability.
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 group-hover:scale-110 transition">
                <Activity size={20} />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-teal-400 group-hover:translate-x-1 transition">
              View Radar <ArrowUpRight size={14} />
            </div>
          </Link>

          {/* 4. BUYER & MANDI RADAR */}
          <Link
            href="/market?tab=buyer"
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 transition-all duration-300 hover:border-teal-500/50 hover:bg-teal-950/20 hover:shadow-[0_0_35px_rgba(20,184,166,0.15)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-teal-400 font-bold">
                  Commerce & Mandi
                </p>
                <h3 className="mt-2 text-xl font-extrabold text-white">
                  Buyer Procurement Radar
                </h3>
                <p className="mt-1.5 text-xs text-white/55 leading-relaxed">
                  Discover verified lots on GPS radar, view YOLO health index, and send direct price bids.
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 group-hover:scale-110 transition">
                <TrendingUp size={20} />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-teal-400 group-hover:translate-x-1 transition">
              Open Buyer Radar <ArrowUpRight size={14} />
            </div>
          </Link>
        </section>

        {/* CROPGUARD BIO-DEFENSE MODULES */}
        <section className="mb-10">
          <div className="mb-4">
            <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">CropGuard Integrated Modules</span>
            <h2 className="text-xl font-extrabold text-white mt-0.5">Bio-Surveillance & Expert Suite</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Traps */}
            <Link
              href="/dashboard/traps"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-amber-500/40 hover:bg-white/[0.06] transition group"
            >
              <span className="text-2xl">🪤</span>
              <h4 className="mt-3 font-bold text-sm text-white group-hover:text-amber-300 transition">Pest Traps & ETL</h4>
              <p className="mt-1 text-[11px] text-white/50 leading-relaxed">Pheromone monitoring & threshold alerts</p>
            </Link>

            {/* Risk Radar */}
            <Link
              href="/dashboard/risk"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-teal-500/40 hover:bg-white/[0.06] transition group"
            >
              <span className="text-2xl">⚡</span>
              <h4 className="mt-3 font-bold text-sm text-white group-hover:text-teal-300 transition">Risk Radar</h4>
              <p className="mt-1 text-[11px] text-white/50 leading-relaxed">5-factor microclimate vulnerability score</p>
            </Link>

            {/* Hotspots */}
            <Link
              href="/dashboard/hotspots"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-rose-500/40 hover:bg-white/[0.06] transition group"
            >
              <span className="text-2xl">🔥</span>
              <h4 className="mt-3 font-bold text-sm text-white group-hover:text-rose-300 transition">Outbreak Heatmap</h4>
              <p className="mt-1 text-[11px] text-white/50 leading-relaxed">Regional disease migration corridors</p>
            </Link>

            {/* Inputs Store */}
            <Link
              href="/dashboard/inputs"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-emerald-500/40 hover:bg-white/[0.06] transition group"
            >
              <span className="text-2xl">🌱</span>
              <h4 className="mt-3 font-bold text-sm text-white group-hover:text-emerald-300 transition">Verified Inputs</h4>
              <p className="mt-1 text-[11px] text-white/50 leading-relaxed">Certified seeds, fertilizers & bio-agents</p>
            </Link>

            {/* Agronomist */}
            <Link
              href="/dashboard/agronomists"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-purple-500/40 hover:bg-white/[0.06] transition group"
            >
              <span className="text-2xl">👨‍🌾</span>
              <h4 className="mt-3 font-bold text-sm text-white group-hover:text-purple-300 transition">Ask Agronomist</h4>
              <p className="mt-1 text-[11px] text-white/50 leading-relaxed">Book 1-on-1 ICAR & KVK expert calls</p>
            </Link>
          </div>
        </section>

        {/* ANALYTICS STATS ROW */}
        <section className="mb-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-wider text-white/50">Registered Farmlands</p>
            <p className="mt-2 text-3xl font-extrabold text-white font-mono">{totalFarms}</p>
            <p className="mt-1 text-xs text-white/40">Operational holdings</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-wider text-white/50">Total Landholding</p>
            <p className="mt-2 text-3xl font-extrabold text-white font-mono">
              {totalArea.toFixed(1)}{" "}
              <span className="text-sm font-normal text-white/50">Acres</span>
            </p>
            <p className="mt-1 text-xs text-white/40">Active agricultural coverage</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-wider text-white/50">Active AI Domains</p>
            <p className="mt-2 text-xl font-extrabold text-emerald-300">
              Cotton & Sugarcane
            </p>
            <p className="mt-1 text-xs text-white/40">Multi-crop neural segregation</p>
          </div>
        </section>

        {/* RECENT AI DIAGNOSES & CROP HEALTH HISTORY */}
        {recentDiagnoses && recentDiagnoses.length > 0 && (
          <section className="mb-10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-emerald-400 font-bold">
                  Bio-Surveillance Telemetry
                </p>
                <h2 className="mt-1 text-2xl font-extrabold text-white">
                  Recent AI Diagnoses & Leaf Scans
                </h2>
              </div>

              <Link
                href="/dashboard/scan"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-4 py-2 text-xs font-bold transition border border-emerald-500/20"
              >
                <Scan size={14} /> New Crop Scan
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentDiagnoses.map((diag: any) => (
                <div
                  key={diag.id}
                  className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 backdrop-blur-xl transition hover:border-emerald-500/30"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 font-mono">
                        Severity Stage {diag.severity_stage || 1}
                      </span>
                      <h4 className="mt-2 text-base font-bold text-white">
                        {diag.disease || "Foliar Analysis"}
                      </h4>
                    </div>

                    <span className="rounded-xl border border-white/10 bg-black/40 px-2.5 py-1 text-xs font-bold text-emerald-400 font-mono">
                      {Math.round((diag.confidence || 0.9) * 100)}% Match
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between pt-4 border-t border-white/10 text-xs">
                    <span className="text-white/40 flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(diag.created_at).toLocaleDateString()}
                    </span>

                    <Link
                      href="/dashboard/agronomists"
                      className="inline-flex items-center gap-1 font-bold text-purple-400 hover:text-purple-300 transition text-[11px]"
                    >
                      Consult Agronomist <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* REGISTERED FARMS SECTION */}
        <section>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-400 font-bold">
                Agricultural Holdings
              </p>
              <h2 className="mt-1 text-2xl font-extrabold text-white">
                My Registered Farms
              </h2>
            </div>

            <Link
              href="/dashboard/farm/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2 text-xs font-bold text-white transition border border-white/15"
            >
              <Plus size={14} /> Add New Farm
            </Link>
          </div>

          {farmsError && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
              Could not load your farms: {farmsError.message}
            </div>
          )}

          {!farmsError && farmList.length === 0 && (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-3xl border border-white/10">
                🚜
              </div>
              <h3 className="mt-4 text-xl font-bold text-white">No Farms Registered Yet</h3>
              <p className="mt-2 text-xs text-white/50 max-w-sm mx-auto leading-relaxed">
                Register your first farm to link your plot with KisanX Cotton and Sugarcane AI models.
              </p>
              <Link
                href="/dashboard/farm/new"
                className="mt-6 inline-flex rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
              >
                Register First Farm
              </Link>
            </div>
          )}

          {!farmsError && farmList.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {farmList.map((farm) => (
                <div
                  key={farm.id}
                  className="group relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 font-mono">
                        Active Plot
                      </span>
                      <h3 className="mt-3 text-lg font-bold text-white group-hover:text-emerald-300 transition">
                        {farm.name}
                      </h3>
                      <p className="text-xs text-white/50 mt-0.5">
                        {farm.village ? `${farm.village}, ` : ""}
                        {farm.district || "Registered Farm"}
                      </p>
                    </div>

                    <span className="rounded-2xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-bold text-white font-mono">
                      {farm.area_acres} ac
                    </span>
                  </div>

                  {farm.latitude !== null && (
                    <div className="mt-4 flex items-center gap-1.5 text-[11px] font-mono text-white/40">
                      <MapPin size={12} className="text-emerald-400" />
                      {farm.latitude?.toFixed(4)}, {farm.longitude?.toFixed(4)}
                    </div>
                  )}

                  <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[11px] text-white/40">
                      Added {new Date(farm.created_at).toLocaleDateString()}
                    </span>

                    <Link
                      href="/dashboard/scan"
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition"
                    >
                      Scan Crops <ArrowUpRight size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
