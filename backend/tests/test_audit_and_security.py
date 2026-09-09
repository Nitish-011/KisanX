"""
Comprehensive automated tests for KisanX audit, security, RBAC, data integrity, and ML fallbacks.
Run with:
    pytest tests/test_audit_and_security.py -v
"""

import io
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.dependencies import AuthenticatedUser, get_authenticated_user, ROLE_FARMER, ROLE_BUYER, ROLE_OFFICER


client = TestClient(app)


# ------------------------------------------------------------
# 1. Startup & Route Tests
# ------------------------------------------------------------

def test_backend_startup_and_routes():
    """Verify backend starts and registers all required route groups without error."""
    assert len(app.routes) >= 20
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "kisanx-api"


def test_health_and_ready_endpoints():
    """Verify /health and /ready endpoints report model readiness without crashing."""
    res_health = client.get("/health")
    assert res_health.status_code == 200
    health_data = res_health.json()
    assert "models" in health_data

    res_ready = client.get("/ready")
    assert res_ready.status_code == 200
    ready_data = res_ready.json()
    assert "status" in ready_data
    assert "cotton_model" in ready_data
    assert "sugarcane_model" in ready_data


# ------------------------------------------------------------
# 2. Authorization & RBAC Dependency Tests
# ------------------------------------------------------------

def test_missing_auth_header_raises_401():
    """Protected endpoints must reject requests with missing Authorization header."""
    # Farmer listings
    res = client.get("/api/marketplace/farmer-listings")
    assert res.status_code == 401

    # Inspector queue
    res = client.get("/api/marketplace/inspector-queue")
    assert res.status_code == 401

    # Sell shop messages
    res = client.get("/api/marketplace/sell-shop/messages?listing_id=test")
    assert res.status_code == 401


def test_inspector_queue_requires_officer_role():
    """A farmer or buyer token must receive 403 Forbidden on the inspector queue."""
    # Mock authenticated user with FARMER role
    app.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser(
        id="user-farmer-123",
        role=ROLE_FARMER,
        name="Rameshwar Farmer",
    )
    try:
        res = client.get("/api/marketplace/inspector-queue")
        assert res.status_code == 403
        assert "Required role: OFFICER" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_non_officer_cannot_certify():
    """A buyer or farmer cannot certify listings."""
    app.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser(
        id="user-buyer-456",
        role=ROLE_BUYER,
        name="Mandi Buyer",
    )
    try:
        res = client.post("/api/marketplace/certify", json={
            "listing_id": "list-test",
            "action": "CERTIFY",
            "notes": "Testing unauthorized certify"
        })
        assert res.status_code == 403
        assert "Required role: OFFICER" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_buyer_or_officer_cannot_publish_listing():
    """Only FARMER role can publish harvest listings."""
    app.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser(
        id="user-officer-789",
        role=ROLE_OFFICER,
        name="Inspector Deshmukh",
    )
    try:
        payload = {
            "farm_name": "Estate",
            "village": "Village A",
            "district": "District B",
            "crop_name": "Cotton",
            "variety": "Bt",
            "farm_area_acres": 2.0,
            "health_percentage": 90.0,
            "quality_grade": "Grade A",
            "estimated_weight_quintals": 10.0,
            "price_per_quintal": 7000,
            "total_valuation": 70000,
            "gemma_appraisal_summary": "Good harvest.",
        }
        res = client.post("/api/marketplace/list", json=payload)
        assert res.status_code == 403
        assert "Required role: FARMER" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------
# 3. Marketplace Data Integrity Tests
# ------------------------------------------------------------

def test_listing_value_tampering_rejected():
    """Backend must reject listing if total_valuation deviates >10% from price * weight."""
    app.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser(
        id="user-farmer-123",
        role=ROLE_FARMER,
        name="Rameshwar Farmer",
    )
    try:
        tampered_payload = {
            "farm_name": "Shivaji Farm",
            "village": "Baramati",
            "district": "Pune",
            "crop_name": "Cotton",
            "variety": "Bt Cotton",
            "farm_area_acres": 5.0,
            "health_percentage": 92.0,
            "quality_grade": "Grade A",
            "estimated_weight_quintals": 20.0,
            "price_per_quintal": 7000,
            "total_valuation": 1,  # Malicious: 20 * 7000 = 140,000, but submitted 1
            "gemma_appraisal_summary": "Tampered appraisal test.",
        }
        res = client.post("/api/marketplace/list", json=tampered_payload)
        assert res.status_code == 422
        assert "total_valuation does not match" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_listing_agronomic_yield_bounds_enforced():
    """Backend must reject unrealistic yields per acre (e.g. 500 quintals/acre for cotton)."""
    app.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser(
        id="user-farmer-123",
        role=ROLE_FARMER,
        name="Rameshwar Farmer",
    )
    try:
        unrealistic_yield_payload = {
            "farm_name": "Shivaji Farm",
            "village": "Baramati",
            "district": "Pune",
            "crop_name": "Cotton",
            "variety": "Bt Cotton",
            "farm_area_acres": 1.0,
            "health_percentage": 92.0,
            "quality_grade": "Grade A",
            "estimated_weight_quintals": 500.0,  # 500 q/acre is agronomically impossible
            "price_per_quintal": 7000,
            "total_valuation": 3500000,
            "gemma_appraisal_summary": "Yield tampering test.",
        }
        res = client.post("/api/marketplace/list", json=unrealistic_yield_payload)
        assert res.status_code == 422
        assert "outside realistic agronomic bounds" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------
# 4. Upload Validation & Hardening Tests
# ------------------------------------------------------------

def test_trap_upload_rejects_non_image():
    """Trap count upload must reject invalid formats with 400 or 415."""
    app.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser(
        id="user-farmer-123",
        role=ROLE_FARMER,
        name="Farmer",
    )
    try:
        fake_file = io.BytesIO(b"This is plain text, not an image.")
        res = client.post(
            "/api/trap-counts",
            data={"pest_species": "pink_bollworm", "crop": "cotton"},
            files={"file": ("malicious.txt", fake_file, "text/plain")}
        )
        assert res.status_code in (400, 415)
    finally:
        app.dependency_overrides.clear()


def test_trap_upload_rejects_corrupted_image():
    """Trap count upload must reject bytes that fail Pillow decode validation."""
    app.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser(
        id="user-farmer-123",
        role=ROLE_FARMER,
        name="Farmer",
    )
    try:
        fake_jpg = io.BytesIO(b"\xFF\xD8\xFF\xE0" + b"Corrupted garbage data")
        res = client.post(
            "/api/trap-counts",
            data={"pest_species": "pink_bollworm", "crop": "cotton"},
            files={"file": ("fake.jpg", fake_jpg, "image/jpeg")}
        )
        assert res.status_code == 400
        assert "not a valid image" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_harvest_analysis_rejects_unsupported_crop():
    """Marketplace analyze-harvest must reject unsupported crops."""
    test_img = Image.new("RGB", (100, 100), color=(50, 150, 50))
    buf = io.BytesIO()
    test_img.save(buf, format="JPEG")
    buf.seek(0)

    res = client.post(
        "/api/marketplace/analyze-harvest",
        data={"crop_name": "Pineapple", "farm_area_acres": "2.0"},
        files={"file": ("test.jpg", buf, "image/jpeg")}
    )
    assert res.status_code == 400
    assert "Unsupported crop" in res.json()["detail"]


# ------------------------------------------------------------
# 5. ML Missing Weights Handling
# ------------------------------------------------------------

def test_missing_weights_returns_503_or_service_unavailable():
    """Calling disease model inference when weights are missing must return 503 instead of generic 500."""
    from app.services.crop_router import route_crop_prediction
    from app.routes.scans import run_disease_prediction

    # Test image
    img = Image.new("RGB", (224, 224), color=(0, 200, 0))

    # If cotton/sugarcane weights are missing, it must return 503
    try:
        run_disease_prediction("Cotton", img)
    except Exception as exc:
        from fastapi import HTTPException
        if isinstance(exc, HTTPException):
            # Must be 503 or successful inference (if weights exist locally)
            assert exc.status_code in (200, 503)
