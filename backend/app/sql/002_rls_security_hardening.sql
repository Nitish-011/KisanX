-- ============================================================
-- KisanX RLS Security Hardening Migration
-- ============================================================
-- This is an INCREMENTAL migration. Run in Supabase SQL Editor.
-- It does NOT drop/recreate tables. It only fixes RLS policies
-- and adds missing constraints.
-- ============================================================


-- ============================================================
-- 1. FIX PROFILES RLS: Restrict to authenticated users only
-- ============================================================

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Only authenticated users can view profiles (not anonymous/public)
CREATE POLICY "Authenticated users can view profiles"
    ON public.profiles FOR SELECT
    USING (auth.uid() IS NOT NULL);


-- ============================================================
-- 2. FIX CROP SCANS RLS: Owner-based check
-- ============================================================

DROP POLICY IF EXISTS "Scans are viewable by farm owners" ON public.crop_scans;

-- Restrict crop scan reads to the scan owner (via farm ownership chain)
-- Since crop_scans may not have an owner_id, we check via farm_id
CREATE POLICY "Scans are viewable by scan owners"
    ON public.crop_scans FOR SELECT
    USING (
        (crop_scans.owner_id IS NOT NULL AND auth.uid()::text = crop_scans.owner_id::text)
        OR
        EXISTS (
            SELECT 1 FROM public.farms
            WHERE farms.id::text = crop_scans.farm_id::text
            AND farms.owner_id::text = auth.uid()::text
        )
        OR
        EXISTS (
            SELECT 1 FROM public.crop_cycles
            WHERE crop_cycles.id::text = crop_scans.crop_cycle_id::text
            AND crop_cycles.owner_id::text = auth.uid()::text
        )
    );

-- Also fix INSERT policy to require authenticated user
DROP POLICY IF EXISTS "Allow scan creation" ON public.crop_scans;

CREATE POLICY "Authenticated users can create scans"
    ON public.crop_scans FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================================
-- 3. FIX ROLE SELF-ASSIGNMENT: Restrict OFFICER on signup
-- ============================================================

-- Add CHECK constraint on profiles.role (if not already present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'profiles_role_check'
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_role_check
        CHECK (role IN ('FARMER', 'BUYER', 'OFFICER'));
    END IF;
END $$;

-- Replace the trigger function to prevent OFFICER self-assignment on signup
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


-- ============================================================
-- 4. ADD DISTRICT COLUMN TO HOTSPOT_REPORTS (for filtering)
-- ============================================================

ALTER TABLE public.hotspot_reports
    ADD COLUMN IF NOT EXISTS district TEXT;

CREATE INDEX IF NOT EXISTS idx_hotspot_reports_district
    ON public.hotspot_reports(district);


-- ============================================================
-- 5. FIX MARKETPLACE LISTINGS RLS: Tighten insert/update
-- ============================================================

-- Insert: only authenticated users (farmer role enforced at API level)
DROP POLICY IF EXISTS "Authenticated users can create listings" ON public.marketplace_listings;
CREATE POLICY "Authenticated users can create listings"
    ON public.marketplace_listings FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Update: only the farmer who owns the listing or officers
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


-- ============================================================
-- 6. FIX TRADE NEGOTIATIONS RLS: Restrict to participants
-- ============================================================

DROP POLICY IF EXISTS "Parties can view negotiations" ON public.trade_negotiations;
CREATE POLICY "Negotiation participants can view"
    ON public.trade_negotiations FOR SELECT
    USING (
        sender_id::text = auth.uid()::text
        OR EXISTS (
            SELECT 1 FROM public.marketplace_listings ml
            WHERE ml.id::text = trade_negotiations.listing_id::text
            AND ml.farmer_id::text = auth.uid()::text
        )
    );

DROP POLICY IF EXISTS "Authenticated users can propose terms" ON public.trade_negotiations;
CREATE POLICY "Authenticated users can negotiate"
    ON public.trade_negotiations FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND sender_id = auth.uid());


-- ============================================================
-- 7. ORDERS TABLE (Marketplace Orders)
-- ============================================================

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
-- Ensure listing_id is compatible with text IDs
DO $$ BEGIN
    ALTER TABLE public.orders ALTER COLUMN listing_id TYPE TEXT USING listing_id::text;
EXCEPTION
    WHEN others THEN null;
END $$;

CREATE POLICY "Buyers and sellers can view their orders"
    ON public.orders FOR SELECT
    USING (
        buyer_id::text = auth.uid()::text
        OR EXISTS (
            SELECT 1 FROM public.marketplace_listings ml
            WHERE ml.id::text = orders.listing_id::text
            AND ml.farmer_id::text = auth.uid()::text
        )
    );

DROP POLICY IF EXISTS "Authenticated buyers can create orders" ON public.orders;
CREATE POLICY "Authenticated buyers can create orders"
    ON public.orders FOR INSERT
    WITH CHECK (auth.uid() = buyer_id);

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_listing ON public.orders(listing_id);


-- ============================================================
-- SUCCESS
-- ============================================================

SELECT 'KisanX RLS security hardening applied successfully!' AS status;
