# KisanX Database Migration & Schema Architecture Guide

This directory contains SQL migration scripts and schema definitions for the KisanX platform.

## Schema Hierarchy & Canonical Sources

| File | Purpose | Destruction Level | Usage Environment |
|---|---|---|---|
| `supabase_schema.sql` *(root)* | **Canonical Baseline Schema** | Safe / Additive | Production & Staging Initial Setup |
| `backend/app/sql/002_rls_security_hardening.sql` | **Incremental RLS & Role Security Hardening** | Safe (Zero Data Loss) | Apply to any running database |
| `backend/app/sql/dangerous_dev_reset.sql` | **Destructive Dev Reset Script** | ⚠️ **DANGER: DROPS ALL TABLES** | Local development scratch only |

---

## 1. Production / Staging Deployment Workflow

When configuring a new or existing Supabase project for KisanX:

1. **For Fresh Environments:**
   Run the canonical root schema [`supabase_schema.sql`](../../supabase_schema.sql) in the Supabase SQL Editor. It establishes:
   - Core profiles with role check constraint (`FARMER`, `BUYER`, `OFFICER`).
   - Hardened `handle_new_user()` trigger preventing unauthorized `OFFICER` signup.
   - Farm, plot, crop cycle, and scan hierarchy with strict owner-based Row Level Security (RLS).
   - Marketplace listings and trade negotiations with authenticated participant isolation.

2. **For Existing Databases (Safe Incremental Update):**
   Run [`002_rls_security_hardening.sql`](002_rls_security_hardening.sql).
   This script:
   - Closes open `USING (true)` RLS holes on `profiles`, `crop_scans`, and `trade_negotiations`.
   - Restricts profile SELECT queries to authenticated users (`auth.uid() IS NOT NULL`).
   - Ensures `crop_scans` are only readable by verified farm or crop cycle owners.
   - Updates `handle_new_user()` to prohibit client-metadata role escalation to `OFFICER`.
   - Tightens marketplace listing update permissions to owners and officers.
   - Restricts trade negotiation messages to conversation participants.
   - Adds the missing `district` column and indexing to `hotspot_reports`.

---

## 2. Local Scratch Development

> [!CAUTION]
> **DO NOT RUN `dangerous_dev_reset.sql` ON PRODUCTION OR SHARED DATABASES.**
> This file executes `DROP TABLE IF EXISTS ... CASCADE` across all core and USP tables, permanently deleting all records.

Use [`dangerous_dev_reset.sql`](dangerous_dev_reset.sql) only if you are wiping a dedicated local Supabase instance or disposable testing container to rebuild from scratch.
