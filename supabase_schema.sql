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
    role TEXT DEFAULT 'FARMER',
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

-- RLS Policy: Anyone authenticated can view user profiles
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

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
BEGIN
    user_full_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
    );

    user_role_val := COALESCE(
        new.raw_user_meta_data->>'role',
        'FARMER'
    );

    INSERT INTO public.profiles (id, full_name, role, created_at, updated_at)
    VALUES (
        new.id,
        user_full_name,
        user_role_val,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
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

CREATE POLICY "Scans are viewable by farm owners"
    ON public.crop_scans FOR SELECT
    USING (true);

CREATE POLICY "Allow scan creation"
    ON public.crop_scans FOR INSERT
    WITH CHECK (true);


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
    WITH CHECK (true);

DROP POLICY IF EXISTS "Farmers and officers can update listings" ON public.marketplace_listings;
CREATE POLICY "Farmers and officers can update listings"
    ON public.marketplace_listings FOR UPDATE
    USING (true);

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
CREATE POLICY "Parties can view negotiations"
    ON public.trade_negotiations FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can propose terms" ON public.trade_negotiations;
CREATE POLICY "Authenticated users can propose terms"
    ON public.trade_negotiations FOR INSERT
    WITH CHECK (true);

-- PERFORMANCE INDEXES FOR TRADE & SELL SHOP
CREATE INDEX IF NOT EXISTS idx_marketplace_farmer_id ON public.marketplace_listings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_crop_status ON public.marketplace_listings(crop_name, inspector_status);
CREATE INDEX IF NOT EXISTS idx_marketplace_created_at ON public.marketplace_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_neg_listing_id ON public.trade_negotiations(listing_id);
CREATE INDEX IF NOT EXISTS idx_trade_neg_created_at ON public.trade_negotiations(created_at ASC);


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
-- 12. SUCCESS CONFIRMATION
-- ====================================================================
SELECT 'KisanX database schema, RLS policies, Sell Shop negotiations, and crop_intuitions configured successfully!' AS status;

