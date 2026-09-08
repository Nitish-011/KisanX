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
  TrendingUp 
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

  const farmList: Farm[] = farms ?? [];
  const totalFarms = farmList.length;
  const totalArea = farmList.reduce(
    (total, farm) => total + Number(farm.area_acres || 0),
    0
  );

  const metadata = user.user_metadata ?? {};
  const displayName =
    profile?.full_name ||
    metadata.full_name ||
    metadata.name ||
    user.email?.split("@")[0] ||
    "Farmer";

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

            <span className="hidden text-xs text-white/50 md:block font-mono">
              {user.email}
            </span>

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
              Monitor multi-crop disease risks, run dedicated computer vision models, and access real-time agronomic advisories.
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

        {/* AI PIPELINE STATUS CHIPS */}
        <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Cotton Pipeline */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xl">🌿</span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                ACTIVE
              </span>
            </div>
            <h3 className="mt-2 font-bold text-white text-sm">Cotton Engine</h3>
            <p className="text-xs text-white/50 font-mono mt-0.5">YOLOv11 Instance Seg</p>
          </div>

          {/* Sugarcane Pipeline */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xl">🎋</span>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                ACTIVE
              </span>
            </div>
            <h3 className="mt-2 font-bold text-white text-sm">Sugarcane Engine</h3>
            <p className="text-xs text-white/50 font-mono mt-0.5">MobileNetV2 Deep</p>
          </div>

          {/* Barley (Locked) */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 opacity-60 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xl">🌾</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/40">
                TRAINING
              </span>
            </div>
            <h3 className="mt-2 font-bold text-white/70 text-sm">Barley Engine</h3>
            <p className="text-xs text-white/40 font-mono mt-0.5">Dataset 88% Curation</p>
          </div>

          {/* Maize (Locked) */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 opacity-60 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xl">🌽</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/40">
                TRAINING
              </span>
            </div>
            <h3 className="mt-2 font-bold text-white/70 text-sm">Maize Engine</h3>
            <p className="text-xs text-white/40 font-mono mt-0.5">Fall Armyworm Queue</p>
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
            href="/dashboard/scan"
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
                  Predict pathogen progression and environmental spread risks.
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 group-hover:scale-110 transition">
                <Activity size={20} />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-teal-400 group-hover:translate-x-1 transition">
              Review Threats <ArrowUpRight size={14} />
            </div>
          </Link>

          {/* 4. MARKET & MANDI */}
          <Link
            href="/marketplace"
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 transition-all duration-300 hover:border-blue-500/50 hover:bg-blue-950/20 hover:shadow-[0_0_35px_rgba(59,130,246,0.15)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-blue-400 font-bold">
                  Commerce
                </p>
                <h3 className="mt-2 text-xl font-extrabold text-white">
                  Mandi Marketplace
                </h3>
                <p className="mt-1.5 text-xs text-white/55 leading-relaxed">
                  Explore verified crop buyers, real-time APMC mandi rates, and contracts.
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 group-hover:scale-110 transition">
                <TrendingUp size={20} />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-blue-400 group-hover:translate-x-1 transition">
              Explore Mandi <ArrowUpRight size={14} />
            </div>
          </Link>
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
