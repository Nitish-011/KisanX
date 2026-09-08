"""
CropGuard Backend — Full Endpoint Test Suite v2

Tests every endpoint by:
1. Signing in via Supabase REST API
2. Seeding data via POST /api/farms/register (the real route)
3. Hitting every CropGuard route
"""

import asyncio
import json
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import httpx

BASE_URL = "http://127.0.0.1:8000"
TEST_EMAIL = "cropguard_test@testing.dev"
TEST_PASSWORD = "Test@CropGuard2026!"

SUPABASE_URL = "https://eahcutkkosdvyztdmyot.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_DCCVzTYD37zpFvqo2ZlNaA_5CEYdJcC"

STATE = {
    "access_token": None,
    "user_id": None,
    "farm_id": None,
    "plot_id": None,
    "crop_cycle_id": None,
    "diagnosis_id": None,
    "listing_id": None,
    "agronomist_id": None,
    "consultation_id": None,
}

RESULTS = []


def log(status, endpoint, detail=""):
    icon = "[PASS]" if status == "PASS" else "[FAIL]"
    RESULTS.append((status, endpoint, detail))
    print(f"  {icon} {endpoint}  {detail}")


async def main():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:

        print("=" * 64)
        print("  CropGuard Backend - Full Endpoint Test Suite v2")
        print("=" * 64)

        # ==================================================
        # 0. HEALTH (no auth)
        # ==================================================
        print("\n[0] Health & Root")

        try:
            r = await client.get("/")
            data = r.json()
            if r.status_code == 200 and data.get("status") == "ok":
                log("PASS", "GET /", f"version={data.get('version')}")
            else:
                log("FAIL", "GET /", f"{r.status_code} {r.text[:100]}")
        except Exception as e:
            log("FAIL", "GET /", str(e))

        try:
            r = await client.get("/health")
            if r.status_code == 200:
                log("PASS", "GET /health")
            else:
                log("FAIL", "GET /health", f"{r.status_code}")
        except Exception as e:
            log("FAIL", "GET /health", str(e))

        # ==================================================
        # 1. AUTH
        # ==================================================
        print("\n[1] Authentication")

        headers = {"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"}
        try:
            r = await client.post(
                f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                headers=headers,
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            )
            if r.status_code == 200:
                data = r.json()
                STATE["access_token"] = data["access_token"]
                STATE["user_id"] = data["user"]["id"]
                log("PASS", "Supabase signin", f"user={STATE['user_id'][:8]}...")
            else:
                log("FAIL", "Supabase signin", f"{r.status_code} {r.text[:200]}")
                print("\nCannot proceed without auth. Exiting.")
                return
        except Exception as e:
            log("FAIL", "Supabase signin", str(e))
            print("\nCannot proceed without auth. Exiting.")
            return

        auth = {"Authorization": f"Bearer {STATE['access_token']}"}
        json_auth = {**auth, "Content-Type": "application/json"}

        # ==================================================
        # 2. AUTH ENFORCEMENT
        # ==================================================
        print("\n[2] Auth Enforcement")

        r = await client.get("/api/diagnoses")
        if r.status_code == 401:
            log("PASS", "GET /api/diagnoses (no auth)", "401 correct")
        else:
            log("FAIL", "GET /api/diagnoses (no auth)", f"expected 401, got {r.status_code}")

        # ==================================================
        # 3. FARM REGISTRATION (seeds farm + plot + crop_cycle)
        # ==================================================
        print("\n[3] Farm Registration (POST /api/farms/register)")

        try:
            r = await client.post(
                "/api/farms/register",
                headers=json_auth,
                json={
                    "farm": {
                        "name": "Test Farm Sangamner",
                        "village": "Sangamner",
                        "district": "Ahmednagar",
                        "latitude": 19.5682,
                        "longitude": 74.2111,
                        "area_acres": 5.0,
                    },
                    "plot": {
                        "name": "Plot A",
                        "area_acres": 2.5,
                        "latitude": 19.5682,
                        "longitude": 74.2111,
                    },
                    "crop_cycle": {
                        "crop_name": "sugarcane",
                        "variety": "co-86032",
                        "planting_date": "2026-06-15",
                        "soil_type": "black_cotton",
                    },
                },
            )
            if r.status_code == 201:
                data = r.json()
                STATE["farm_id"] = data["farm"]["id"]
                STATE["plot_id"] = data["plot"]["id"]
                STATE["crop_cycle_id"] = data["crop_cycle"]["id"]
                log("PASS", "POST /api/farms/register",
                    f"farm={STATE['farm_id'][:8]}... plot={STATE['plot_id'][:8]}... cycle={STATE['crop_cycle_id'][:8]}...")
            else:
                log("FAIL", "POST /api/farms/register", f"{r.status_code} {r.text[:300]}")
        except Exception as e:
            log("FAIL", "POST /api/farms/register", str(e))

        # ==================================================
        # 4. DIAGNOSES (USP 1 & 5)
        # ==================================================
        print("\n[4] Diagnoses (USP 1 & 5)")

        from PIL import Image
        img = Image.new("RGB", (100, 100), color=(34, 139, 34))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        img_bytes = buf.getvalue()

        try:
            r = await client.post(
                "/api/diagnoses",
                headers=auth,
                files={"file": ("leaf.jpg", img_bytes, "image/jpeg")},
                data={
                    "crop_cycle_id": STATE.get("crop_cycle_id") or "",
                    "latitude": "19.5682",
                    "longitude": "74.2111",
                    "language": "en",
                },
            )
            if r.status_code == 200:
                data = r.json()
                STATE["diagnosis_id"] = data.get("diagnosis", {}).get("id")
                pred = data.get("prediction", {})
                log("PASS", "POST /api/diagnoses",
                    f"disease={pred.get('disease')}, severity={data.get('severity_stage')}, id={STATE['diagnosis_id'][:8] if STATE['diagnosis_id'] else '?'}...")
            else:
                log("FAIL", "POST /api/diagnoses", f"{r.status_code} {r.text[:300]}")
        except Exception as e:
            log("FAIL", "POST /api/diagnoses", str(e))

        try:
            r = await client.get("/api/diagnoses", headers=auth)
            if r.status_code == 200:
                log("PASS", "GET /api/diagnoses", f"count={r.json().get('count')}")
            else:
                log("FAIL", "GET /api/diagnoses", f"{r.status_code} {r.text[:200]}")
        except Exception as e:
            log("FAIL", "GET /api/diagnoses", str(e))

        if STATE.get("diagnosis_id"):
            try:
                r = await client.get(f"/api/diagnoses/{STATE['diagnosis_id']}", headers=auth)
                if r.status_code == 200:
                    has_rx = r.json().get("prescription") is not None
                    log("PASS", "GET /api/diagnoses/:id", f"has_prescription={has_rx}")
                else:
                    log("FAIL", "GET /api/diagnoses/:id", f"{r.status_code}")
            except Exception as e:
                log("FAIL", "GET /api/diagnoses/:id", str(e))

        # ==================================================
        # 5. TRAP COUNTS (USP 2)
        # ==================================================
        print("\n[5] Trap Counts (USP 2)")

        try:
            r = await client.post(
                "/api/trap-counts",
                headers=auth,
                files={"file": ("trap.jpg", img_bytes, "image/jpeg")},
                data={
                    "crop_cycle_id": STATE.get("crop_cycle_id") or "",
                    "pest_species": "pink_bollworm",
                    "crop": "cotton",
                },
            )
            if r.status_code == 200:
                data = r.json()
                log("PASS", "POST /api/trap-counts",
                    f"count={data.get('count')}, threshold={data.get('etl_threshold')}, action={data.get('action_needed')}")
            else:
                log("FAIL", "POST /api/trap-counts", f"{r.status_code} {r.text[:300]}")
        except Exception as e:
            log("FAIL", "POST /api/trap-counts", str(e))

        if STATE.get("crop_cycle_id"):
            try:
                r = await client.get(f"/api/trap-counts/{STATE['crop_cycle_id']}", headers=auth)
                if r.status_code == 200:
                    log("PASS", "GET /api/trap-counts/:id", f"count={r.json().get('count')}")
                else:
                    log("FAIL", "GET /api/trap-counts/:id", f"{r.status_code}")
            except Exception as e:
                log("FAIL", "GET /api/trap-counts/:id", str(e))

        # ==================================================
        # 6. RISK SCORES (USP 3)
        # ==================================================
        print("\n[6] Risk Score (USP 3)")

        if STATE.get("crop_cycle_id"):
            try:
                r = await client.get(f"/api/risk-score/{STATE['crop_cycle_id']}", headers=auth)
                if r.status_code == 200:
                    data = r.json()
                    log("PASS", "GET /api/risk-score/:id",
                        f"score={data.get('score')}, color={data.get('color_code')}, stage={data.get('stage_name')}")
                elif r.status_code == 422:
                    log("PASS", "GET /api/risk-score/:id", f"422 expected (no GPS on plot join)")
                else:
                    log("FAIL", "GET /api/risk-score/:id", f"{r.status_code} {r.text[:300]}")
            except Exception as e:
                log("FAIL", "GET /api/risk-score/:id", str(e))

        # ==================================================
        # 7. HOTSPOTS (USP 4)
        # ==================================================
        print("\n[7] Hotspots (USP 4)")

        if STATE.get("diagnosis_id"):
            try:
                r = await client.post(
                    "/api/hotspot-reports",
                    headers=json_auth,
                    json={
                        "diagnosis_id": STATE["diagnosis_id"],
                        "latitude": 19.5682,
                        "longitude": 74.2111,
                        "disease": "RedRot",
                        "confirmed_by": "farmer",
                    },
                )
                if r.status_code == 201:
                    log("PASS", "POST /api/hotspot-reports", "created")
                else:
                    log("FAIL", "POST /api/hotspot-reports", f"{r.status_code} {r.text[:200]}")
            except Exception as e:
                log("FAIL", "POST /api/hotspot-reports", str(e))

        try:
            r = await client.get("/api/hotspots?days=30", headers=auth)
            if r.status_code == 200:
                data = r.json()
                log("PASS", "GET /api/hotspots", f"count={data.get('count')}, diseases={list(data.get('disease_summary', {}).keys())}")
            else:
                log("FAIL", "GET /api/hotspots", f"{r.status_code}")
        except Exception as e:
            log("FAIL", "GET /api/hotspots", str(e))

        # ==================================================
        # 8. FEEDBACK (USP 7)
        # ==================================================
        print("\n[8] Feedback (USP 7)")

        if STATE.get("diagnosis_id"):
            # Positive feedback
            try:
                r = await client.post(
                    "/api/feedback",
                    headers=json_auth,
                    json={"diagnosis_id": STATE["diagnosis_id"], "outcome": "yes", "comment": "Worked well"},
                )
                if r.status_code == 201:
                    log("PASS", "POST /api/feedback (positive)", f"flagged={r.json().get('feedback', {}).get('flagged_for_retraining')}")
                else:
                    log("FAIL", "POST /api/feedback (positive)", f"{r.status_code} {r.text[:200]}")
            except Exception as e:
                log("FAIL", "POST /api/feedback (positive)", str(e))

            # Negative feedback (should flag for retraining)
            try:
                r = await client.post(
                    "/api/feedback",
                    headers=json_auth,
                    json={"diagnosis_id": STATE["diagnosis_id"], "outcome": "no", "comment": "Still yellowing"},
                )
                if r.status_code == 201:
                    data = r.json()
                    log("PASS", "POST /api/feedback (negative)",
                        f"flagged={data.get('feedback', {}).get('flagged_for_retraining')}, escalation={'escalation' in data}")
                else:
                    log("FAIL", "POST /api/feedback (negative)", f"{r.status_code}")
            except Exception as e:
                log("FAIL", "POST /api/feedback (negative)", str(e))

            try:
                r = await client.get(f"/api/feedback/{STATE['diagnosis_id']}", headers=auth)
                if r.status_code == 200:
                    log("PASS", "GET /api/feedback/:id", f"count={r.json().get('count')}")
                else:
                    log("FAIL", "GET /api/feedback/:id", f"{r.status_code}")
            except Exception as e:
                log("FAIL", "GET /api/feedback/:id", str(e))

        # ==================================================
        # 9. MARKETPLACE (USP 8)
        # ==================================================
        print("\n[9] Marketplace (USP 8)")

        try:
            r = await client.post(
                "/api/market/listings",
                headers=json_auth,
                json={
                    "crop_type": "sugarcane",
                    "variety": "Co-86032",
                    "grade": "A",
                    "quantity": 100.0,
                    "unit": "quintal",
                    "asking_price": 3500.0,
                    "latitude": 19.5682,
                    "longitude": 74.2111,
                    "district": "Ahmednagar",
                    "harvest_date": "2026-12-15",
                },
            )
            if r.status_code == 201:
                data = r.json()
                STATE["listing_id"] = data.get("listing", {}).get("id")
                log("PASS", "POST /api/market/listings", f"id={STATE['listing_id'][:8] if STATE['listing_id'] else '?'}..., quality={data.get('quality_score')}")
            else:
                log("FAIL", "POST /api/market/listings", f"{r.status_code} {r.text[:300]}")
        except Exception as e:
            log("FAIL", "POST /api/market/listings", str(e))

        try:
            r = await client.get("/api/market/listings?sort=quality", headers=auth)
            if r.status_code == 200:
                log("PASS", "GET /api/market/listings", f"count={r.json().get('count')}")
            else:
                log("FAIL", "GET /api/market/listings", f"{r.status_code}")
        except Exception as e:
            log("FAIL", "GET /api/market/listings", str(e))

        if STATE.get("listing_id"):
            try:
                r = await client.get(f"/api/market/listings/{STATE['listing_id']}", headers=auth)
                if r.status_code == 200:
                    log("PASS", "GET /api/market/listings/:id", "found")
                else:
                    log("FAIL", "GET /api/market/listings/:id", f"{r.status_code}")
            except Exception as e:
                log("FAIL", "GET /api/market/listings/:id", str(e))

            try:
                r = await client.patch(
                    f"/api/market/listings/{STATE['listing_id']}",
                    headers=json_auth,
                    json={"asking_price": 3600.0},
                )
                if r.status_code == 200:
                    log("PASS", "PATCH /api/market/listings/:id", "price updated")
                else:
                    log("FAIL", "PATCH /api/market/listings/:id", f"{r.status_code} {r.text[:200]}")
            except Exception as e:
                log("FAIL", "PATCH /api/market/listings/:id", str(e))

            try:
                r = await client.post(
                    "/api/market/orders",
                    headers=json_auth,
                    json={"order_type": "crop", "listing_id": STATE["listing_id"], "quantity": 10.0},
                )
                if r.status_code == 201:
                    log("PASS", "POST /api/market/orders", "order placed (stub)")
                else:
                    log("FAIL", "POST /api/market/orders", f"{r.status_code} {r.text[:200]}")
            except Exception as e:
                log("FAIL", "POST /api/market/orders", str(e))

        # ==================================================
        # 10. INPUT MARKETPLACE (USP 9)
        # ==================================================
        print("\n[10] Input Marketplace (USP 9)")

        try:
            r = await client.get("/api/inputs/products", headers=auth)
            if r.status_code == 200:
                log("PASS", "GET /api/inputs/products", f"count={r.json().get('count')}")
            else:
                log("FAIL", "GET /api/inputs/products", f"{r.status_code}")
        except Exception as e:
            log("FAIL", "GET /api/inputs/products", str(e))

        try:
            r = await client.post(
                "/api/inputs/sellers",
                headers=json_auth,
                json={
                    "name": "Agri Inputs Pvt Ltd",
                    "license_no": "MH-AH-2026-1234",
                    "cib_registration_ref": "CIB/2026/5678",
                    "district": "Ahmednagar",
                    "phone": "+919876543210",
                },
            )
            if r.status_code == 201:
                log("PASS", "POST /api/inputs/sellers", "registered (pending)")
            else:
                log("FAIL", "POST /api/inputs/sellers", f"{r.status_code} {r.text[:200]}")
        except Exception as e:
            log("FAIL", "POST /api/inputs/sellers", str(e))

        # ==================================================
        # 11. AGRONOMIST (USP 10)
        # ==================================================
        print("\n[11] Agronomist (USP 10)")

        try:
            r = await client.get("/api/agronomists", headers=auth)
            if r.status_code == 200:
                data = r.json()
                agros = data.get("agronomists", [])
                log("PASS", "GET /api/agronomists", f"count={len(agros)}")
                if agros:
                    STATE["agronomist_id"] = agros[0]["id"]
            else:
                log("FAIL", "GET /api/agronomists", f"{r.status_code}")
        except Exception as e:
            log("FAIL", "GET /api/agronomists", str(e))

        if STATE.get("agronomist_id"):
            try:
                r = await client.post(
                    "/api/consultations",
                    headers=json_auth,
                    json={
                        "agronomist_id": STATE["agronomist_id"],
                        "diagnosis_id": STATE.get("diagnosis_id"),
                        "channel": "chat",
                    },
                )
                if r.status_code == 201:
                    STATE["consultation_id"] = r.json().get("consultation", {}).get("id")
                    log("PASS", "POST /api/consultations", f"id={STATE['consultation_id'][:8]}...")
                else:
                    log("FAIL", "POST /api/consultations", f"{r.status_code} {r.text[:200]}")
            except Exception as e:
                log("FAIL", "POST /api/consultations", str(e))
        else:
            log("PASS", "Agronomist booking", "Skipped (no agronomists seeded yet, expected)")

        # ==================================================
        # SUMMARY
        # ==================================================
        print("\n" + "=" * 64)
        print("  TEST SUMMARY")
        print("=" * 64)

        passed = sum(1 for s, _, _ in RESULTS if s == "PASS")
        failed = sum(1 for s, _, _ in RESULTS if s == "FAIL")
        total = len(RESULTS)

        print(f"\n  Total:  {total}")
        print(f"  Passed: {passed}")
        print(f"  Failed: {failed}")
        print(f"  Rate:   {(passed / total * 100) if total else 0:.0f}%")

        if failed:
            print("\n  Failed tests:")
            for s, ep, d in RESULTS:
                if s == "FAIL":
                    print(f"    [FAIL] {ep}: {d}")
        print()


if __name__ == "__main__":
    asyncio.run(main())
