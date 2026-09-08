"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Cpu,
  Eye,
  EyeOff,
  Leaf,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

type AuthMode = "signin" | "signup";
type AuthRole = "FARMER" | "BUYER" | "OFFICER";

interface AuthUIProps {
  onSignIn?: (email: string, password: string) => Promise<void> | void;
  onSignUp?: (
    email: string,
    password: string,
    fullName: string,
    role: AuthRole,
  ) => Promise<void> | void;
  onGoogleSignIn?: () => Promise<void> | void;
  onDemoSignIn?: (role: AuthRole) => Promise<void> | void;
}

const roles: {
  value: AuthRole;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "FARMER",
    title: "Farmer / Seller",
    description: "Run disease scans, calculate harvest yield via video AI, and receive buyer bids.",
    icon: "🚜",
  },
  {
    value: "BUYER",
    title: "Commodity Buyer / Mill",
    description: "Discover nearby certified lots on GPS radar and submit direct trade offers.",
    icon: "🏭",
  },
  {
    value: "OFFICER",
    title: "Food Safety & Quality Inspector",
    description: "Review YOLO defect telemetry and issue official Grade A phytosanitary passes.",
    icon: "🛡️",
  },
];

export function AuthUI({ onSignIn, onSignUp, onGoogleSignIn, onDemoSignIn }: AuthUIProps) {
  const [mode, setMode] = React.useState<AuthMode>("signin");
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<AuthRole>("FARMER");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [demoLoadingRole, setDemoLoadingRole] = React.useState<AuthRole | null>(null);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "signin") {
        await onSignIn?.(email, password);
      } else {
        await onSignUp?.(email, password, fullName, role);
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Authentication failed. Please check your credentials.",
      );
    } finally {
      setLoading(false);
    }
  };

  const googleSignIn = async () => {
    setGoogleLoading(true);
    setError("");
    setMessage("");

    try {
      await onGoogleSignIn?.();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Google sign-in failed. Please try again.",
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setMessage("");
  };

  const handleDemoClick = async (targetRole: AuthRole) => {
    setDemoLoadingRole(targetRole);
    setError("");
    setMessage("");

    try {
      if (onDemoSignIn) {
        await onDemoSignIn(targetRole);
      } else if (onSignIn) {
        let demoMail = "farmer@kisanx.com";
        if (targetRole === "BUYER") demoMail = "buyer@kisanx.com";
        if (targetRole === "OFFICER") demoMail = "officer@kisanx.com";
        await onSignIn(demoMail, "Password123!");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Instant demo login failed. Please try manual email entry.",
      );
    } finally {
      setDemoLoadingRole(null);
    }
  };

  // Demo auto-fill helper
  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError("");
    setMessage("Demo credentials filled. Click 'Enter KisanX Workspace' below.");
  };

  return (
    <main className="min-h-screen bg-[#030604] text-white selection:bg-emerald-500/30 selection:text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        {/* LEFT COLUMN: BRAND & AI HIGHLIGHTS */}
        <section className="relative hidden overflow-hidden border-r border-white/10 lg:flex flex-col justify-between p-12 xl:p-16">
          {/* Ambient Lighting */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 size-[550px] rounded-full bg-emerald-600/20 blur-[150px]" />
            <div className="absolute bottom-1/4 right-1/4 size-[450px] rounded-full bg-amber-600/15 blur-[160px]" />
          </div>

          <div className="relative z-10">
            <Link href="/" className="inline-flex items-center gap-2 group">
              <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-black font-extrabold text-xl shadow-lg shadow-emerald-500/25 transition group-hover:scale-105">
                K
              </span>
              <span className="text-2xl font-bold tracking-tight text-white">
                Kisan<span className="text-emerald-400">X</span>
              </span>
            </Link>
          </div>

          <div className="relative z-10 max-w-xl my-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-6">
              <Cpu size={14} className="text-emerald-400 animate-pulse" />
              Multi-Crop Neural Intelligence
            </div>

            <h1 className="text-5xl font-extrabold tracking-tight xl:text-7xl leading-[0.95] text-white">
              Every Field. <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-400 bg-clip-text text-transparent">
                Instantly Understood.
              </span>
            </h1>

            <p className="mt-6 text-base text-white/60 leading-relaxed max-w-lg">
              Run isolated deep learning computer vision for Cotton & Sugarcane, forecast weather-driven pathogen spread, and access certified mandi buyers.
            </p>

            {/* Neural Features Pill List */}
            <div className="mt-8 grid grid-cols-2 gap-3 max-w-md">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/70 backdrop-blur-md">
                <span className="text-base">🌿</span>
                <div>
                  <p className="font-bold text-white">Cotton YOLOv11</p>
                  <p className="text-[10px] text-white/40">Instance Segmentation</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/70 backdrop-blur-md">
                <span className="text-base">🎋</span>
                <div>
                  <p className="font-bold text-white">Sugarcane Deep</p>
                  <p className="text-[10px] text-white/40">MobileNetV2 Classifier</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/70 backdrop-blur-md">
                <Sparkles size={16} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="font-bold text-white">RAG Agronomy</p>
                  <p className="text-[10px] text-white/40">ICAR Grounded Evidence</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/70 backdrop-blur-md">
                <ShieldCheck size={16} className="text-amber-400 shrink-0" />
                <div>
                  <p className="font-bold text-white">Mandi Connect</p>
                  <p className="text-[10px] text-white/40">Direct Buyer Linkage</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between text-xs text-white/40 font-mono pt-6 border-t border-white/10">
            <span>KisanX Agriculture Cloud</span>
            <span>Version 0.5.0 • Multi-Crop</span>
          </div>
        </section>

        {/* RIGHT COLUMN: AUTHENTICATION CARD */}
        <section className="relative flex min-h-screen items-center justify-center p-4 sm:p-8">
          <div className="relative z-10 w-full max-w-md">
            {/* Mobile Header */}
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <Link href="/" className="text-xl font-bold tracking-tight text-white">
                Kisan<span className="text-emerald-400">X</span>
              </Link>
              <Link href="/" className="text-xs text-white/50 hover:text-white">
                ← Back Home
              </Link>
            </div>

            {/* Auth Glass Card */}
            <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 sm:p-8 shadow-[0_25px_80px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
              {/* Header */}
              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {mode === "signin" ? "Secure Portal Access" : "Create Grower Account"}
                </div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  {mode === "signin" ? "Welcome Back" : "Join KisanX Cloud"}
                </h2>
                <p className="mt-1 text-xs text-white/55 leading-relaxed">
                  {mode === "signin"
                    ? "Log in to manage your farmland, scans, and AI diagnostics."
                    : "Register to unlock segregated computer vision models for your crops."}
                </p>
              </div>

              {/* Mode Switch Tabs */}
              <div className="mb-5 grid grid-cols-2 rounded-2xl border border-white/10 bg-black/40 p-1">
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className={`rounded-xl py-2.5 text-xs font-bold transition ${
                    mode === "signin"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={`rounded-xl py-2.5 text-xs font-bold transition ${
                    mode === "signup"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Register
                </button>
              </div>

              {/* 1-CLICK INSTANT EVALUATION / DEMO PORTAL (Active in Sign In Mode) */}
              {mode === "signin" && (
                <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-black/50 to-emerald-900/20 p-4 shadow-inner backdrop-blur-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={13} className="text-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                        1-Click Instant Evaluation
                      </span>
                    </div>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-mono font-semibold text-emerald-300">
                      Zero Friction
                    </span>
                  </div>

                  <p className="text-[11px] text-white/65 mb-3 leading-snug">
                    Bypass OAuth & verification. Click any persona to enter their live authenticated portal:
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Farmer */}
                    <button
                      type="button"
                      onClick={() => handleDemoClick("FARMER")}
                      disabled={loading || googleLoading || !!demoLoadingRole}
                      className="group flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] p-2.5 transition hover:border-emerald-500/50 hover:bg-emerald-500/15 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                    >
                      <span className="text-xl transition group-hover:scale-110">🚜</span>
                      <span className="mt-1 text-[11px] font-bold text-white group-hover:text-emerald-300">Farmer</span>
                      <span className="text-[9px] text-emerald-400 font-mono">Rameshwar</span>
                      {demoLoadingRole === "FARMER" && (
                        <Loader2 size={12} className="mt-1.5 animate-spin text-emerald-400" />
                      )}
                    </button>

                    {/* Buyer */}
                    <button
                      type="button"
                      onClick={() => handleDemoClick("BUYER")}
                      disabled={loading || googleLoading || !!demoLoadingRole}
                      className="group flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] p-2.5 transition hover:border-teal-500/50 hover:bg-teal-500/15 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                    >
                      <span className="text-xl transition group-hover:scale-110">🏭</span>
                      <span className="mt-1 text-[11px] font-bold text-white group-hover:text-teal-300">Buyer</span>
                      <span className="text-[9px] text-teal-400 font-mono">Agro Mills</span>
                      {demoLoadingRole === "BUYER" && (
                        <Loader2 size={12} className="mt-1.5 animate-spin text-teal-400" />
                      )}
                    </button>

                    {/* Officer */}
                    <button
                      type="button"
                      onClick={() => handleDemoClick("OFFICER")}
                      disabled={loading || googleLoading || !!demoLoadingRole}
                      className="group flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] p-2.5 transition hover:border-amber-500/50 hover:bg-amber-500/15 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                    >
                      <span className="text-xl transition group-hover:scale-110">🛡️</span>
                      <span className="mt-1 text-[11px] font-bold text-white group-hover:text-amber-300">Inspector</span>
                      <span className="text-[9px] text-amber-400 font-mono">FSSAI Pass</span>
                      {demoLoadingRole === "OFFICER" && (
                        <Loader2 size={12} className="mt-1.5 animate-spin text-amber-400" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={googleSignIn}
                disabled={googleLoading || loading || !!demoLoadingRole}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50 shadow-sm"
              >
                {googleLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <svg className="size-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                )}
                Continue with Google
              </button>

              <div className="mt-2 text-center">
                <span className="text-[10px] text-white/40">
                  ⚠️ If Google shows Error 401, use the 1-Click Evaluation buttons above.
                </span>
              </div>

              {/* Divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">
                  or enter credentials manually
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* Credentials Form */}
              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && (
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" />
                      <input
                        required
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Ramesh Patil"
                        className="h-11 w-full rounded-xl border border-white/15 bg-black/40 pl-10 pr-4 text-xs text-white outline-none focus:border-emerald-500/70"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-white/70">
                      Email Address
                    </label>
                    {mode === "signin" && (
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className="text-white/40">Fill:</span>
                        <button
                          type="button"
                          onClick={() => fillDemo("farmer@kisanx.com", "Password123!")}
                          className="font-semibold text-emerald-400 hover:underline"
                        >
                          Farmer
                        </button>
                        <span className="text-white/30">•</span>
                        <button
                          type="button"
                          onClick={() => fillDemo("buyer@kisanx.com", "Password123!")}
                          className="font-semibold text-teal-400 hover:underline"
                        >
                          Buyer
                        </button>
                        <span className="text-white/30">•</span>
                        <button
                          type="button"
                          onClick={() => fillDemo("officer@kisanx.com", "Password123!")}
                          className="font-semibold text-amber-400 hover:underline"
                        >
                          Inspector
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" />
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="farmer@kisanx.com"
                      className="h-11 w-full rounded-xl border border-white/15 bg-black/40 pl-10 pr-4 text-xs text-white outline-none focus:border-emerald-500/70"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" />
                    <input
                      required
                      minLength={6}
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-11 w-full rounded-xl border border-white/15 bg-black/40 pl-10 pr-10 text-xs text-white outline-none focus:border-emerald-500/70"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label="Toggle password visibility"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Role selection on signup */}
                {mode === "signup" && (
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-2">
                      Select Primary Role
                    </label>
                    <div className="grid gap-2">
                      {roles.map((r) => {
                        const isSelected = role === r.value;
                        return (
                          <div
                            key={r.value}
                            onClick={() => setRole(r.value)}
                            className={`cursor-pointer flex items-center justify-between rounded-xl border p-3 transition ${
                              isSelected
                                ? "border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500"
                                : "border-white/10 bg-black/30 hover:border-white/20"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl">{r.icon}</span>
                              <div>
                                <p className="text-xs font-bold text-white">{r.title}</p>
                                <p className="text-[10px] text-white/50">{r.description}</p>
                              </div>
                            </div>
                            {isSelected && <Check size={14} className="text-emerald-400" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Messages */}
                {error && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                    <p className="leading-relaxed">{error}</p>
                    <div className="mt-2.5 pt-2 border-t border-red-500/20 flex items-center justify-between">
                      <span className="text-[10px] text-red-200/70">Want instant zero-friction demo?</span>
                      <button
                        type="button"
                        onClick={() => handleDemoClick("FARMER")}
                        className="rounded-lg bg-emerald-500/25 px-2.5 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/40 transition flex items-center gap-1"
                      >
                        🌾 Enter as Farmer
                      </button>
                    </div>
                  </div>
                )}

                {message && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                    {message}
                  </div>
                )}

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3.5 text-xs font-extrabold text-black shadow-lg shadow-emerald-500/20 transition hover:shadow-emerald-500/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Authenticating...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      {mode === "signin" ? "Enter KisanX Workspace" : "Create Grower Account"}
                      <ArrowRight size={14} />
                    </span>
                  )}
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default AuthUI;
