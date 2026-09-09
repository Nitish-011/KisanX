-- ====================================================================
-- KISANX SUPABASE MASTER DATABASE SCHEMA & RLS POLICIES
-- ====================================================================
-- Run this complete script in your Supabase Project:
-- Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run (Ctrl+Enter)
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. Define Custom Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('FARMER', 'BUYER', 'OFFICER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE crop_cycle_status AS ENUM ('ACTIVE', 'COMPLETED', 'TERMINATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE inspector_decision AS ENUM ('PENDING_INSPECTION', 'CERTIFIED_GRADE_A', 'QUARANTINED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- ====================================================================
-- 3. PROFILES TABLE (Solves Row-Level Security Policy Violation)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT DEFAULT 'FARMER' CHECK (role IN ('FARMER', 'BUYER', 'OFFICER')),
    phone TEXT,
    organization TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Clean up any legacy conflicting policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow service role full access" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.profiles;

-- RLS Policy: Authenticated users can view profiles
CREATE POLICY "Authenticated users can view profiles"
    ON public.profiles FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- RLS Policy: Authenticated users can insert their own profile
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- RLS Policy: Authenticated users can update their own profile
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);


-- ====================================================================
-- 4. AUTOMATIC NEW USER TRIGGER (Bypasses RLS Safely with SECURITY DEFINER)
-- ====================================================================
-- This trigger automatically creates the profile row whenever a user signs up,
-- even if email confirmation is enabled or if client-side RLS is strict.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    user_full_name TEXT;
    user_role_val TEXT;
    allowed_signup_role TEXT;
BEGIN
    user_full_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
    );

    -- Read requested role from signup metadata
    user_role_val := COALESCE(
        new.raw_user_meta_data->>'role',
        'FARMER'
    );

    -- SECURITY: Only allow FARMER and BUYER on self-signup.
    -- OFFICER accounts must be provisioned by an administrator.
    IF UPPER(user_role_val) IN ('FARMER', 'BUYER') THEN
        allowed_signup_role := UPPER(user_role_val);
    ELSE
        allowed_signup_role := 'FARMER';
    END IF;

    INSERT INTO public.profiles (id, full_name, role, created_at, updated_at)
    VALUES (
        new.id,
        user_full_name,
        allowed_signup_role,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
        full_name = EXCLUDED.full_name,
        -- Do NOT update role on conflict — preserve admin-assigned roles
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ====================================================================
-- 5. FARMS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.farms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    village TEXT,
    district TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    area_acres NUMERIC(8,2) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure owner_id column exists if table was created in an older schema
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

-- Clean up any legacy or duplicate policies
DROP POLICY IF EXISTS "Users can view their own farms" ON public.farms;
DROP POLICY IF EXISTS "Users can insert their own farms" ON public.farms;
DROP POLICY IF EXISTS "Users can update their own farms" ON public.farms;
DROP POLICY IF EXISTS "Farmers can view their own farms" ON public.farms;
DROP POLICY IF EXISTS "Farmers can insert their own farms" ON public.farms;
DROP POLICY IF EXISTS "Farmers can update their own farms" ON public.farms;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.farms;

CREATE POLICY "Farmers can view their own farms"
    ON public.farms FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Farmers can insert their own farms"
    ON public.farms FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Farmers can update their own farms"
    ON public.farms FOR UPDATE
    USING (auth.uid() = owner_id);


-- ====================================================================
-- 6. PLOTS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.plots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    area_acres NUMERIC(8,2) NOT NULL DEFAULT 1.0,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    boundary JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure owner_id column exists if table was created in an older schema
ALTER TABLE public.plots ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.plots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage plots" ON public.plots;
DROP POLICY IF EXISTS "Farmers can view their plots" ON public.plots;
DROP POLICY IF EXISTS "Farmers can insert their plots" ON public.plots;
DROP POLICY IF EXISTS "Farmers can update their plots" ON public.plots;

CREATE POLICY "Farmers can view their plots"
    ON public.plots FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Farmers can insert their plots"
    ON public.plots FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Farmers can update their plots"
    ON public.plots FOR UPDATE
    USING (auth.uid() = owner_id);


-- ====================================================================
-- 7. CROP CYCLES TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.crop_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    crop_name TEXT NOT NULL,
    variety TEXT,
    crop_stage TEXT,
    planting_date DATE,
    soil_type TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure owner_id column exists if table was created in an older schema
ALTER TABLE public.crop_cycles ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.crop_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage crop cycles" ON public.crop_cycles;
DROP POLICY IF EXISTS "Farmers can view their crop cycles" ON public.crop_cycles;
DROP POLICY IF EXISTS "Farmers can insert their crop cycles" ON public.crop_cycles;
DROP POLICY IF EXISTS "Farmers can update their crop cycles" ON public.crop_cycles;

CREATE POLICY "Farmers can view their crop cycles"
    ON public.crop_cycles FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Farmers can insert their crop cycles"
    ON public.crop_cycles FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Farmers can update their crop cycles"
    ON public.crop_cycles FOR UPDATE
    USING (auth.uid() = owner_id);


-- ====================================================================
-- 8. CROP SCANS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.crop_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES public.farms(id) ON DELETE SET NULL,
    plot_id UUID REFERENCES public.plots(id) ON DELETE SET NULL,
    crop_cycle_id UUID REFERENCES public.crop_cycles(id) ON DELETE SET NULL,
    crop_name TEXT NOT NULL,
    disease_predicted TEXT,
    confidence NUMERIC(5,4),
    severity_level TEXT,
    severity_score NUMERIC(5,2),
    image_url TEXT,
    analysis_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.crop_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view crop scans" ON public.crop_scans;
DROP POLICY IF EXISTS "Users can insert crop scans" ON public.crop_scans;
DROP POLICY IF EXISTS "Scans are viewable by farm owners" ON public.crop_scans;
DROP POLICY IF EXISTS "Allow scan creation" ON public.crop_scans;

CREATE POLICY "Scans are viewable by scan owners"
    ON public.crop_scans FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.farms
            WHERE farms.id = crop_scans.farm_id
            AND farms.owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.crop_cycles
            WHERE crop_cycles.id = crop_scans.crop_cycle_id
            AND crop_cycles.owner_id = auth.uid()
        )
    );

CREATE POLICY "Authenticated users can create scans"
    ON public.crop_scans FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);


-- ====================================================================
-- 9. KNOWLEDGE DOCUMENTS (ICAR / CICR RAG Vector Store)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    crop TEXT NOT NULL,
    disease TEXT,
    content TEXT NOT NULL,
    source_name TEXT,
    source_url TEXT,
    language TEXT DEFAULT 'en',
    metadata JSONB,
    category TEXT,
    embedding vector(384),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure all required columns exist even if table pre-existed in older schema
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS source_name TEXT;
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS disease TEXT;
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Knowledge base is readable by all" ON public.knowledge_documents;
CREATE POLICY "Knowledge base is readable by all"
    ON public.knowledge_documents FOR SELECT
    USING (true);

-- Drop any previous function overload to avoid return-type conflict (ERROR: 42P13)
DROP FUNCTION IF EXISTS match_knowledge_documents(vector, double precision, integer, text, text);
DROP FUNCTION IF EXISTS match_knowledge_documents(vector(384), float, int, text, text);
DROP FUNCTION IF EXISTS match_knowledge_documents;

-- Cosine distance match function for RAG retrieval
-- Defaults match Python rag_service: match_count=5, filter_crop=null, filter_disease=null, match_threshold=0.0
CREATE OR REPLACE FUNCTION match_knowledge_documents (
    query_embedding vector(384),
    match_count int DEFAULT 5,
    filter_crop text DEFAULT null,
    filter_disease text DEFAULT null,
    match_threshold float DEFAULT 0.0
)
RETURNS TABLE (
    id text,
    title text,
    crop text,
    disease text,
    content text,
    source_name text,
    source_url text,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        kd.id::text AS id,
        kd.title,
        kd.crop,
        kd.disease,
        kd.content,
        kd.source_name,
        kd.source_url,
        (1 - (kd.embedding <=> query_embedding))::float AS similarity
    FROM public.knowledge_documents kd
    WHERE (1 - (kd.embedding <=> query_embedding)) >= match_threshold
      AND (filter_crop IS NULL OR LOWER(kd.crop) = LOWER(filter_crop))
      AND (filter_disease IS NULL OR LOWER(kd.disease) = LOWER(filter_disease) OR kd.disease IS NULL)
    ORDER BY kd.embedding <=> query_embedding
    LIMIT match_count;
$$;


-- ====================================================================
-- 10. MARKETPLACE & APMC MANDI TRADE TABLES
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
    id TEXT PRIMARY KEY,
    farmer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    farmer_name TEXT NOT NULL,
    farm_name TEXT NOT NULL,
    village TEXT,
    district TEXT,
    latitude DOUBLE PRECISION DEFAULT 18.5204,
    longitude DOUBLE PRECISION DEFAULT 73.8567,
    crop_name TEXT NOT NULL,
    variety TEXT,
    farm_area_acres NUMERIC(8,2) NOT NULL DEFAULT 1.0,
    health_percentage NUMERIC(5,2) NOT NULL DEFAULT 90.0,
    quality_grade TEXT NOT NULL DEFAULT 'Grade A (Premium)',
    estimated_weight_quintals NUMERIC(10,2) NOT NULL,
    price_per_quintal INT NOT NULL,
    total_valuation BIGINT NOT NULL,
    media_type TEXT DEFAULT 'video',
    video_preview TEXT,
    yolo_detection_summary TEXT,
    gemma_appraisal_summary TEXT,
    inspector_status TEXT DEFAULT 'PENDING_INSPECTION',
    certified_by TEXT,
    certification_timestamp TEXT,
    inspector_notes TEXT,
    encryption_fingerprint TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active marketplace listings" ON public.marketplace_listings;
CREATE POLICY "Public can view active marketplace listings"
    ON public.marketplace_listings FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can create listings" ON public.marketplace_listings;
CREATE POLICY "Authenticated users can create listings"
    ON public.marketplace_listings FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Farmers and officers can update listings" ON public.marketplace_listings;
CREATE POLICY "Listing owners and officers can update"
    ON public.marketplace_listings FOR UPDATE
    USING (
        farmer_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'OFFICER'
        )
    );

-- TRADE NEGOTIATIONS (Encrypted Chat & Offers)
CREATE TABLE IF NOT EXISTS public.trade_negotiations (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_role TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    proposed_price INT,
    message TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    status TEXT DEFAULT 'NEGOTIATING',
    encryption_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.trade_negotiations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parties can view negotiations" ON public.trade_negotiations;
CREATE POLICY "Negotiation participants can view"
    ON public.trade_negotiations FOR SELECT
    USING (
        sender_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.marketplace_listings ml
            WHERE ml.id = trade_negotiations.listing_id
            AND ml.farmer_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated users can propose terms" ON public.trade_negotiations;
CREATE POLICY "Authenticated users can negotiate"
    ON public.trade_negotiations FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND sender_id = auth.uid());

-- PERFORMANCE INDEXES FOR TRADE & SELL SHOP
CREATE INDEX IF NOT EXISTS idx_marketplace_farmer_id ON public.marketplace_listings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_crop_status ON public.marketplace_listings(crop_name, inspector_status);
CREATE INDEX IF NOT EXISTS idx_marketplace_created_at ON public.marketplace_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_neg_listing_id ON public.trade_negotiations(listing_id);
CREATE INDEX IF NOT EXISTS idx_trade_neg_created_at ON public.trade_negotiations(created_at ASC);


-- ====================================================================
-- 10b. ORDERS TABLE (Marketplace Orders)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_type TEXT NOT NULL DEFAULT 'crop' CHECK (order_type IN ('crop', 'input')),
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    listing_id TEXT NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
    total_price NUMERIC(12,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers and sellers can view their orders" ON public.orders;
CREATE POLICY "Buyers and sellers can view their orders"
    ON public.orders FOR SELECT
    USING (
        buyer_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.marketplace_listings ml
            WHERE ml.id = orders.listing_id
            AND ml.farmer_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated buyers can create orders" ON public.orders;
CREATE POLICY "Authenticated buyers can create orders"
    ON public.orders FOR INSERT
    WITH CHECK (auth.uid() = buyer_id);

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_listing ON public.orders(listing_id);


-- ====================================================================
-- 11. CROP INTUITIONS TABLE (AI Proactive Health & Weather Pulses)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.crop_intuitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    crop_name TEXT NOT NULL,
    health_score NUMERIC(5,2) NOT NULL,
    health_status TEXT NOT NULL,
    intuition_summary TEXT NOT NULL,
    language TEXT DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.crop_intuitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own crop intuitions" ON public.crop_intuitions;
CREATE POLICY "Users can view own crop intuitions"
    ON public.crop_intuitions FOR SELECT
    USING (auth.uid() = owner_id OR owner_id IS NULL);

DROP POLICY IF EXISTS "Allow insertion of crop intuitions" ON public.crop_intuitions;
CREATE POLICY "Allow insertion of crop intuitions"
    ON public.crop_intuitions FOR INSERT
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_crop_intuitions_owner ON public.crop_intuitions(owner_id, created_at DESC);


-- ====================================================================
-- 12. CROPGUARD USP TABLES (Diagnoses, Traps, Inputs, Agronomists, etc.)
-- ====================================================================

-- 12.1 DIAGNOSES (USP 1 — Disease Progression Timeline)
CREATE TABLE IF NOT EXISTS public.diagnoses (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    crop_cycle_id   UUID REFERENCES public.crop_cycles(id) ON DELETE SET NULL,
    scan_id         UUID REFERENCES public.crop_scans(id) ON DELETE SET NULL,
    photo_url       TEXT NOT NULL,
    disease         TEXT NOT NULL,
    severity_stage  INTEGER CHECK (severity_stage BETWEEN 1 AND 4),
    confidence      FLOAT,
    status          TEXT NOT NULL DEFAULT 'auto' CHECK (status IN ('auto', 'expert_reviewed')),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Diagnoses viewable by owner" ON public.diagnoses;
CREATE POLICY "Diagnoses viewable by owner" ON public.diagnoses FOR SELECT USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Diagnoses insertable by owner" ON public.diagnoses;
CREATE POLICY "Diagnoses insertable by owner" ON public.diagnoses FOR INSERT WITH CHECK (auth.uid() = owner_id);


-- 12.2 PRESCRIPTIONS (USP 5 — Advisory & Treatment Steps)
CREATE TABLE IF NOT EXISTS public.prescriptions (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    diagnosis_id            UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
    treatment_steps         JSONB NOT NULL DEFAULT '[]',
    phi_days                INTEGER,
    resistance_flag         BOOLEAN DEFAULT FALSE,
    cost_estimate           FLOAT,
    expected_recovery_pct   FLOAT,
    recheck_date            DATE,
    created_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Prescriptions viewable by diagnosis owner" ON public.prescriptions;
CREATE POLICY "Prescriptions viewable by diagnosis owner" ON public.prescriptions FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.diagnoses d WHERE d.id = prescriptions.diagnosis_id AND d.owner_id = auth.uid()));
DROP POLICY IF EXISTS "Prescriptions insertable by authenticated" ON public.prescriptions;
CREATE POLICY "Prescriptions insertable by authenticated" ON public.prescriptions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- 12.3 TRAP COUNTS (USP 2 — Trap Photo Counter + ETL Monitoring)
CREATE TABLE IF NOT EXISTS public.trap_counts (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    crop_cycle_id   UUID REFERENCES public.crop_cycles(id) ON DELETE SET NULL,
    photo_url       TEXT NOT NULL,
    pest_species    TEXT NOT NULL,
    count           INTEGER NOT NULL DEFAULT 0,
    etl_threshold   INTEGER NOT NULL,
    action_needed   BOOLEAN NOT NULL DEFAULT FALSE,
    resistance_flag BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trap_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Trap counts viewable by owner" ON public.trap_counts;
CREATE POLICY "Trap counts viewable by owner" ON public.trap_counts FOR SELECT USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Trap counts insertable by owner" ON public.trap_counts;
CREATE POLICY "Trap counts insertable by owner" ON public.trap_counts FOR INSERT WITH CHECK (auth.uid() = owner_id);


-- 12.4 RISK SCORES (USP 3 — Epidemiological Forecasting)
CREATE TABLE IF NOT EXISTS public.risk_scores (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    crop_cycle_id   UUID NOT NULL REFERENCES public.crop_cycles(id) ON DELETE CASCADE,
    score_date      DATE NOT NULL,
    score           INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    color_code      TEXT NOT NULL DEFAULT 'green' CHECK (color_code IN ('green', 'yellow', 'orange', 'red')),
    factors         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (crop_cycle_id, score_date)
);

ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Risk scores viewable by crop owner" ON public.risk_scores;
CREATE POLICY "Risk scores viewable by crop owner" ON public.risk_scores FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.crop_cycles c WHERE c.id = risk_scores.crop_cycle_id AND c.owner_id = auth.uid()));


-- 12.5 HOTSPOT REPORTS (USP 4 — Regional Outbreak Tracking)
CREATE TABLE IF NOT EXISTS public.hotspot_reports (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    diagnosis_id    UUID REFERENCES public.diagnoses(id) ON DELETE SET NULL,
    owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    latitude        FLOAT NOT NULL,
    longitude       FLOAT NOT NULL,
    disease         TEXT NOT NULL,
    confirmed_by    TEXT NOT NULL DEFAULT 'farmer' CHECK (confirmed_by IN ('farmer', 'expert')),
    district        TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.hotspot_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Hotspots viewable by authenticated" ON public.hotspot_reports;
CREATE POLICY "Hotspots viewable by authenticated" ON public.hotspot_reports FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Hotspots insertable by owner" ON public.hotspot_reports;
CREATE POLICY "Hotspots insertable by owner" ON public.hotspot_reports FOR INSERT WITH CHECK (auth.uid() = owner_id);


-- 12.6 MARKET LISTINGS (Legacy & Extended Mandi Lots)
CREATE TABLE IF NOT EXISTS public.market_listings (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    farmer_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    crop_type       TEXT NOT NULL,
    variety         TEXT,
    grade           TEXT,
    quantity        FLOAT NOT NULL,
    unit            TEXT NOT NULL DEFAULT 'quintal',
    asking_price    FLOAT NOT NULL,
    quality_score   INTEGER CHECK (quality_score BETWEEN 0 AND 100),
    latitude        FLOAT,
    longitude       FLOAT,
    district        TEXT,
    harvest_date    DATE,
    photos          JSONB DEFAULT '[]',
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'withdrawn', 'expired')),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Market listings viewable by all authenticated" ON public.market_listings;
CREATE POLICY "Market listings viewable by all authenticated" ON public.market_listings FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Market listings insertable by farmer" ON public.market_listings;
CREATE POLICY "Market listings insertable by farmer" ON public.market_listings FOR INSERT WITH CHECK (auth.uid() = farmer_id);


-- 12.7 INPUT MERCHANTS & VERIFIED PRODUCTS (USP 9)
CREATE TABLE IF NOT EXISTS public.sellers (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name                    TEXT NOT NULL,
    license_no              TEXT NOT NULL,
    cib_registration_ref    TEXT,
    verified_status         TEXT NOT NULL DEFAULT 'pending' CHECK (verified_status IN ('pending', 'verified', 'rejected')),
    district                TEXT,
    phone                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sellers viewable by authenticated" ON public.sellers;
CREATE POLICY "Sellers viewable by authenticated" ON public.sellers FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.input_products (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name                    TEXT NOT NULL,
    active_ingredient       TEXT NOT NULL,
    cib_registration_no     TEXT,
    category                TEXT NOT NULL DEFAULT 'pesticide' CHECK (category IN ('pesticide', 'fungicide', 'herbicide', 'other')),
    created_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.input_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Input products viewable by authenticated" ON public.input_products;
CREATE POLICY "Input products viewable by authenticated" ON public.input_products FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.input_listings (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id       UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES public.input_products(id) ON DELETE CASCADE,
    price           FLOAT NOT NULL,
    stock           INTEGER NOT NULL DEFAULT 0,
    unit            TEXT NOT NULL DEFAULT 'unit',
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.input_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Input listings viewable by authenticated" ON public.input_listings;
CREATE POLICY "Input listings viewable by authenticated" ON public.input_listings FOR SELECT USING (auth.uid() IS NOT NULL);


-- 12.8 AGRONOMISTS & CONSULTATIONS (USP 10)
CREATE TABLE IF NOT EXISTS public.agronomists (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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

ALTER TABLE public.agronomists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agronomists viewable by authenticated" ON public.agronomists;
CREATE POLICY "Agronomists viewable by authenticated" ON public.agronomists FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.consultation_sessions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    farmer_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agronomist_id   UUID NOT NULL REFERENCES public.agronomists(id) ON DELETE CASCADE,
    diagnosis_id    UUID REFERENCES public.diagnoses(id) ON DELETE SET NULL,
    channel         TEXT NOT NULL DEFAULT 'chat' CHECK (channel IN ('chat', 'voice', 'video')),
    fee             FLOAT NOT NULL DEFAULT 30.0,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.consultation_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Consultations viewable by participants" ON public.consultation_sessions;
CREATE POLICY "Consultations viewable by participants" ON public.consultation_sessions FOR SELECT
    USING (auth.uid() = farmer_id OR auth.uid() IN (SELECT user_id FROM public.agronomists WHERE id = consultation_sessions.agronomist_id));


-- 12.9 ACTIVE LEARNING FEEDBACK (USP 7)
CREATE TABLE IF NOT EXISTS public.feedback (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    diagnosis_id            UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
    farmer_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    outcome                 TEXT NOT NULL CHECK (outcome IN ('yes', 'no', 'partial')),
    comment                 TEXT,
    flagged_for_retraining  BOOLEAN DEFAULT FALSE,
    created_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Feedback viewable by farmer" ON public.feedback;
CREATE POLICY "Feedback viewable by farmer" ON public.feedback FOR SELECT USING (auth.uid() = farmer_id);
DROP POLICY IF EXISTS "Feedback insertable by farmer" ON public.feedback;
CREATE POLICY "Feedback insertable by farmer" ON public.feedback FOR INSERT WITH CHECK (auth.uid() = farmer_id);


-- 12.10 INDEXES
CREATE INDEX IF NOT EXISTS idx_diagnoses_owner ON public.diagnoses(owner_id);
CREATE INDEX IF NOT EXISTS idx_trap_counts_cycle ON public.trap_counts(crop_cycle_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_cycle ON public.risk_scores(crop_cycle_id, score_date);
CREATE INDEX IF NOT EXISTS idx_hotspot_reports_geo ON public.hotspot_reports(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_market_listings_status ON public.market_listings(status, crop_type);
CREATE INDEX IF NOT EXISTS idx_input_listings_prod ON public.input_listings(product_id);
CREATE INDEX IF NOT EXISTS idx_agronomists_spec ON public.agronomists(specialisation);


-- ====================================================================
-- 13. SUCCESS CONFIRMATION
-- ====================================================================
SELECT 'KisanX + CropGuard complete database schema configured successfully!' AS status;


