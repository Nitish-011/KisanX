-- ============================================================
-- KisanX / CropGuard — DESTRUCTIVE DEVELOPMENT RESET SCRIPT
-- File: dangerous_dev_reset.sql (formerly 001_create_tables.sql)
--
-- ⚠️  DANGER: THIS SCRIPT DROPS ALL EXISTING TABLES ⚠️
--
-- Running this against a populated database WILL DELETE ALL DATA.
-- This is a DEVELOPMENT RESET script only.
--
-- For production / staging, use the canonical schema or incremental migrations:
--   1. Root canonical baseline: supabase_schema.sql
--   2. Safe incremental RLS hardening: 002_rls_security_hardening.sql
--
-- Drops all existing tables and recreates both the original
-- KisanX core tables AND the new CropGuard USP tables.
-- ============================================================

-- ============================================================
-- 0. CLEANUP (DROP ALL EXISTING TABLES)
-- ============================================================
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS consultation_sessions CASCADE;
DROP TABLE IF EXISTS agronomists CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS input_listings CASCADE;
DROP TABLE IF EXISTS input_products CASCADE;
DROP TABLE IF EXISTS sellers CASCADE;
DROP TABLE IF EXISTS market_listings CASCADE;
DROP TABLE IF EXISTS hotspot_reports CASCADE;
DROP TABLE IF EXISTS risk_scores CASCADE;
DROP TABLE IF EXISTS trap_counts CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS diagnoses CASCADE;

-- Old Core Tables
DROP TABLE IF EXISTS assistant_messages CASCADE;
DROP TABLE IF EXISTS farm_context_entries CASCADE;
DROP TABLE IF EXISTS crop_scans CASCADE;
DROP TABLE IF EXISTS crop_cycles CASCADE;
DROP TABLE IF EXISTS plots CASCADE;
DROP TABLE IF EXISTS farms CASCADE;


-- ============================================================
-- SECTION A: CORE KISANX TABLES (Originals)
-- ============================================================

-- 1. FARMS
CREATE TABLE IF NOT EXISTS farms (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id        UUID NOT NULL REFERENCES auth.users(id),
    name            TEXT NOT NULL,
    village         TEXT,
    district        TEXT,
    latitude        FLOAT,
    longitude       FLOAT,
    area_acres      FLOAT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. PLOTS
CREATE TABLE IF NOT EXISTS plots (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    owner_id        UUID NOT NULL REFERENCES auth.users(id),
    name            TEXT NOT NULL,
    area_acres      FLOAT NOT NULL,
    latitude        FLOAT,
    longitude       FLOAT,
    boundary        JSONB,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 3. CROP CYCLES
CREATE TABLE IF NOT EXISTS crop_cycles (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plot_id         UUID NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
    owner_id        UUID NOT NULL REFERENCES auth.users(id),
    crop_name       TEXT NOT NULL,
    variety         TEXT,
    crop_stage      TEXT,
    planting_date   DATE,
    soil_type       TEXT,
    status          TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 4. CROP SCANS (Legacy)
CREATE TABLE IF NOT EXISTS crop_scans (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id        UUID NOT NULL REFERENCES auth.users(id),
    farm_id         UUID REFERENCES farms(id) ON DELETE CASCADE,
    plot_id         UUID REFERENCES plots(id) ON DELETE CASCADE,
    crop_cycle_id   UUID REFERENCES crop_cycles(id) ON DELETE CASCADE,
    image_url       TEXT NOT NULL,
    disease         TEXT,
    confidence      FLOAT,
    severity        INTEGER,
    latitude        FLOAT,
    longitude       FLOAT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 5. FARM CONTEXT ENTRIES
CREATE TABLE IF NOT EXISTS farm_context_entries (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id        UUID NOT NULL REFERENCES auth.users(id),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    plot_id         UUID REFERENCES plots(id) ON DELETE CASCADE,
    crop_cycle_id   UUID REFERENCES crop_cycles(id) ON DELETE CASCADE,
    category        TEXT NOT NULL,
    key             TEXT NOT NULL,
    value_text      TEXT,
    value_number    FLOAT,
    value_json      JSONB,
    source_type     TEXT,
    confidence      FLOAT,
    language        TEXT,
    recorded_at     TIMESTAMPTZ DEFAULT now(),
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- 6. ASSISTANT MESSAGES
CREATE TABLE IF NOT EXISTS assistant_messages (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id        UUID NOT NULL REFERENCES auth.users(id),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    plot_id         UUID REFERENCES plots(id) ON DELETE CASCADE,
    crop_cycle_id   UUID REFERENCES crop_cycles(id) ON DELETE CASCADE,
    scan_id         UUID REFERENCES crop_scans(id) ON DELETE SET NULL,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    language        TEXT DEFAULT 'en',
    created_at      TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- SECTION B: NEW CROPGUARD USP TABLES
-- ============================================================

-- 1. DIAGNOSES  (USP 1 — Disease Progression Timeline)
CREATE TABLE IF NOT EXISTS diagnoses (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id        UUID NOT NULL REFERENCES auth.users(id),
    crop_cycle_id   UUID REFERENCES crop_cycles(id) ON DELETE SET NULL,
    scan_id         UUID REFERENCES crop_scans(id) ON DELETE SET NULL,
    photo_url       TEXT NOT NULL,
    disease         TEXT NOT NULL,
    severity_stage  INTEGER CHECK (severity_stage BETWEEN 1 AND 4),
    confidence      FLOAT,
    status          TEXT NOT NULL DEFAULT 'auto'
                        CHECK (status IN ('auto', 'expert_reviewed')),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);


-- 2. PRESCRIPTIONS  (USP 5 — Prescription-Style Advisory)
CREATE TABLE IF NOT EXISTS prescriptions (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    diagnosis_id            UUID NOT NULL REFERENCES diagnoses(id) ON DELETE CASCADE,
    treatment_steps         JSONB NOT NULL DEFAULT '[]',
    phi_days                INTEGER,
    resistance_flag         BOOLEAN DEFAULT FALSE,
    cost_estimate           FLOAT,
    expected_recovery_pct   FLOAT,
    recheck_date            DATE,
    created_at              TIMESTAMPTZ DEFAULT now()
);


-- 3. TRAP COUNTS  (USP 2 — Trap Photo Counter + ETL)
CREATE TABLE IF NOT EXISTS trap_counts (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id        UUID NOT NULL REFERENCES auth.users(id),
    crop_cycle_id   UUID REFERENCES crop_cycles(id) ON DELETE SET NULL,
    photo_url       TEXT NOT NULL,
    pest_species    TEXT NOT NULL,
    count           INTEGER NOT NULL DEFAULT 0,
    etl_threshold   INTEGER NOT NULL,
    action_needed   BOOLEAN NOT NULL DEFAULT FALSE,
    resistance_flag BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT now()
);


-- 4. RISK SCORES  (USP 3 — Epidemiological Risk Forecasting)
CREATE TABLE IF NOT EXISTS risk_scores (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    crop_cycle_id   UUID NOT NULL REFERENCES crop_cycles(id) ON DELETE CASCADE,
    score_date      DATE NOT NULL,
    score           INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    color_code      TEXT NOT NULL DEFAULT 'green'
                        CHECK (color_code IN ('green', 'yellow', 'orange', 'red')),
    factors         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now(),

    UNIQUE (crop_cycle_id, score_date)
);


-- 5. HOTSPOT REPORTS  (USP 4 — Pest Migration Corridors)
CREATE TABLE IF NOT EXISTS hotspot_reports (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    diagnosis_id    UUID REFERENCES diagnoses(id) ON DELETE SET NULL,
    owner_id        UUID NOT NULL REFERENCES auth.users(id),
    latitude        FLOAT NOT NULL,
    longitude       FLOAT NOT NULL,
    disease         TEXT NOT NULL,
    confirmed_by    TEXT NOT NULL DEFAULT 'farmer'
                        CHECK (confirmed_by IN ('farmer', 'expert')),
    created_at      TIMESTAMPTZ DEFAULT now()
);


-- 6. MARKET LISTINGS  (USP 8 — CropGuard Mandi)
CREATE TABLE IF NOT EXISTS market_listings (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    farmer_id       UUID NOT NULL REFERENCES auth.users(id),
    crop_type       TEXT NOT NULL,
    variety         TEXT,
    grade           TEXT,
    quantity         FLOAT NOT NULL,
    unit            TEXT NOT NULL DEFAULT 'quintal',
    asking_price    FLOAT NOT NULL,
    quality_score   INTEGER CHECK (quality_score BETWEEN 0 AND 100),
    latitude        FLOAT,
    longitude       FLOAT,
    district        TEXT,
    harvest_date    DATE,
    photos          JSONB DEFAULT '[]',
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'sold', 'withdrawn', 'expired')),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);


-- 7. SELLERS  (USP 9 — Verified Input Marketplace)
CREATE TABLE IF NOT EXISTS sellers (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                 UUID REFERENCES auth.users(id),
    name                    TEXT NOT NULL,
    license_no              TEXT NOT NULL,
    cib_registration_ref    TEXT,
    verified_status         TEXT NOT NULL DEFAULT 'pending'
                                CHECK (verified_status IN ('pending', 'verified', 'rejected')),
    district                TEXT,
    phone                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT now()
);


-- 8. INPUT PRODUCTS  (USP 9)
CREATE TABLE IF NOT EXISTS input_products (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name                    TEXT NOT NULL,
    active_ingredient       TEXT NOT NULL,
    cib_registration_no     TEXT,
    category                TEXT NOT NULL DEFAULT 'pesticide'
                                CHECK (category IN ('pesticide', 'fungicide', 'herbicide', 'bio-agent', 'fertiliser', 'other')),
    created_at              TIMESTAMPTZ DEFAULT now()
);


-- 9. INPUT LISTINGS  (USP 9)
CREATE TABLE IF NOT EXISTS input_listings (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id       UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES input_products(id) ON DELETE CASCADE,
    price           FLOAT NOT NULL,
    stock           INTEGER NOT NULL DEFAULT 0,
    unit            TEXT NOT NULL DEFAULT 'unit',
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);


-- 10. ORDERS  (USP 8 + 9 — Marketplace orders, stub)
CREATE TABLE IF NOT EXISTS orders (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_type      TEXT NOT NULL CHECK (order_type IN ('crop', 'input')),
    buyer_id        UUID NOT NULL REFERENCES auth.users(id),
    listing_id      TEXT NOT NULL,
    quantity        FLOAT NOT NULL DEFAULT 1,
    total_price     FLOAT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    payment_status  TEXT NOT NULL DEFAULT 'unpaid'
                        CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);


-- 11. AGRONOMISTS  (USP 10 — Ask-an-Agronomist)
CREATE TABLE IF NOT EXISTS agronomists (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID REFERENCES auth.users(id),
    name            TEXT NOT NULL,
    credentials     TEXT,
    kvk_affiliation TEXT,
    specialisation  TEXT,
    rating          FLOAT DEFAULT 0.0,
    total_sessions  INTEGER DEFAULT 0,
    availability    BOOLEAN DEFAULT TRUE,
    fee_per_session FLOAT DEFAULT 30.0,
    created_at      TIMESTAMPTZ DEFAULT now()
);


-- 12. CONSULTATION SESSIONS  (USP 10)
CREATE TABLE IF NOT EXISTS consultation_sessions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    farmer_id       UUID NOT NULL REFERENCES auth.users(id),
    agronomist_id   UUID NOT NULL REFERENCES agronomists(id) ON DELETE CASCADE,
    diagnosis_id    UUID REFERENCES diagnoses(id) ON DELETE SET NULL,
    channel         TEXT NOT NULL DEFAULT 'chat'
                        CHECK (channel IN ('chat', 'voice', 'video')),
    fee             FLOAT NOT NULL DEFAULT 30.0,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);


-- 13. FEEDBACK  (USP 7 — Active Learning)
CREATE TABLE IF NOT EXISTS feedback (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    diagnosis_id            UUID NOT NULL REFERENCES diagnoses(id) ON DELETE CASCADE,
    farmer_id               UUID NOT NULL REFERENCES auth.users(id),
    outcome                 TEXT NOT NULL CHECK (outcome IN ('yes', 'no', 'partial')),
    comment                 TEXT,
    flagged_for_retraining  BOOLEAN DEFAULT FALSE,
    created_at              TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- INDEXES (performance)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_diagnoses_owner ON diagnoses(owner_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_crop_cycle ON diagnoses(crop_cycle_id);
CREATE INDEX IF NOT EXISTS idx_trap_counts_crop_cycle ON trap_counts(crop_cycle_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_crop_cycle_date ON risk_scores(crop_cycle_id, score_date);
CREATE INDEX IF NOT EXISTS idx_hotspot_reports_disease ON hotspot_reports(disease);
CREATE INDEX IF NOT EXISTS idx_hotspot_reports_geo ON hotspot_reports(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_market_listings_status ON market_listings(status, crop_type);
CREATE INDEX IF NOT EXISTS idx_market_listings_farmer ON market_listings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_input_listings_product ON input_listings(product_id);
CREATE INDEX IF NOT EXISTS idx_consultation_sessions_farmer ON consultation_sessions(farmer_id);
CREATE INDEX IF NOT EXISTS idx_consultation_sessions_agronomist ON consultation_sessions(agronomist_id);
CREATE INDEX IF NOT EXISTS idx_feedback_diagnosis ON feedback(diagnosis_id);
