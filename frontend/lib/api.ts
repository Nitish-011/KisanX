import { createClient } from "./supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_KISANX_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorBody.detail || `API Request failed with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const KisanXAPI = {
  // System
  health: () => apiFetch<{ status: string; service: string }>("/health"),

  // Auth
  registerUser: (payload: any) => apiFetch<any>("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  getUserProfile: () => apiFetch<any>("/api/auth/profile", { method: "POST" }),

  // Farms
  listFarms: () => apiFetch<{ success: boolean; count: number; farms: any[] }>("/api/farms"),
  registerFarm: (payload: any) => apiFetch<any>("/api/farms/register", { method: "POST", body: JSON.stringify(payload) }),
  getFarm: (farmId: string) => apiFetch<any>(`/api/farms/${farmId}`),

  // Diagnoses
  createDiagnosis: (formData: FormData) => apiFetch<any>("/api/diagnoses", { method: "POST", body: formData }),
  listDiagnoses: (cropCycleId?: string) => apiFetch<any>(`/api/diagnoses${cropCycleId ? `?crop_cycle_id=${cropCycleId}` : ""}`),
  getDiagnosis: (id: string) => apiFetch<any>(`/api/diagnoses/${id}`),

  // Traps
  logTrapCount: (formData: FormData) => apiFetch<any>("/api/trap-counts", { method: "POST", body: formData }),
  getTrapHistory: (cropCycleId: string) => apiFetch<any>(`/api/trap-counts/${cropCycleId}`),

  // Risk Scores
  getRiskScore: (cropCycleId: string) => apiFetch<any>(`/api/risk-score/${cropCycleId}`),

  // Hotspots
  getHotspots: (params: string = "days=30") => apiFetch<any>(`/api/hotspots?${params}`),
  reportHotspot: (payload: any) => apiFetch<any>("/api/hotspot-reports", { method: "POST", body: JSON.stringify(payload) }),

  // Scans
  createScan: (formData: FormData) => apiFetch<any>("/api/scans/create", { method: "POST", body: formData }),

  // RAG & Assistant
  askRag: (payload: any) => apiFetch<any>("/api/rag/ask", { method: "POST", body: JSON.stringify(payload) }),
  assistantChat: (payload: any) => apiFetch<any>("/api/assistant", { method: "POST", body: JSON.stringify(payload) }),
  assistantCropIntuition: (payload: any) => apiFetch<any>("/api/assistant/crop-intuition", { method: "POST", body: JSON.stringify(payload) }),

  // Farm Intelligence
  getFarmContext: (farmId: string) => apiFetch<any>(`/api/farm-intelligence/${farmId}/context`),
  getFarmScans: (farmId: string) => apiFetch<any>(`/api/farm-intelligence/${farmId}/scans`),
  getFarmMessages: (farmId: string) => apiFetch<any>(`/api/farm-intelligence/${farmId}/messages`),

  // Weather
  getWeather: (lat: number, lon: number) => apiFetch<any>(`/api/weather?lat=${lat}&lon=${lon}`),

  // Mandi & Marketplace
  getMandiListings: (sort: string = "quality") => apiFetch<any>(`/api/market/listings?sort=${sort}`),
  getMandiListing: (listingId: string) => apiFetch<any>(`/api/market/listings/${listingId}`),
  updateMandiListing: (listingId: string, payload: any) => apiFetch<any>(`/api/market/listings/${listingId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  createMandiListing: (payload: any) => apiFetch<any>("/api/market/listings", { method: "POST", body: JSON.stringify(payload) }),
  createMandiOrder: (payload: any) => apiFetch<any>("/api/market/orders", { method: "POST", body: JSON.stringify(payload) }),
  
  // Marketplace (Legacy/Extended)
  listMarketplace: (payload: any) => apiFetch<any>("/api/marketplace/list", { method: "POST", body: JSON.stringify(payload) }),
  getMarketplaceListings: () => apiFetch<any>("/api/marketplace/listings"),
  getFarmerListings: () => apiFetch<any>("/api/marketplace/farmer-listings"),
  getInspectorQueue: () => apiFetch<any>("/api/marketplace/inspector-queue"),
  getSellShopThreads: () => apiFetch<any>("/api/marketplace/sell-shop/threads"),
  getSellShopMessages: (threadId: string) => apiFetch<any>(`/api/marketplace/sell-shop/messages?thread_id=${threadId}`),
  negotiateTrade: (payload: any) => apiFetch<any>("/api/marketplace/negotiate", { method: "POST", body: JSON.stringify(payload) }),
  analyzeHarvest: (formData: FormData) => apiFetch<any>("/api/marketplace/analyze-harvest", { method: "POST", body: formData }),
  sendTradeMessage: (payload: any) => apiFetch<any>("/api/marketplace/sell-shop/send", { method: "POST", body: JSON.stringify(payload) }),
  certifyListing: (payload: any) => apiFetch<any>("/api/marketplace/certify", { method: "POST", body: JSON.stringify(payload) }),

  // Inputs
  listInputProducts: (category?: string) => apiFetch<any>(`/api/inputs/products${category ? `?category=${category}` : ""}`),
  getProductSellers: (productId: string) => apiFetch<any>(`/api/inputs/products/${productId}/sellers`),
  registerSeller: (payload: any) => apiFetch<any>("/api/inputs/sellers", { method: "POST", body: JSON.stringify(payload) }),

  // Agronomists
  listAgronomists: (specialisation?: string) => apiFetch<any>(`/api/agronomists${specialisation ? `?specialisation=${encodeURIComponent(specialisation)}` : ""}`),
  bookConsultation: (payload: any) => apiFetch<any>("/api/consultations", { method: "POST", body: JSON.stringify(payload) }),
  getConsultation: (sessionId: string) => apiFetch<any>(`/api/consultations/${sessionId}`),

  // Feedback
  submitFeedback: (payload: any) => apiFetch<any>("/api/feedback", { method: "POST", body: JSON.stringify(payload) }),
  getFeedback: (diagnosisId: string) => apiFetch<any>(`/api/feedback/${diagnosisId}`),
};
