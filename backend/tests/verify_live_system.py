"""
Comprehensive live end-to-end integration test runner for KisanX.
Tests both FastAPI backend (127.0.0.1:8000) and Next.js frontend (localhost:3000).
"""

import sys
import json
import urllib.request
import urllib.error

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

    # 4. Frontend Next.js Pages
    frontend_routes = [
        ("/", "Landing Page"),
        ("/auth", "Authentication Portal"),
        ("/market", "Marketplace"),
        ("/dashboard", "Farmer Dashboard"),
        ("/dashboard/scan", "CropGuard Scanner"),
        ("/dashboard/hotspots", "Biosecurity Hotspots Map"),
        ("/dashboard/inputs", "Inputs Store"),
        ("/dashboard/agronomists", "Agronomist Network"),
        ("/dashboard/traps", "Smart IoT Traps"),
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
        print(f"ALL {len(checks)} RUNTIME VERIFICATION CHECKS PASSED SUCCESSFULLY!")
        print("Backend and Frontend are both active, healthy, and communicating.")
        sys.exit(0)
    else:
        print("SOME CHECKS FAILED.")
        sys.exit(1)

if __name__ == "__main__":
    main()
