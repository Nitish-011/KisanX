# Backend Merge Notes — KisanX + CropGuard

This repo now contains **both** backend/ML tracks merged into one FastAPI app:

- `Amiiiii7119/KisanX` — multi-crop routing, cotton YOLO model, RBAC
  marketplace, Sell Shop chat, auth sync, multi-crop RAG.
- `Nitish-011/KisanX` — the CropGuard modules from `CropGuard_Build_Spec.md`.

**Nothing was removed from either side.** Every endpoint from both repos is
registered and reachable.

---

## How the two marketplaces coexist

The marketplace has been unified under `/api/marketplace`:

| File | Prefix | Owner | Purpose |
|---|---|---|---|
| `app/routes/marketplace.py` | `/api/marketplace` | Unified | Harvest analysis, RBAC listings, Sell Shop chat, negotiate, certify, inspector queue, orders |

All market and trade endpoints are centralized under `/api/marketplace`.

---

## Full route table (43 paths)

### From Amit's backend — unchanged behaviour
```
POST   /api/assistant/chat
POST   /api/assistant/crop-intuition
POST   /api/auth/profile
GET    /api/farms
POST   /api/farms/register
GET    /api/farms/{farm_id}
GET    /api/farm-intelligence/{farm_id}/context
POST   /api/farm-intelligence/{farm_id}/context
DELETE /api/farm-intelligence/{farm_id}/context/{context_id}
GET    /api/farm-intelligence/{farm_id}/messages
GET    /api/farm-intelligence/{farm_id}/scans
POST   /api/rag/ask
POST   /api/scans/create
GET    /api/weather/farm/{farm_id}
POST   /api/marketplace/analyze-harvest
POST   /api/marketplace/list
GET    /api/marketplace/listings
GET    /api/marketplace/farmer-listings
GET    /api/marketplace/inspector-queue
GET    /api/marketplace/sell-shop/threads
GET    /api/marketplace/sell-shop/messages
POST   /api/marketplace/sell-shop/send
POST   /api/marketplace/negotiate
POST   /api/marketplace/certify
```

### CropGuard additions — map 1:1 to the spec's API sketch
```
POST   /api/diagnoses                          USP 1  photo -> diagnosis + prescription
GET    /api/diagnoses
GET    /api/diagnoses/{diagnosis_id}
POST   /api/trap-counts                        USP 2  trap photo -> count + ETL verdict
GET    /api/trap-counts/{crop_cycle_id}
GET    /api/risk-score/{crop_cycle_id}         USP 3  5-factor epidemiological risk
POST   /api/hotspot-reports                    USP 4  log confirmed case
GET    /api/hotspots                           USP 4  district map data
GET    /api/market/listings                    USP 8  Mandi
POST   /api/market/listings
GET    /api/market/listings/{listing_id}
PATCH  /api/market/listings/{listing_id}
POST   /api/market/orders
GET    /api/inputs/products                    USP 9  verified inputs
GET    /api/inputs/products/{product_id}/sellers
POST   /api/inputs/sellers
GET    /api/agronomists                        USP 10 expert access
POST   /api/consultations
GET    /api/consultations/{session_id}
PATCH  /api/consultations/{session_id}
POST   /api/feedback                           USP 7  active learning
GET    /api/feedback/{diagnosis_id}
```

Supporting services added: `risk_engine.py`, `etl_calculator.py`,
`quality_score.py`, `dependencies.py` (shared JWT auth), and
`app/sql/dangerous_dev_reset.sql` (dev reset) / `002_rls_security_hardening.sql` (incremental RLS hardening).

---

## Changes made to Amit's code (only where required to run)

Three fixes, all necessary — no feature or logic changes:

1. **Hardcoded Windows paths removed.**
   `sugarcane_model_service.py` had `PROJECT_ROOT = Path(r"D:\KisanX")` and
   `cotton_model_service.py` had an absolute `D:\KisanX\...\best.pt`. Both now
   read from `settings`, resolved relative to the repo root, so the backend
   runs on Linux/macOS/Windows. Override in `.env`:
   ```
   MODEL_DIR=ml/models
   SUGARCANE_MODEL_FILE=mobilenet_v3_large_best.pth
   COTTON_MODEL_PATH=frontend/ml/cotton/runs/yolo26n_seg_clean/weights/best.pt
   ```

2. **`crop_disease_model.py` import fixed.**
   It re-exported `predict_sugarcane_disease`, which does not exist in
   `sugarcane_model_service.py` — so importing the module raised
   `ImportError`. It now re-exports `predict_sugarcane` and keeps
   `predict_sugarcane_disease` as an alias for any older call sites.

3. **Sugarcane model is now lazy-loaded.**
   `crop_disease_model = CropDiseaseModel()` ran at import time and raised
   `FileNotFoundError` when the `.pth` was absent. Since `*.pth` is
   gitignored, a fresh clone could not boot the API *at all* — every route,
   including `/health`, was dead. Loading is deferred to the first
   prediction, so non-ML routes always work. `predict()` is byte-identical;
   the wrapper adds `is_available` / `is_loaded` for health reporting.

`app/config.py` and `app/main.py` were merged rather than overwritten —
Amit's multi-location `env_file` lookup, `server_secret_key` property, app
title and every router registration are preserved.

---

## Running it

```bash
cd backend
pip install -r requirements.txt          # note: requirements.txt is UTF-16
uvicorn app.main:app --reload --port 8000
```

Then apply `backend/app/sql/002_rls_security_hardening.sql` (or `dangerous_dev_reset.sql` for fresh dev reset) in the Supabase SQL editor
for the CropGuard tables. Open http://localhost:8000/docs to see all 43 paths.

Missing model weights are non-fatal: ML endpoints return an error on call,
everything else serves normally.

---

## Not done in this pass

Frontend is left as-is (Amit's version merged in cleanly, no conflicts).
CropGuard screens — trap upload, risk feed, hotspot map, agronomist booking,
input marketplace — still need UI. Backend contracts for all of them are
live, so the frontend work can start immediately.
