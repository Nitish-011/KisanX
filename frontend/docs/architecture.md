# 🌾 KisanX Frontend Architecture & Technical Reference

> For the comprehensive master documentation, refer to [`FRONTEND_MASTER_MANUAL.md`](../../FRONTEND_MASTER_MANUAL.md) in the project root.

---

## Quick Architecture Summary

- **Next.js 16.3.4 (App Router)** with **React 19**
- **Tailwind CSS v4** with Obsidian Dark Glassmorphic Design System (`#030604`)
- **Supabase SSR** (`@supabase/ssr`, `@supabase/supabase-js`) for unified cookie & session handling
- **FastAPI REST Backend** (`http://127.0.0.1:8000`) for Computer Vision & RAG APIs

## Key Routes & Workspaces

1. `/auth` - 1-Click Instant Evaluation (`Farmer`, `Buyer`, `Inspector`), Google OAuth with fail-safe recovery, and Supabase credentials.
2. `/dashboard` - Farmer Command Center: Active acreage, NDVI health score, weather alerts, and AI Crop Intuition Card.
3. `/dashboard/farm/new` - Interactive GPS farm boundary & soil profiling wizard.
4. `/dashboard/scan` - Neural Vision Hub: Isolated Cotton (YOLOv11 segmentation) vs Sugarcane (MobileNetV2 classifier) diagnostics, video yield estimator, and ICAR RAG chemical advisory.
5. `/market` - Unified 3-Persona Agricultural Exchange:
   - **Farmer**: Sell Shop listings and active lot management.
   - **Buyer**: GPS Mandi Radar and 1-on-1 Instagram-style DM trade chat with counter-offers.
   - **Inspector**: Defect queue review and cryptographic SHA-256 Grade A certificate issuance.

## Full Reference
See the root [FRONTEND_MASTER_MANUAL.md](../../FRONTEND_MASTER_MANUAL.md) for complete component breakdowns, API contracts, and deployment specifications.
