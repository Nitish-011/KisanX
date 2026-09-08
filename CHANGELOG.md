# KisanX / CropGuard — Change Log & Revert Guide

This file tracks all structural changes and additions made to the project so you can safely revert or understand the timeline if something goes wrong.

## [2026-09-08] Backend Restructure for CropGuard USPs 1–12

### Overview
Transformed the backend from the base KisanX structure to fully support the CropGuard Build Spec (USPs 1–12). No existing logic was broken or removed, but 20 new files were added to support the new features.

### Modified Files (If you need to revert, restore these to their previous state)
1. `backend/app/config.py`
   - **What changed**: Added `model_dir` (replaces hardcoded `D:\KisanX`) and `cors_origins`.
2. `backend/app/services/crop_disease_model.py`
   - **What changed**: Replaced hardcoded `PROJECT_ROOT = Path(r"D:\KisanX")` with `Path(settings.model_dir)`.
3. `backend/app/main.py`
   - **What changed**: Registered 8 new CropGuard routers, updated CORS to use `settings.cors_origin_list`, bumped version to `1.0.0`.
4. `backend/requirements.txt`
   - **What changed**: Appended missing Machine Learning dependencies (`sentence-transformers`, `torch`, `torchvision`, `Pillow`, `scikit-learn`) needed by the computer vision and RAG services.

### New Files Added (If you need to revert, delete these)
- **Config**: `backend/.env`
- **Dependencies**: `backend/app/dependencies.py`
- **Database**: `backend/app/sql/001_create_tables.sql`
- **Schemas**: 
  - `backend/app/schemas/__init__.py`
  - `backend/app/schemas/diagnosis.py`
  - `backend/app/schemas/trap_count.py`
  - `backend/app/schemas/risk_score.py`
  - `backend/app/schemas/hotspot.py`
  - `backend/app/schemas/marketplace.py`
  - `backend/app/schemas/input_market.py`
  - `backend/app/schemas/agronomist.py`
  - `backend/app/schemas/feedback.py`
- **Services**:
  - `backend/app/services/risk_engine.py`
  - `backend/app/services/quality_score.py`
  - `backend/app/services/etl_calculator.py`
- **Routes**:
  - `backend/app/routes/diagnoses.py`
  - `backend/app/routes/trap_counts.py`
  - `backend/app/routes/risk_scores.py`
  - `backend/app/routes/hotspots.py`
  - `backend/app/routes/marketplace.py`
  - `backend/app/routes/input_market.py`
  - `backend/app/routes/agronomist.py`
  - `backend/app/routes/feedback.py`

### Database Changes
- Created `001_create_tables.sql` which **DROPS ALL TABLES** (both the new ones and the existing `farms`, `plots`, `crop_cycles`, `crop_scans`, `farm_context_entries`, `assistant_messages`) and recreates them from scratch with all the new relationships.
- **How to Revert**: If you run the SQL script and want to go back, you will need to re-run your original table creation script (if you had one). Because the script uses `DROP TABLE IF EXISTS ... CASCADE;`, it is a destructive operation for any existing data in your Supabase project.

---

*Note: Add future significant structural changes, library bumps, or refactors above this line so you always have a breadcrumb trail to follow back.*
