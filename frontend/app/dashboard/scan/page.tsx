"use client";

import {
  ChangeEvent,
  DragEvent,
  KeyboardEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronDown,
  Cpu,
  HelpCircle,
  Info,
  Layers,
  MapPin,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  CropSelectionModal,
  SupportedCrop,
} from "@/components/ui/crop_selection_modal";
import { CropDoctorAdvisoryCard } from "@/components/diagnostic/crop_doctor_advisory_card";

// ============================================================
// TYPES
// ============================================================

type Farm = {
  id: string;
  name: string;
  village?: string | null;
  district?: string | null;
};

type Plot = {
  id: string;
  name: string;
  farm_id: string;
};

type PredictionItem = {
  disease?: string;
  confidence?: number;
  class_id?: number;
  detection_coverage?: number;
};

type Prediction = {
  crop: string;
  disease: string;
  confidence: number;
  confidence_percent?: number;
  class_probabilities?: Record<string, number>;
  detection_coverage?: number;
  risk_score?: number;
  severity?: string | null;
  predictions?: PredictionItem[];
};

type AdvisoryEvidence = {
  title?: string;
  source_name?: string;
  source_url?: string | null;
  similarity?: number;
  content?: string;
};

type Advisory = {
  answer: string;
  confidence?: string;
  evidence_sufficient?: boolean;
  needs_more_information?: boolean;
  follow_up_question?: string | null;
  sources?: number[];
  retrieved_documents?: number;
  evidence?: AdvisoryEvidence[];
};

type ScanRecord = {
  id: string;
  image_url?: string | null;
  farm_id?: string | null;
  plot_id?: string | null;
  crop_cycle_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
};

type ScanResponse = {
  success: boolean;
  message?: string;
  crop?: string;
  scan_id: string;
  scan: ScanRecord;
  prediction: Prediction;
  advisory: Advisory;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// ============================================================
// API
// ============================================================

const API_URL =
  process.env.NEXT_PUBLIC_KISANX_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

// ============================================================
// PAGE COMPONENT
// ============================================================

export default function CropScanPage() {
  const supabase = createClient();

  // ----------------------------------------------------------
  // CROP SEGREGATION STATE
  // ----------------------------------------------------------
  const [selectedCrop, setSelectedCrop] = useState<SupportedCrop>("Cotton");
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // ----------------------------------------------------------
  // FARM / PLOT STATE
  // ----------------------------------------------------------
  const [farms, setFarms] = useState<Farm[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [selectedFarm, setSelectedFarm] = useState("");
  const [selectedPlot, setSelectedPlot] = useState("");

  // ----------------------------------------------------------
  // IMAGE & DRAG STATE
  // ----------------------------------------------------------
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // ----------------------------------------------------------
  // LOCATION STATE
  // ----------------------------------------------------------
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // ----------------------------------------------------------
  // LANGUAGE & DIAGNOSTIC STATE
  // ----------------------------------------------------------
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);

  // ----------------------------------------------------------
  // CHAT ASSISTANT STATE
  // ----------------------------------------------------------
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  // ----------------------------------------------------------
  // LOAD FARMS ON MOUNT
  // ----------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    async function loadFarms() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || !mounted) return;

        const { data, error: farmError } = await supabase
          .from("farms")
          .select("id, name, village, district")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false });

        if (farmError) {
          console.error("FARM LOAD ERROR:", farmError);
          if (mounted) setError("Could not load your registered farms.");
          return;
        }

        if (mounted && data) {
          setFarms(data);
          if (data.length === 1) {
            setSelectedFarm(data[0].id);
          }
        }
      } catch (err) {
        console.error("LOAD FARMS ERROR:", err);
        if (mounted) setError("Could not connect to farms registry.");
      }
    }

    loadFarms();
    return () => {
      mounted = false;
    };
  }, []);

  // ----------------------------------------------------------
  // LOAD PLOTS WHEN FARM CHANGES
  // ----------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    async function loadPlots() {
      if (!selectedFarm) {
        setPlots([]);
        setSelectedPlot("");
        return;
      }

      try {
        const { data, error: plotError } = await supabase
          .from("plots")
          .select("id, name, farm_id")
          .eq("farm_id", selectedFarm)
          .order("name", { ascending: true });

        if (plotError) {
          console.error("PLOT LOAD ERROR:", plotError);
          if (mounted) setError("Could not load field plots.");
          return;
        }

        if (mounted) {
          setPlots(data || []);
          if (data && data.length === 1) {
            setSelectedPlot(data[0].id);
          }
        }
      } catch (err) {
        console.error("LOAD PLOTS ERROR:", err);
        if (mounted) setError("Could not load field plots.");
      }
    }

    loadPlots();
    return () => {
      mounted = false;
    };
  }, [selectedFarm]);

  // ----------------------------------------------------------
  // OBJECT URL CLEANUP
  // ----------------------------------------------------------
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // ----------------------------------------------------------
  // FILE HANDLING
  // ----------------------------------------------------------
  function processFile(file: File) {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setError("Please select a JPG, PNG or WebP image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image file size must be less than 10 MB.");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(url);
    setError("");
    setMessage("");
    setScanResult(null);
    setChatMessages([]);
    setChatInput("");
    setChatError("");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }

  function removeImage() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl("");
    setScanResult(null);
    setMessage("");
    setError("");
    setChatMessages([]);
    setChatInput("");
    setChatError("");
  }

  // ----------------------------------------------------------
  // GPS GEOLOCATION
  // ----------------------------------------------------------
  function getLocation() {
    setError("");
    setLocationLoading(true);

    if (!navigator.geolocation) {
      setLocationLoading(false);
      setError("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setLocationLoading(false);
      },
      () => {
        setLocationLoading(false);
        setError("Could not access GPS location. Please allow location permissions.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  // ----------------------------------------------------------
  // SUBMIT SCAN TO BACKEND
  // ----------------------------------------------------------
  async function submitScan() {
    setError("");
    setMessage("");
    setScanResult(null);
    setChatMessages([]);
    setChatError("");

    if (!selectedFile) {
      setError(`Please upload or capture a ${selectedCrop} leaf image first.`);
      return;
    }

    if (!selectedFarm) {
      setError("Please select the farm where this sample was collected.");
      return;
    }

    if (!selectedPlot) {
      setError("Please select the field plot section.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("farm_id", selectedFarm);
      formData.append("plot_id", selectedPlot);
      formData.append("crop_name", selectedCrop); // Segregated Crop
      formData.append("language", language);

      if (latitude !== null) {
        formData.append("latitude", latitude.toString());
      }
      if (longitude !== null) {
        formData.append("longitude", longitude.toString());
      }

      const response = await fetch(`${API_URL}/api/scans/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        throw new Error("Invalid response received from the KisanX AI server.");
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            `${selectedCrop} AI analysis failed. Please try again.`
        );
      }

      setScanResult(data as ScanResponse);
      if (data?.advisory?.answer) {
        setChatMessages([
          {
            role: "assistant",
            content: data.advisory.answer,
          },
        ]);
      }
      setMessage(
        `${selectedCrop} scan completed successfully via ${
          selectedCrop === "Cotton" ? "YOLOv11 Segmentation" : "MobileNetV2 Deep"
        } engine.`
      );
    } catch (err) {
      console.error("SCAN SUBMIT ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : `Something went wrong while analyzing the ${selectedCrop} crop.`
      );
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // ASK CROP DOCTOR (RAG ASSISTANT)
  // ----------------------------------------------------------
  async function askAssistant(questionOverride?: string) {
    const question = (questionOverride ?? chatInput).trim();
    if (!question) return;

    if (!scanResult) {
      setChatError("Please complete an AI scan before asking follow-up questions.");
      return;
    }

    if (chatLoading) return;

    setChatError("");
    setChatInput("");

    const userMessage: ChatMessage = {
      role: "user",
      content: question,
    };

    const previousMessages = [...chatMessages];
    setChatMessages([...previousMessages, userMessage]);
    setChatLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch(`${API_URL}/api/assistant/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          question,
          crop: selectedCrop, // Dynamically passed based on user selection!
          disease: scanResult.prediction.disease,
          classifier_confidence: scanResult.prediction.confidence,
          language,
          farm_id: scanResult.scan.farm_id ?? selectedFarm,
          plot_id: scanResult.scan.plot_id ?? selectedPlot,
          crop_cycle_id: scanResult.scan.crop_cycle_id ?? undefined,
          scan_id: scanResult.scan_id,
          history: previousMessages,
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        throw new Error("Crop Doctor returned an unreadable response.");
      }

      if (!response.ok) {
        throw new Error(data?.detail || "Crop Doctor inquiry failed.");
      }

      const answer = data?.answer?.answer ?? data?.answer ?? data?.response;
      if (!answer || typeof answer !== "string") {
        throw new Error("Crop Doctor could not formulate an answer.");
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: answer,
      };

      setChatMessages((current) => [...current, assistantMessage]);
    } catch (err) {
      setChatMessages((current) => {
        const copy = [...current];
        const lastIndex = copy.length - 1;
        if (copy[lastIndex]?.role === "user") {
          copy.splice(lastIndex, 1);
        }
        return copy;
      });
      setChatInput(question);
      setChatError(err instanceof Error ? err.message : "Failed to obtain advisory answer.");
    } finally {
      setChatLoading(false);
    }
  }

  function handleChatKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      askAssistant();
    }
  }

  // ----------------------------------------------------------
  // FORMATTING HELPERS
  // ----------------------------------------------------------
  function formatDiseaseName(disease: string) {
    if (!disease) return "Unknown Signal";
    return disease.replaceAll("_", " ").replaceAll("-", " ");
  }

  function getSeverityClasses(severity?: string | null) {
    switch (severity?.toUpperCase()) {
      case "HEALTHY":
        return "border-emerald-400/40 bg-emerald-400/10 text-emerald-300";
      case "LOW":
        return "border-lime-400/40 bg-lime-400/10 text-lime-300";
      case "MODERATE":
        return "border-amber-400/40 bg-amber-400/10 text-amber-300";
      case "HIGH":
        return "border-orange-500/40 bg-orange-500/10 text-orange-300";
      case "SEVERE":
        return "border-red-500/40 bg-red-500/10 text-red-300";
      default:
        return "border-white/15 bg-white/5 text-white/70";
    }
  }

  function getSeverityDescription(severity?: string | null) {
    switch (severity?.toUpperCase()) {
      case "HEALTHY":
        return "Optimal plant foliage condition. No significant pathogenic lesions detected.";
      case "LOW":
        return "Incipient or isolated symptom spots. Routine field observation advised.";
      case "MODERATE":
        return "Established pathogen indicators detected. Targeted preventive treatment recommended.";
      case "HIGH":
        return "Significant foliar compromise. Prompt localized chemical or biological spray needed.";
      case "SEVERE":
        return "Critical systemic progression detected. Immediate containment and agronomic intervention required.";
      default:
        return "AI-computed severity indicator based on confidence and segmented foliage impact.";
    }
  }

  // Crop-specific theme tokens
  const isCotton = selectedCrop === "Cotton";
  const cropThemeColor = isCotton ? "emerald" : "amber";
  const cropIcon = isCotton ? "🌿" : "🎋";
  const modelBadge = isCotton ? "YOLOv11 Instance Segmentation" : "MobileNetV2 Deep Learning";

  return (
    <main className="min-h-screen bg-[#030604] text-white selection:bg-emerald-500/30 selection:text-white">
      {/* Background Decorative Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className={`absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full blur-[140px] opacity-20 transition-all duration-700 ${
          isCotton ? "bg-emerald-600" : "bg-amber-600"
        }`} />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full blur-[160px] opacity-15 bg-teal-800" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        {/* ==================================================== */}
        {/* TOP NAVIGATION & CROP SEGREGATION BANNER */}
        {/* ==================================================== */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-6">
          <div>
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/50 transition hover:text-white"
            >
              <ArrowLeft size={14} className="transition group-hover:-translate-x-1" />
              Back to Farm Dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              AI Crop Diagnostic Suite
            </h1>
            <p className="mt-1 text-sm text-white/55 max-w-xl">
              High-resolution computer vision and RAG agronomy intelligence tailored to your specific crop.
            </p>
          </div>

          {/* CROP SELECTOR PILL (PROMINENT TRIGGER) */}
          <div className="flex flex-wrap items-center gap-3">
            <div className={`flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 backdrop-blur-xl shadow-lg transition-all ${
              isCotton
                ? "border-emerald-500/40 bg-emerald-950/30 shadow-emerald-500/10"
                : "border-amber-500/40 bg-amber-950/30 shadow-amber-500/10"
            }`}>
              <span className="text-xl">{cropIcon}</span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    {selectedCrop} Pipeline
                  </span>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-[11px] font-mono text-white/60">
                  {modelBadge}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCropModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-semibold text-white shadow-md backdrop-blur-lg transition hover:bg-white/15 hover:border-white/30"
            >
              <RefreshCw size={14} className="text-amber-300 animate-spin-slow" />
              Switch Crop
            </button>
          </div>
        </div>

        {/* ==================================================== */}
        {/* MAIN SCAN WORKSPACE (TWO COLUMNS) */}
        {/* ==================================================== */}
        <div className="grid gap-8 lg:grid-cols-12">
          {/* -------------------------------------------------- */}
          {/* LEFT COLUMN: UPLOAD & FIELD CONTEXT (5 COLS) */}
          {/* -------------------------------------------------- */}
          <div className="space-y-6 lg:col-span-5">
            {/* STEP 1: IMAGE CAPTURE DROPZONE */}
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400 border border-emerald-500/40">
                    1
                  </span>
                  <h2 className="text-base font-bold text-white tracking-wide">
                    Leaf Imagery
                  </h2>
                </div>
                <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white/60 font-mono">
                  {selectedCrop} Model Ready
                </span>
              </div>

              {/* DROPZONE */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ${
                  isDragging
                    ? "border-emerald-400 bg-emerald-950/20 scale-[0.99]"
                    : previewUrl
                    ? "border-emerald-500/40 bg-black/50"
                    : "border-white/15 bg-black/30 hover:border-white/30 hover:bg-black/40"
                }`}
              >
                {previewUrl ? (
                  <div className="relative group">
                    <img
                      src={previewUrl}
                      alt={`Selected ${selectedCrop} Leaf`}
                      className="h-80 w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

                    {/* Image Meta Chip */}
                    <div className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md border border-white/10">
                      {selectedFile?.name || "Leaf Image Sample"}
                    </div>

                    {/* Remove Action */}
                    <button
                      type="button"
                      onClick={removeImage}
                      disabled={loading}
                      aria-label="Remove image"
                      className="absolute top-3 right-3 rounded-xl border border-white/20 bg-black/70 p-2 text-white/80 backdrop-blur-md transition hover:bg-black hover:text-white"
                    >
                      <X size={16} />
                    </button>

                    {/* Loading Overlay */}
                    {loading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md">
                        <div className="relative flex items-center justify-center">
                          <div className="h-16 w-16 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-400" />
                          <Cpu size={24} className="absolute text-emerald-400 animate-pulse" />
                        </div>
                        <p className="mt-4 font-bold text-white tracking-wide">
                          Running {selectedCrop} Neural Model...
                        </p>
                        <p className="mt-1 text-xs text-white/60 font-mono">
                          {selectedCrop === "Cotton" ? "YOLOv11 Segmentation & Risk" : "MobileNetV2 Class Extraction"}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="flex min-h-[300px] cursor-pointer flex-col items-center justify-center p-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-3xl shadow-inner transition group-hover:scale-110">
                      {cropIcon}
                    </div>
                    <p className="mt-4 text-base font-semibold text-white">
                      Drop {selectedCrop} Leaf Photo Here
                    </p>
                    <p className="mt-1 max-w-xs text-xs text-white/50 leading-relaxed">
                      Capture the symptomatic or infected section in high clarity. JPG, PNG or WebP up to 10 MB.
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400">
                        <UploadCloud size={16} />
                        Choose Photo
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10">
                        <Camera size={16} />
                        Use Camera
                      </span>
                    </div>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                )}
              </div>

              {/* LOCATION PICKER */}
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-emerald-400 border border-white/10">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">Field GPS Telemetry</p>
                      <p className="text-[11px] text-white/50">
                        {latitude !== null
                          ? `${latitude.toFixed(5)}, ${longitude?.toFixed(5)}`
                          : "Tag coordinates to plot"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={getLocation}
                    disabled={locationLoading || loading}
                    className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                  >
                    {locationLoading ? (
                      "Acquiring..."
                    ) : latitude !== null ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={13} /> GPS Locked
                      </span>
                    ) : (
                      "Detect GPS"
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* STEP 2: FARM & FIELD ASSIGNMENT */}
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400 border border-emerald-500/40">
                  2
                </span>
                <h2 className="text-base font-bold text-white tracking-wide">
                  Field & Language Context
                </h2>
              </div>

              <div className="space-y-4">
                {/* FARM SELECTOR */}
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1.5">
                    Farm Location
                  </label>
                  <select
                    value={selectedFarm}
                    onChange={(e) => {
                      setSelectedFarm(e.target.value);
                      setSelectedPlot("");
                    }}
                    disabled={loading}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <option value="" className="bg-[#0b130e]">
                      -- Select Farm --
                    </option>
                    {farms.map((f) => (
                      <option key={f.id} value={f.id} className="bg-[#0b130e]">
                        {f.name} {f.village ? `(${f.village})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* PLOT SELECTOR */}
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1.5">
                    Field Section / Plot
                  </label>
                  <select
                    value={selectedPlot}
                    onChange={(e) => setSelectedPlot(e.target.value)}
                    disabled={!selectedFarm || loading}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-40"
                  >
                    <option value="" className="bg-[#0b130e]">
                      {selectedFarm ? "-- Select Plot --" : "-- Select a Farm First --"}
                    </option>
                    {plots.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#0b130e]">
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* LANGUAGE */}
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1.5">
                    Advisory Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={loading}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <option value="en" className="bg-[#0b130e]">English (Agronomy Technical)</option>
                    <option value="hi" className="bg-[#0b130e]">हिंदी (Hindi Advisory)</option>
                    <option value="mr" className="bg-[#0b130e]">मराठी (Marathi Advisory)</option>
                  </select>
                </div>
              </div>

              {/* SCAN EXECUTION ACTION BUTTON */}
              <button
                type="button"
                onClick={submitScan}
                disabled={loading || !selectedFile || !selectedFarm || !selectedPlot}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-5 py-4 font-extrabold text-black shadow-[0_0_30px_rgba(16,185,129,0.3)] transition hover:shadow-[0_0_45px_rgba(16,185,129,0.5)] hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                    Analyzing {selectedCrop} with AI...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles size={18} />
                    Analyze {selectedCrop} Foliage
                  </span>
                )}
              </button>

              {/* ERROR / FEEDBACK MESSAGES */}
              {error && (
                <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              {message && (
                <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  <div>{message}</div>
                </div>
              )}
            </div>
          </div>

          {/* -------------------------------------------------- */}
          {/* RIGHT COLUMN: AI DIAGNOSTIC REPORT & CHAT (7 COLS) */}
          {/* -------------------------------------------------- */}
          <div className="space-y-6 lg:col-span-7">
            {scanResult ? (
              <>
                {/* 1. PRIMARY AI VERDICT CARD */}
                <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 font-mono">
                        {scanResult.crop || selectedCrop} AI Engine
                      </span>
                      <span className="text-xs text-white/40 font-mono">
                        ID: {scanResult.scan_id?.slice(0, 8)}...
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getSeverityClasses(scanResult.prediction.severity)}`}>
                        {scanResult.prediction.severity?.toUpperCase() || "UNCERTAIN"}
                      </span>
                    </div>
                  </div>

                  {/* DISEASE IDENTIFIER */}
                  <div className="mt-5">
                    <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">
                      Primary Diagnosis
                    </span>
                    <h2 className="mt-1 text-3xl font-extrabold text-white tracking-tight">
                      {formatDiseaseName(scanResult.prediction.disease)}
                    </h2>
                    <p className="mt-1 text-xs text-white/60">
                      {getSeverityDescription(scanResult.prediction.severity)}
                    </p>
                  </div>

                  {/* METRICS ROW */}
                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Confidence */}
                    <div className="rounded-2xl border border-white/5 bg-black/40 p-3.5">
                      <p className="text-[11px] text-white/50 uppercase tracking-wider">Confidence</p>
                      <p className="mt-1 text-2xl font-bold font-mono text-emerald-300">
                        {(scanResult.prediction.confidence * 100).toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-white/40 mt-0.5">Model Certainty</p>
                    </div>

                    {/* Risk Score */}
                    <div className="rounded-2xl border border-white/5 bg-black/40 p-3.5">
                      <p className="text-[11px] text-white/50 uppercase tracking-wider">Field Risk</p>
                      <p className="mt-1 text-2xl font-bold font-mono text-amber-300">
                        {scanResult.prediction.risk_score !== undefined
                          ? scanResult.prediction.risk_score.toFixed(1)
                          : "—"}
                        <span className="text-xs text-white/40">/100</span>
                      </p>
                      <p className="text-[10px] text-white/40 mt-0.5">Automated Index</p>
                    </div>

                    {/* Coverage Area */}
                    <div className="rounded-2xl border border-white/5 bg-black/40 p-3.5">
                      <p className="text-[11px] text-white/50 uppercase tracking-wider">Mask Coverage</p>
                      <p className="mt-1 text-2xl font-bold font-mono text-teal-300">
                        {scanResult.prediction.detection_coverage !== undefined
                          ? `${(scanResult.prediction.detection_coverage * 100).toFixed(1)}%`
                          : "—"}
                      </p>
                      <p className="text-[10px] text-white/40 mt-0.5">Segmented Foliage</p>
                    </div>

                    {/* Severity Tier */}
                    <div className="rounded-2xl border border-white/5 bg-black/40 p-3.5">
                      <p className="text-[11px] text-white/50 uppercase tracking-wider">Severity</p>
                      <p className="mt-1 text-base font-bold text-white uppercase truncate">
                        {scanResult.prediction.severity || "Standard"}
                      </p>
                      <p className="text-[10px] text-white/40 mt-0.5">Damage Rating</p>
                    </div>
                  </div>
                </div>

                {/* 2. RAG AGRONOMY ADVISORY CARD */}
                <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/20 to-black/40 p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
                        <Sparkles size={16} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">
                          KisanX Agronomy Advisory
                        </h3>
                        <p className="text-[11px] text-white/50">
                          Grounding: Verified agricultural research & disease protocols
                        </p>
                      </div>
                    </div>

                    {scanResult.advisory.confidence && (
                      <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/60 font-mono">
                        Evidence: {scanResult.advisory.confidence}
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    <CropDoctorAdvisoryCard
                      content={scanResult.advisory.answer}
                      cropName={selectedCrop}
                      diseaseName={scanResult.prediction.disease}
                      severity={scanResult.prediction.severity}
                      confidence={scanResult.advisory.confidence}
                    />
                  </div>

                  {/* FOLLOW-UP PROMPT IF ANY */}
                  {scanResult.advisory.follow_up_question && (
                    <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                        Agronomist Inspection Query
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-white/75">
                        {scanResult.advisory.follow_up_question}
                      </p>
                    </div>
                  )}

                  {/* EVIDENCE CITATIONS */}
                  {scanResult.advisory.evidence && scanResult.advisory.evidence.length > 0 && (
                    <div className="mt-5 border-t border-white/10 pt-4">
                      <p className="text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">
                        Referenced Agronomy Documentation ({scanResult.advisory.evidence.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {scanResult.advisory.evidence.map((ev, i) => (
                          <div
                            key={i}
                            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/70"
                          >
                            <span className="font-semibold text-white/90">
                              {ev.title || `Resource #${i + 1}`}
                            </span>
                            {ev.similarity && (
                              <span className="ml-2 font-mono text-[10px] text-emerald-400">
                                {(ev.similarity * 100).toFixed(0)}% match
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. INTERACTIVE CROP DOCTOR CHAT */}
                <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-[#0b1610] to-[#060b08] p-6 shadow-2xl backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/20 text-teal-300">
                        <Cpu size={16} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">
                          KisanX Crop Doctor Assistant
                        </h3>
                        <p className="text-[11px] text-white/50">
                          Real-time AI diagnostic dialogue for {selectedCrop}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-mono text-emerald-300">
                      RAG Active
                    </span>
                  </div>

                  {/* QUICK INQUIRY CHIPS */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      `What organic treatment is safest for this ${selectedCrop}?`,
                      "What chemical dosage is recommended per acre?",
                      "How fast is this likely to spread across rows?",
                      "Should I adjust my watering schedule now?",
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => askAssistant(chip)}
                        disabled={chatLoading}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  {/* CHAT MESSAGES LOG */}
                  {chatMessages.length > 0 && (
                    <div className="mt-5 max-h-96 space-y-3 overflow-y-auto pr-2">
                      {chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          {msg.role === "assistant" ? (
                            <div className="w-full max-w-[95%]">
                              <CropDoctorAdvisoryCard
                                content={msg.content}
                                cropName={selectedCrop}
                                diseaseName={scanResult?.prediction?.disease}
                                severity={scanResult?.prediction?.severity}
                              />
                            </div>
                          ) : (
                            <div className="max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed bg-emerald-500 text-black font-semibold rounded-br-none shadow-md">
                              {msg.content}
                            </div>
                          )}
                        </div>
                      ))}

                      {chatLoading && (
                        <div className="flex justify-start">
                          <div className="rounded-2xl rounded-bl-none border border-white/10 bg-white/[0.05] px-4 py-3 text-xs text-white/60 flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce" />
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:150ms]" />
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:300ms]" />
                            <span>Consulting agronomy evidence...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CHAT INPUT FORM */}
                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-2">
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={handleChatKeyDown}
                      disabled={chatLoading}
                      placeholder={`Ask follow-up questions regarding this ${selectedCrop} diagnosis...`}
                      rows={2}
                      className="w-full resize-none bg-transparent px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none"
                    />
                    <div className="flex items-center justify-between border-t border-white/10 px-2 pt-2">
                      <span className="text-[10px] text-white/40">
                        Press Enter to send
                      </span>
                      <button
                        type="button"
                        onClick={() => askAssistant()}
                        disabled={chatLoading || !chatInput.trim()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-emerald-400 disabled:opacity-30"
                      >
                        <Send size={12} />
                        Ask
                      </button>
                    </div>
                  </div>

                  {chatError && (
                    <div className="mt-3 text-xs text-red-400">
                      {chatError}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* STANDBY / EMPTY STATE CARD */
              <div className="flex min-h-[500px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-8 text-center backdrop-blur-xl">
                <div className="relative flex items-center justify-center">
                  <div className="h-28 w-28 rounded-full border border-emerald-500/20 bg-emerald-500/5 animate-pulse" />
                  <div className="absolute h-20 w-20 rounded-full border border-teal-500/30 bg-teal-500/10 flex items-center justify-center text-4xl">
                    {cropIcon}
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300 mt-6 font-mono">
                  <Cpu size={13} className="text-emerald-400" />
                  {selectedCrop} AI Neural Engine
                </div>

                <h3 className="mt-4 text-2xl font-bold text-white tracking-tight">
                  Awaiting {selectedCrop} Leaf Imagery
                </h3>
                <p className="mt-2 max-w-md text-xs text-white/50 leading-relaxed">
                  Upload a photo on the left and assign your field plot. KisanX will execute the dedicated {modelBadge} pipeline and generate real-time agronomy advisories.
                </p>

                {/* Standby Feature checklist */}
                <div className="mt-8 grid grid-cols-2 gap-3 max-w-md text-left text-xs text-white/60">
                  <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span>Dedicated Model Isolation</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span>RAG Agronomic Treatment</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span>Severity & Risk Index</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span>Crop Doctor AI Assistant</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* CROP SELECTION POPUP / MODAL */}
      {/* ==================================================== */}
      <CropSelectionModal
        isOpen={isCropModalOpen}
        selectedCrop={selectedCrop}
        onSelectCrop={(crop) => {
          setSelectedCrop(crop);
          // If a scan was already active for another crop, reset it to prevent mixup
          if (crop !== selectedCrop) {
            setScanResult(null);
            setMessage("");
            setError("");
            setChatMessages([]);
          }
        }}
        onClose={() => setIsCropModalOpen(false)}
        canClose={true}
      />
    </main>
  );
}