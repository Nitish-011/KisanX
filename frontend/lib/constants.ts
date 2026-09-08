export const APP_NAME = "KisanX";

export const APP_TAGLINE =
  "AI-Powered Crop Health, Harvest & Market Intelligence";

export const APP_DESCRIPTION =
  "Detect crop diseases early, predict field risks, verify harvest readiness, estimate yield, and connect with buyers.";

export const NAV_LINKS = [
  {
    label: "Features",
    href: "#features",
  },
  {
    label: "How It Works",
    href: "#how-it-works",
  },
  {
    label: "Crop Health",
    href: "#crop-health",
  },
  {
    label: "Marketplace",
    href: "/marketplace",
  },
];

export const USER_ROLES = [
  "FARMER",
  "BUYER",
  "EXPERT",
  "AGRICULTURE_OFFICIAL",
  "ADMIN",
] as const;

export const SUPPORTED_CROPS = ["Sugarcane", "Cotton"] as const;

export const SUGARCANE_DISEASES = [
  "Healthy",
  "Mosaic",
  "Red Rot",
  "Rust",
  "Yellow Disease",
] as const;
