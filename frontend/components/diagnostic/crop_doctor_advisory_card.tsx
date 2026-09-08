"use client";

import React, { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Droplets,
  FlaskConical,
  Leaf,
  Microscope,
  ShieldCheck,
  Sparkles,
  Sprout,
  ThermometerSnowflake,
} from "lucide-react";

interface CropDoctorAdvisoryProps {
  content: string;
  cropName?: string;
  diseaseName?: string;
  severity?: string | null;
  confidence?: string | number | null;
}

interface ParsedSection {
  title: string;
  type: "what" | "why" | "how" | "when" | "general";
  content: string;
  subItems?: { label: string; text: string }[];
}

export function CropDoctorAdvisoryCard({
  content,
  cropName = "Crop",
  diseaseName,
  severity,
  confidence,
}: CropDoctorAdvisoryProps) {
  // Parse the structured Crop Doctor response into distinct agronomic cards
  const parsedData = useMemo(() => {
    if (!content) return { greeting: "", sections: [], raw: "" };

    const normalized = content.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    const sections: ParsedSection[] = [];
    let currentSection: ParsedSection | null = null;
    const greetingLines: string[] = [];
    let hasStartedSection = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const cleanHeader = line.replace(/[*#:_]/g, "").trim().toUpperCase();

      if (
        cleanHeader.startsWith("WHAT") ||
        cleanHeader.startsWith("1. WHAT") ||
        cleanHeader.startsWith("1 WHAT")
      ) {
        hasStartedSection = true;
        if (currentSection) sections.push(currentSection);
        currentSection = {
          title: "Pathogen & Physiological Status",
          type: "what",
          content: "",
          subItems: [],
        };
        continue;
      } else if (
        cleanHeader.startsWith("WHY") ||
        cleanHeader.startsWith("2. WHY") ||
        cleanHeader.startsWith("2 WHY")
      ) {
        hasStartedSection = true;
        if (currentSection) sections.push(currentSection);
        currentSection = {
          title: "Etiology & Spread Vectors",
          type: "why",
          content: "",
          subItems: [],
        };
        continue;
      } else if (
        cleanHeader.startsWith("HOW") ||
        cleanHeader.startsWith("3. HOW") ||
        cleanHeader.startsWith("3 HOW")
      ) {
        hasStartedSection = true;
        if (currentSection) sections.push(currentSection);
        currentSection = {
          title: "Clinical Prescription & Treatment Plan",
          type: "how",
          content: "",
          subItems: [],
        };
        continue;
      } else if (
        cleanHeader.startsWith("WHEN") ||
        cleanHeader.startsWith("4. WHEN") ||
        cleanHeader.startsWith("4 WHEN")
      ) {
        hasStartedSection = true;
        if (currentSection) sections.push(currentSection);
        currentSection = {
          title: "Action Timeline & Rescan Schedule",
          type: "when",
          content: "",
          subItems: [],
        };
        continue;
      }

      if (!hasStartedSection) {
        greetingLines.push(line.replace(/[*#]/g, "").trim());
      } else if (currentSection) {
        // Check for bullet sub-items (e.g. * Nutrient Management: ...)
        const bulletMatch = line.match(/^[*•-]\s*([^:*]+)[:*]\s*(.*)/);
        if (bulletMatch) {
          currentSection.subItems?.push({
            label: bulletMatch[1].replace(/[*#]/g, "").trim(),
            text: bulletMatch[2].replace(/[*#]/g, "").trim(),
          });
        } else {
          currentSection.content +=
            (currentSection.content ? "\n" : "") +
            line.replace(/[*#]/g, "").trim();
        }
      }
    }

    if (currentSection) sections.push(currentSection);

    const greeting = greetingLines.join(" ");

    // Fallback if no specific section headers matched
    if (sections.length === 0) {
      sections.push({
        title: "Agronomic Observation",
        type: "general",
        content: normalized.replace(/[*#]/g, "").trim(),
      });
    }

    return { greeting, sections, raw: content };
  }, [content]);

  // Helper to extract highlighted dosages from text
  const renderFormattedText = (text: string) => {
    // Highlight metrics like 1-2%, 120:60:60 kg/ha, 2.5-3.0 g/L, 100 ppm, 3-5 days
    const parts = text.split(
      /(\b\d+(?:[\.\-]\d+)?\s*(?:g\/L|kg\/ha|ppm|%|ml\/L|quintals?|days?|acres?)\b|\b\d+:\d+:\d+\b)/gi
    );

    return (
      <span>
        {parts.map((part, i) => {
          if (
            /(\b\d+(?:[\.\-]\d+)?\s*(?:g\/L|kg\/ha|ppm|%|ml\/L|quintals?|days?|acres?)\b|\b\d+:\d+:\d+\b)/i.test(
              part
            )
          ) {
            return (
              <span
                key={i}
                className="mx-1 inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-300"
              >
                {part}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </span>
    );
  };

  return (
    <div className="space-y-4 text-white">
      {/* 1. GREETING & PROTOCOL BANNER */}
      {parsedData.greeting && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-950/40 via-[#0a180e] to-black/60 p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                  ICAR-CICR Grounded Clinical Advisory
                </span>
                {severity && (
                  <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                    Status: {severity}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-medium leading-relaxed text-emerald-100/90">
                {parsedData.greeting}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. STRUCTURED CLINICAL SECTIONS */}
      <div className="grid gap-3">
        {parsedData.sections.map((section, idx) => {
          if (section.type === "what") {
            return (
              <div
                key={idx}
                className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/40 p-4 transition hover:border-white/20"
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400">
                  <Microscope className="h-4 w-4" />
                  <span>1. {section.title}</span>
                </div>
                <div className="mt-2.5 text-xs leading-relaxed text-white/80">
                  {renderFormattedText(section.content)}
                </div>
              </div>
            );
          }

          if (section.type === "why") {
            return (
              <div
                key={idx}
                className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/40 p-4 transition hover:border-white/20"
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-400">
                  <Droplets className="h-4 w-4" />
                  <span>2. {section.title}</span>
                </div>
                <div className="mt-2.5 text-xs leading-relaxed text-white/80">
                  {renderFormattedText(section.content)}
                </div>
              </div>
            );
          }

          if (section.type === "how") {
            return (
              <div
                key={idx}
                className="rounded-2xl border border-emerald-500/30 bg-[#061209] p-4.5 shadow-xl transition hover:border-emerald-500/50"
              >
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
                    <FlaskConical className="h-4 w-4" />
                    <span>3. {section.title}</span>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    Action Plan
                  </span>
                </div>

                {section.content && (
                  <p className="mt-3 text-xs leading-relaxed text-white/85">
                    {renderFormattedText(section.content)}
                  </p>
                )}

                {/* SUB-CATEGORIES (Nutrient, Irrigation, Weed, Bio, Chemical) */}
                {section.subItems && section.subItems.length > 0 && (
                  <div className="mt-3.5 space-y-2.5">
                    {section.subItems.map((item, itemIdx) => {
                      const isChemical = /chemical|spray|fungicide|pesticide|dosage|copper|streptocycline/i.test(
                        item.label
                      );
                      const isBio = /bio|organic|trichoderma|neem|nske/i.test(
                        item.label
                      );
                      const isNutrient = /nutrient|npk|fertiliz|potassium/i.test(
                        item.label
                      );
                      const isWater = /irrigation|water|furrow|drip/i.test(
                        item.label
                      );

                      return (
                        <div
                          key={itemIdx}
                          className={`rounded-xl border p-3 ${
                            isChemical
                              ? "border-amber-500/35 bg-amber-950/20 shadow-inner"
                              : isBio
                              ? "border-emerald-500/25 bg-emerald-950/25"
                              : isNutrient
                              ? "border-teal-500/25 bg-teal-950/20"
                              : isWater
                              ? "border-sky-500/25 bg-sky-950/20"
                              : "border-white/10 bg-black/40"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isChemical && (
                              <FlaskConical className="h-3.5 w-3.5 text-amber-400" />
                            )}
                            {isBio && (
                              <Leaf className="h-3.5 w-3.5 text-emerald-400" />
                            )}
                            {isNutrient && (
                              <Sprout className="h-3.5 w-3.5 text-teal-400" />
                            )}
                            {isWater && (
                              <Droplets className="h-3.5 w-3.5 text-sky-400" />
                            )}
                            <h4
                              className={`text-xs font-bold uppercase tracking-wider ${
                                isChemical
                                  ? "text-amber-300"
                                  : isBio
                                  ? "text-emerald-300"
                                  : isNutrient
                                  ? "text-teal-300"
                                  : isWater
                                  ? "text-sky-300"
                                  : "text-white"
                              }`}
                            >
                              {item.label}
                            </h4>
                          </div>
                          <p className="mt-1.5 text-xs leading-relaxed text-white/80">
                            {renderFormattedText(item.text)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          if (section.type === "when") {
            return (
              <div
                key={idx}
                className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-[#170e06] to-black/50 p-4 transition hover:border-amber-500/50"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                    <Clock className="h-4 w-4" />
                    <span>4. {section.title}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                    <Calendar className="h-3 w-3" /> Rescan: 3–5 Days
                  </span>
                </div>
                <div className="mt-2.5 text-xs leading-relaxed text-white/80">
                  {renderFormattedText(section.content)}
                </div>
              </div>
            );
          }

          return (
            <div
              key={idx}
              className="rounded-2xl border border-white/10 bg-black/40 p-4 text-xs leading-relaxed text-white/80"
            >
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                {section.title}
              </h4>
              <div>{renderFormattedText(section.content)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CropDoctorAdvisoryCard;
