import sys
import requests
import json
import time

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def test_full_system():
    print("=== KISANX FULL SYSTEM VERIFICATION ===")
    
    # 1. Farms endpoint
    print("\n--- 1. Testing GET /api/farms ---")
    r = requests.get(f"{BASE_URL}/api/farms")
    print(f"Status: {r.status_code}")
    assert r.status_code == 200
    farms_data = r.json()
    print(f"Farms count: {len(farms_data.get('farms', []))}")
    
    # 2. Assistant Gemma 3 4B RAG Chat
    print("\n--- 2. Testing POST /api/assistant/chat (Gemma 3 4B + ICAR/CICR RAG) ---")
    chat_payload = {
        "question": "How do I treat Bacterial Blight on my Cotton crop?",
        "crop": "Cotton",
        "disease": "Bacterial Blight",
        "crop_stage": "Flowering",
        "severity": 25.0
    }
    t0 = time.time()
    r = requests.post(f"{BASE_URL}/api/assistant/chat", json=chat_payload, timeout=60)
    print(f"Status: {r.status_code} (took {time.time()-t0:.2f}s)")
    assert r.status_code == 200
    chat_res = r.json()
    ans = chat_res.get("answer", {})
    answer_text = ans.get("answer", "") if isinstance(ans, dict) else str(ans)
    print("Crop Doctor Response snippet:")
    print(answer_text[:350] + "...")
    assert len(answer_text) > 50
    
    # 3. Marketplace Analyze Harvest (OpenCV + Math Formulas + Gemma)
    print("\n--- 3. Testing POST /api/marketplace/analyze-harvest ---")
    data = {
        "crop_name": "Cotton",
        "farm_area_acres": "3.5",
        "variety": "Bt Cotton Hybrid",
        "farm_name": "Vidarbha Agri Estates",
        "village": "Nagpur Rural",
        "district": "Nagpur, Maharashtra",
        "latitude": "21.1458",
        "longitude": "79.0882",
    }
    # Create a test image file
    import io
    from PIL import Image
    test_img = Image.new("RGB", (100, 100), color=(50, 150, 50))
    buf = io.BytesIO()
    test_img.save(buf, format="JPEG")
    img_bytes = buf.getvalue()
    files = {
        "file": ("test_harvest.jpg", img_bytes, "image/jpeg")
    }
    t0 = time.time()
    r = requests.post(f"{BASE_URL}/api/marketplace/analyze-harvest", data=data, files=files, timeout=30)
    print(f"Status: {r.status_code} (took {time.time()-t0:.2f}s)")
    assert r.status_code == 200
    analysis = r.json()
    health_pct = analysis.get('health_percentage')
    weight_q = analysis.get('estimated_weight_quintals')
    val_inr = analysis.get('total_valuation')
    appraisal = analysis.get('gemma_appraisal_summary', '')
    print(f"Health Score: {health_pct}%")
    print(f"Estimated Yield: {weight_q} Quintals")
    print(f"Valuation: ₹{val_inr:,}")
    print(f"Appraisal: {appraisal[:150]}...")
    
    # 4. Marketplace Listing Creation
    print("\n--- 4. Testing POST /api/marketplace/list ---")
    list_payload = {
        "farmer_name": "Rameshwar Patil",
        "farm_name": "Vidarbha Agri Estates",
        "village": "Nagpur Rural",
        "district": "Nagpur, Maharashtra",
        "crop_name": "Cotton",
        "variety": "Bt Cotton Hybrid",
        "farm_area_acres": 3.5,
        "health_percentage": health_pct,
        "quality_grade": analysis.get("quality_grade", "Grade A (Premium)"),
        "estimated_weight_quintals": weight_q,
        "price_per_quintal": analysis.get("price_per_quintal", 7450),
        "total_valuation": val_inr,
        "gemma_appraisal_summary": appraisal,
        "latitude": 21.1458,
        "longitude": 79.0882,
        "encryption_fingerprint": analysis.get("encryption_fingerprint")
    }
    r = requests.post(f"{BASE_URL}/api/marketplace/list", json=list_payload)
    print(f"Status: {r.status_code}")
    assert r.status_code == 201
    listing_res = r.json()
    listing = listing_res.get("listing", {})
    listing_id = listing.get("id")
    print(f"Created Listing ID: {listing_id}")
    print(f"Session Fingerprint: {listing.get('encryption_fingerprint')}")
    
    # 5. Buyer Proximity Radar (Haversine distance)
    print("\n--- 5. Testing GET /api/marketplace/listings with Buyer Lat/Lng ---")
    r = requests.get(f"{BASE_URL}/api/marketplace/listings?buyer_lat=21.1500&buyer_lng=79.0900")
    print(f"Status: {r.status_code}")
    assert r.status_code == 200
    listings = r.json().get("listings", [])
    print(f"Retrieved {len(listings)} listings.")
    if listings:
        print(f"Nearest listing distance: {listings[0].get('distance_km')} km ({listings[0].get('farm_name')})")
    
    # 6. Food Inspector Certification
    print("\n--- 6. Testing POST /api/marketplace/certify ---")
    cert_payload = {
        "listing_id": listing_id,
        "officer_name": "Dr. Anirudh Kulkarni",
        "officer_id": "INSP-MH-4019",
        "action": "CERTIFY",
        "notes": "Passed foliar inspection. Zero bollworm defect, export-ready grade."
    }
    r = requests.post(f"{BASE_URL}/api/marketplace/certify", json=cert_payload)
    print(f"Status: {r.status_code}")
    assert r.status_code == 200
    cert_res = r.json()
    print(f"Cert Status: {cert_res.get('listing', {}).get('inspector_status')}")
    print(f"Inspector: {cert_res.get('listing', {}).get('certified_by')}")
    
    # 7. Encrypted Negotiate Chat
    print("\n--- 7. Testing POST /api/marketplace/negotiate ---")
    neg_payload = {
        "listing_id": listing_id,
        "sender_role": "buyer",
        "sender_name": "Nagpur Cotton Millers Co.",
        "proposed_price": 7250,
        "message": "We can offer ₹7,250 per quintal for the entire lot with immediate bank transfer."
    }
    r = requests.post(f"{BASE_URL}/api/marketplace/negotiate", json=neg_payload)
    print(f"Status: {r.status_code}")
    assert r.status_code == 200
    neg_res = r.json()
    entry = neg_res.get("entry", {})
    print(f"Negotiation Status: {entry.get('status')}")
    print(f"Encryption Hash: {entry.get('encryption_hash')}")
    print(f"Total Negotiations: {len(neg_res.get('all_negotiations', []))}")
    
    print("\n🎉 ALL 7 SYSTEM VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_full_system()
