"use client";

import React, { useEffect } from "react";
import { 
  CheckCircle2, 
  Lock, 
  Sparkles, 
  X, 
  Cpu, 
  ShieldCheck, 
  Activity,
  Layers
} from "lucide-react";

export type SupportedCrop = "Cotton" | "Sugarcane";

export interface CropOption {
  id: "Cotton" | "Sugarcane" | "Barley" | "Maize";
  name: string;
  scientificName: string;
  icon: string;
  status: "trained" | "locked";
  modelName: string;
  modelType: string;
  accuracy: string;
  supportedDiseases: string[];
  description: string;
  badgeColor: string;
  glowColor: string;
}

const CROP_OPTIONS: CropOption[] = [
  {
    id: "Cotton",
    name: "Cotton",
    scientificName: "Gossypium hirsutum",
    icon: "🌿",
    status: "trained",
    modelName: "YOLOv11-seg",
    modelType: "Instance Segmentation & Severity",
    accuracy: "94.8% mAP",
    supportedDiseases: ["Bacterial Blight", "Curl Virus", "Boll Rot", "Healthy Leaf"],
    description: "Multi-leaf pixel mask segmentation with automated severity grading and risk prediction.",
    badgeColor: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    glowColor: "group-hover:border-emerald-500/50 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.18)]",
  },
  {
    id: "Sugarcane",
    name: "Sugarcane",
    scientificName: "Saccharum officinarum",
    icon: "🎋",
    status: "trained",
    modelName: "MobileNetV2-Deep",
    modelType: "Deep Convolutional Classifier",
    accuracy: "93.4% Top-1",
    supportedDiseases: ["Red Rot", "Mosaic Virus", "Rust", "Yellow Leaf", "Healthy"],
    description: "High-throughput disease detection, sucrose risk advisory, and harvest window intelligence.",
    badgeColor: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    glowColor: "group-hover:border-amber-500/50 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.18)]",
  },
  {
    id: "Barley",
    name: "Barley",
    scientificName: "Hordeum vulgare",
    icon: "🌾",
    status: "locked",
    modelName: "BarleyNet-V1",
    modelType: "Model in Active Training",
    accuracy: "In Training",
    supportedDiseases: ["Spot Blotch", "Powdery Mildew", "Net Blotch"],
    description: "Agronomic dataset training underway. Neural weights currently in benchmarking phase.",
    badgeColor: "border-white/10 bg-white/5 text-white/40",
    glowColor: "",
  },
  {
    id: "Maize",
    name: "Maize (Corn)",
    scientificName: "Zea mays",
    icon: "🌽",
    status: "locked",
    modelName: "MaizeVision-X",
    modelType: "Model in Active Training",
    accuracy: "In Training",
    supportedDiseases: ["Fall Armyworm", "Northern Blight", "Common Rust"],
    description: "Computer vision segmentation pipeline queued. Field trials & validation in progress.",
    badgeColor: "border-white/10 bg-white/5 text-white/40",
    glowColor: "",
  },
];

interface CropSelectionModalProps {
  isOpen: boolean;
  selectedCrop: SupportedCrop;
  onSelectCrop: (crop: SupportedCrop) => void;
  onClose: () => void;
  canClose?: boolean;
}

export function CropSelectionModal({
  isOpen,
  selectedCrop,
  onSelectCrop,
  onClose,
  canClose = true,
}: CropSelectionModalProps) {
  // Handle ESC key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && canClose) {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, canClose, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Dynamic Backdrop */}
      <div 
        className="fixed inset-0 bg-[#020503]/80 backdrop-blur-xl transition-opacity animate-in fade-in duration-300"
        onClick={canClose ? onClose : undefined}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl rounded-3xl border border-white/15 bg-gradient-to-b from-[#0e1711]/95 to-[#070c09]/95 p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl z-10 animate-in zoom-in-95 duration-200">
        {/* Glow accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-emerald-500/15 blur-3xl pointer-events-none rounded-full" />

        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <Cpu size={13} className="text-emerald-400 animate-pulse" />
              Multi-Crop Neural Segregation
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Select Crop for AI Diagnostic
            </h2>
            <p className="mt-2 text-sm text-white/60 max-w-2xl leading-relaxed">
              KisanX operates isolated, crop-specific AI models to ensure zero cross-contamination. Select an active crop pipeline to activate its dedicated weights & RAG advisory.
            </p>
          </div>

          {canClose && (
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Crops Grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {CROP_OPTIONS.map((crop) => {
            const isTrained = crop.status === "trained";
            const isSelected = selectedCrop === crop.id;

            return (
              <div
                key={crop.id}
                onClick={() => {
                  if (isTrained) {
                    onSelectCrop(crop.id as SupportedCrop);
                    onClose();
                  }
                }}
                className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-300 ${
                  isTrained
                    ? `cursor-pointer bg-white/[0.03] hover:bg-white/[0.06] ${crop.glowColor} ${
                        isSelected 
                          ? "border-emerald-400/80 bg-emerald-950/20 shadow-[0_0_25px_rgba(16,185,129,0.15)] ring-1 ring-emerald-400/50" 
                          : "border-white/10"
                      }`
                    : "cursor-not-allowed border-white/5 bg-black/40 opacity-60"
                }`}
              >
                {/* Header of card */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] border border-white/10 text-2xl shadow-inner">
                        {crop.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white tracking-wide">
                            {crop.name}
                          </h3>
                          {isSelected && (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 size={11} />
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs italic text-white/40 font-mono">
                          {crop.scientificName}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {isTrained ? (
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${crop.badgeColor}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current animate-ping" />
                        Trained AI
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/40">
                        <Lock size={12} className="text-white/40" />
                        In Training
                      </span>
                    )}
                  </div>

                  {/* Model Meta info */}
                  <div className="mt-4 rounded-xl border border-white/5 bg-black/30 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/50 flex items-center gap-1">
                        <Layers size={12} className="text-white/40" />
                        Engine:
                      </span>
                      <span className="font-mono font-semibold text-white/90">
                        {crop.modelName}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-white/50 flex items-center gap-1">
                        <Activity size={12} className="text-white/40" />
                        Type:
                      </span>
                      <span className="text-white/70 truncate max-w-[170px]">
                        {crop.modelType}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="mt-3 text-xs leading-relaxed text-white/60">
                    {crop.description}
                  </p>

                  {/* Supported Disease Tags */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {crop.supportedDiseases.slice(0, 3).map((d) => (
                      <span
                        key={d}
                        className="rounded-md border border-white/5 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/50 font-medium"
                      >
                        {d}
                      </span>
                    ))}
                    {crop.supportedDiseases.length > 3 && (
                      <span className="rounded-md border border-white/5 bg-white/[0.02] px-1.5 py-0.5 text-[10px] text-white/40">
                        +{crop.supportedDiseases.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Action Button */}
                <div className="mt-5 pt-3 border-t border-white/5">
                  {isTrained ? (
                    <button
                      type="button"
                      className={`w-full rounded-xl py-2.5 text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                        isSelected
                          ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                          : "border border-white/10 bg-white/5 text-white/80 group-hover:bg-white/10 group-hover:text-white"
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 size={14} />
                          Currently Selected
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} className="text-amber-400" />
                          Select {crop.name} Engine
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5 py-2.5 text-xs text-white/30 font-medium">
                      <Lock size={13} />
                      Model Inactive • Dataset Benchmarking
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info notice */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-white/5 bg-black/40 px-4 py-3 text-xs text-white/50">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            <span>
              Strict Isolation Active: Cotton runs YOLOv11 Segment • Sugarcane runs MobileNetV2 Deep
            </span>
          </div>
          <span className="text-white/40 font-mono text-[11px]">
            Accuracy Guarantee: 0% Cross-Crop Bleed
          </span>
        </div>
      </div>
    </div>
  );
}
