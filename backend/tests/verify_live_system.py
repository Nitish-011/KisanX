"""
Comprehensive live end-to-end integration test runner for KisanX.
Tests both FastAPI backend (127.0.0.1:8000) and Next.js frontend (localhost:3000).
"""

import sys
import os
import json
import urllib.request
import urllib.error

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


BACKEND_BASE = "http://127.0.0.1:8000"
FRONTEND_BASE = "http://localhost:3000"

def request(url: str, method: str = "GET", headers: dict = None, body: bytes = None):
    req_headers = {"User-Agent": "KisanX-SystemVerifier/1.0"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace"), None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace"), e
    except Exception as e:
        return 0, "", e

def main():
    print("================================================================")
    print("         KISANX FULL SYSTEM LIVE HEALTH & RUNTIME AUDIT         ")
    print("================================================================")
    
    checks = []
    
    # 1. Backend Liveness & Health
    status, body, _ = request(f"{BACKEND_BASE}/")
    checks.append(("Backend Root ('/')", status == 200, f"Status: {status}"))
    
    status, body, _ = request(f"{BACKEND_BASE}/live")
    checks.append(("Backend Liveness ('/live')", status == 200, f"Status: {status}"))
    
    status, body, _ = request(f"{BACKEND_BASE}/ready")
    checks.append(("Backend Readiness ('/ready')", status == 200, f"Status: {status}"))
    
    status, body, _ = request(f"{BACKEND_BASE}/health")
    checks.append(("Backend Health ('/health')", status == 200, f"Status: {status}"))

    # 2. Marketplace Public Endpoint
    status, body, _ = request(f"{BACKEND_BASE}/api/marketplace/listings")
    try:
        data = json.loads(body)
        count = data.get("count", 0)
        marketplace_ok = status == 200 and data.get("success") is True
        msg = f"Status: {status}, Listings found: {count}"
    except Exception as e:
        marketplace_ok = False
        msg = f"Failed to parse JSON: {e}"
    checks.append(("Marketplace Public Listings ('/api/marketplace/listings')", marketplace_ok, msg))

    # 3. RBAC Protected Routes (Must Reject with 401 Unauthorized)
    protected_routes = [
        ("/api/marketplace/inspector-queue", "Officer Queue"),
        ("/api/marketplace/farmer-listings", "Farmer Listings"),
        ("/api/marketplace/sell-shop/messages?listing_id=test-123", "Sell Shop Messages"),
        ("/api/inputs/products", "Inputs Products"),
        ("/api/agronomists", "Agronomists List"),
        ("/api/farm-intelligence/test-farm-123/scans", "Farm Intelligence Scans"),
        ("/api/assistant/chat", "Assistant Chat (GET)"),
    ]
    for path, desc in protected_routes:
        status, _, _ = request(f"{BACKEND_BASE}{path}")
        # Note: assistant/chat is POST so GET might be 405 Method Not Allowed or 401; both are non-leaking
        is_secure = status in (401, 403, 405)
        checks.append((f"RBAC Protection: {desc}", is_secure, f"Status: {status} (Expected 401/403/405)"))

    # 4. Authenticated API Checks (Farmer & Buyer)
    try:
        from app.services.supabase_service import get_server_supabase
        supabase = get_server_supabase()
        
        # Test Farmer Login & Endpoints
        farmer_auth = supabase.auth.sign_in_with_password({"email": "farmer@kisanx.com", "password": "Password123!"})
        farmer_token = farmer_auth.session.access_token
        farmer_headers = {"Authorization": f"Bearer {farmer_token}"}
        
        # Weather
        st, body, _ = request(f"{BACKEND_BASE}/api/weather", headers=farmer_headers)
        w_data = json.loads(body) if st == 200 else {}
        checks.append(("Farmer API: Live Weather & Spray Advisory", st == 200 and "spray_advisory" in w_data, f"Status: {st}, Temp: {w_data.get('spray_advisory', {}).get('temperature_c')}°C"))
        
        # Agronomists
        st, body, _ = request(f"{BACKEND_BASE}/api/agronomists", headers=farmer_headers)
        a_data = json.loads(body) if st == 200 else {}
        checks.append(("Farmer API: Agronomists Network", st == 200 and a_data.get("count", 0) > 0, f"Status: {st}, Experts: {a_data.get('count')}"))
        
        # Inputs
        st, body, _ = request(f"{BACKEND_BASE}/api/inputs/products", headers=farmer_headers)
        i_data = json.loads(body) if st == 200 else {}
        checks.append(("Farmer API: Certified Inputs Store", st == 200 and i_data.get("count", 0) > 0, f"Status: {st}, Products: {i_data.get('count')}"))
        
        # Traps
        cycle_id = "1ae8cc95-b9d5-45e3-b27a-5677d203e1d1"
        st, body, _ = request(f"{BACKEND_BASE}/api/trap-counts/{cycle_id}", headers=farmer_headers)
        t_data = json.loads(body) if st == 200 else {}
        checks.append(("Farmer API: Pest Traps & ETL History", st == 200 and t_data.get("count", 0) > 0, f"Status: {st}, Counts: {t_data.get('count')}"))
        
        # Risk Score
        st, body, _ = request(f"{BACKEND_BASE}/api/risk-score/{cycle_id}", headers=farmer_headers)
        r_data = json.loads(body) if st == 200 else {}
        checks.append(("Farmer API: Epidemiological Risk Radar", st == 200 and "score" in r_data, f"Status: {st}, Score: {r_data.get('score')} ({r_data.get('color_code')})"))

        # Diagnoses History
        st, body, _ = request(f"{BACKEND_BASE}/api/diagnoses", headers=farmer_headers)
        d_data = json.loads(body) if st == 200 else {}
        checks.append(("Farmer API: Crop Diagnoses History", st == 200 and d_data.get("count", 0) > 0, f"Status: {st}, Scans: {d_data.get('count')}"))

    except Exception as e:
        checks.append(("Authenticated Endpoints Verification", False, f"Auth test error: {e}"))

    # 5. Frontend Next.js Pages
    frontend_routes = [
        ("/", "Landing Page"),
        ("/auth", "Authentication Portal"),
        ("/market", "Marketplace"),
        ("/buyer", "Dedicated Buyer Radar"),
        ("/dashboard", "Farmer Dashboard"),
        ("/dashboard/scan", "CropGuard Scanner"),
        ("/dashboard/hotspots", "Biosecurity Hotspots Map"),
        ("/dashboard/inputs", "Inputs Store"),
        ("/dashboard/agronomists", "Agronomist Network"),
        ("/dashboard/traps", "Smart IoT Traps"),
        ("/dashboard/risk", "Epidemiological Risk Radar"),
        ("/dashboard/farm/new", "Farm Registration"),
    ]
    for path, desc in frontend_routes:
        status, body, err = request(f"{FRONTEND_BASE}{path}")
        is_ok = status == 200 and len(body) > 1000
        checks.append((f"Frontend Page: {desc} ('{path}')", is_ok, f"Status: {status}, Size: {len(body)} bytes"))

    # Print Summary Table
    print(f"{'CHECK NAME':<50} | {'RESULT':<8} | {'DETAILS'}")
    print("-" * 90)
    all_passed = True
    for name, passed, details in checks:
        if not passed:
            all_passed = False
        mark = "PASS" if passed else "FAIL"
        print(f"{name:<50} | {mark:<8} | {details}")
    
    print("================================================================")
    if all_passed:
        print("ALL CRITICAL RUNTIME SYSTEM CHECKS PASSED PERFECTLY!")
        return 0
    else:
        print("WARNING: Some system checks did not pass. Review output above.")
        return 1

if __name__ == "__main__":
    main()
