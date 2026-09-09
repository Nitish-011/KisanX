import { createClient } from "./supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_KISANX_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_KISANX_API_URL && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn("⚠️ [KisanX-Config] NEXT_PUBLIC_API_URL is missing. Falling back to default: http://127.0.0.1:8000");
}

/**
 * Structured API error with HTTP status code for proper error handling.
 */
export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export interface ApiErrorHandlerOptions {
  onUnauthorized?: () => void;
  onForbidden?: (detail: string) => void;
  onNotFound?: (detail: string) => void;
  onValidationError?: (detail: string) => void;
  onServerError?: (detail: string) => void;
  fallback?: (error: Error) => void;
}

/**
 * Maps structured API errors to user-friendly messages and executes role/status callbacks.
 */
export function handleApiError(
  error: unknown,
  options?: ApiErrorHandlerOptions
): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        options?.onUnauthorized?.();
        return "Session expired or authentication required. Please log in.";
      case 403:
        options?.onForbidden?.(error.detail);
        return error.detail || "You do not have permission to perform this action.";
      case 404:
        options?.onNotFound?.(error.detail);
        return error.detail || "The requested resource was not found.";
      case 422:
        options?.onValidationError?.(error.detail);
        return error.detail || "Invalid input provided. Please verify submitted values.";
      case 503:
        options?.onServerError?.(error.detail);
        return "Service temporarily unavailable. Please try again in a few moments.";
      default:
        if (error.status >= 500) {
          options?.onServerError?.(error.detail);
          return error.detail || "A server error occurred. Please try again later.";
        }
        return error.detail || `Request failed with status ${error.status}`;
    }
  }

  if (error instanceof Error) {
    options?.fallback?.(error);
    return error.message;
  }

  return "An unexpected error occurred.";
}

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
    const detail = errorBody.detail || `API Request failed with status ${res.status}`;
    throw new ApiError(res.status, detail);
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

  // Marketplace (Legacy/Extended)
  listMarketplace: (payload: any) => apiFetch<any>("/api/marketplace/list", { method: "POST", body: JSON.stringify(payload) }),
  getMarketplaceListings: (params?: string) => apiFetch<any>(`/api/marketplace/listings${params ? `?${params}` : ""}`),
  getFarmerListings: () => apiFetch<any>("/api/marketplace/farmer-listings"),
  getInspectorQueue: () => apiFetch<any>("/api/marketplace/inspector-queue"),
  getSellShopThreads: () => apiFetch<any>("/api/marketplace/sell-shop/threads"),
  getSellShopMessages: (listingId: string) => apiFetch<any>(`/api/marketplace/sell-shop/messages?listing_id=${listingId}`),
  negotiateTrade: (payload: any) => apiFetch<any>("/api/marketplace/negotiate", { method: "POST", body: JSON.stringify(payload) }),
  analyzeHarvest: (formData: FormData) => apiFetch<any>("/api/marketplace/analyze-harvest", { method: "POST", body: formData }),
  sendTradeMessage: (payload: any) => apiFetch<any>("/api/marketplace/sell-shop/send", { method: "POST", body: JSON.stringify(payload) }),
  certifyListing: (payload: any) => apiFetch<any>("/api/marketplace/certify", { method: "POST", body: JSON.stringify(payload) }),
  createMarketplaceOrder: (payload: any) => apiFetch<any>("/api/marketplace/orders", { method: "POST", body: JSON.stringify(payload) }),

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
