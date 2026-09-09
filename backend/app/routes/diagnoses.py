"""
Diagnoses route — USP 1 & 5.

POST /api/diagnoses    → upload photo → disease + severity → prescription
GET  /api/diagnoses    → list farmer's diagnoses
GET  /api/diagnoses/:id → single diagnosis + prescription
"""

import uuid
from datetime import date, timedelta
from typing import Optional

from fastapi import (
    APIRouter, Depends, File, Form, Header,
    HTTPException, UploadFile, status,
)

from app.dependencies import (
    AuthenticatedUser,
    get_authenticated_user,
    get_supabase,
)
from app.services.crop_disease_model import crop_disease_model
from app.services.crop_advisory_service import generate_crop_advisory


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/diagnoses",
    tags=["Diagnoses"],
)

STORAGE_BUCKET = "crop-scans"
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


# ============================================================
# SEVERITY MAPPING
# ============================================================
# Map confidence + disease to a severity stage (1-4).
# In production, the ML model should output this directly.

def estimate_severity_stage(
    disease: str,
    confidence: float,
) -> int:
    """
    Rough heuristic to map classifier confidence to a
    severity stage until the ML model provides this natively.

    Stage 1: Early     (high confidence in mild presentation)
    Stage 2: Moderate
    Stage 3: Severe
    Stage 4: Critical
    """
    if disease.lower() == "healthy":
        return 1

    # Higher confidence → more visually prominent symptoms
    # → likely more advanced stage
    if confidence >= 0.92:
        return 3
    elif confidence >= 0.80:
        return 2
    else:
        return 1


# ============================================================
# RECHECK DATE
# ============================================================

def compute_recheck_date(severity_stage: int) -> date:
    """Earlier recheck for more severe cases."""
    days_map = {1: 7, 2: 5, 3: 3, 4: 2}
    days = days_map.get(severity_stage, 5)
    return date.today() + timedelta(days=days)


# ============================================================
# POST /api/diagnoses — Create Diagnosis
# ============================================================

@router.post("")
async def create_diagnosis(
    file: UploadFile = File(...),
    crop_cycle_id: Optional[str] = Form(default=None),
    latitude: Optional[float] = Form(default=None),
    longitude: Optional[float] = Form(default=None),
    language: str = Form(default="en"),
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """
    Upload a crop photo → MobileNetV3 classification →
    severity staging → Gemma RAG prescription →
    save diagnosis + prescription → return prescription card.
    """

    supabase = get_supabase()

    # --------------------------------------------------------
    # 0. VERIFY CROP CYCLE OWNERSHIP
    # --------------------------------------------------------

    crop_name_for_advisory = "Sugarcane"  # default fallback

    if crop_cycle_id:
        try:
            cycle_res = (
                supabase
                .table("crop_cycles")
                .select("id, owner_id, crop_name")
                .eq("id", crop_cycle_id)
                .limit(1)
                .execute()
            )
            if not cycle_res.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Crop cycle not found.",
                )
            cycle = cycle_res.data[0]
            if cycle.get("owner_id") != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not own this crop cycle.",
                )
            # Use actual crop name from the verified cycle
            crop_name_for_advisory = cycle.get("crop_name") or "Sugarcane"
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to verify crop cycle: {str(exc)}",
            )

    # --------------------------------------------------------
    # 1. VALIDATE IMAGE
    # --------------------------------------------------------

    image_bytes = await file.read()

    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image must be under 10 MB.",
        )

    extension = (file.filename or "image.jpg").rsplit(".", 1)[-1].lower()
    if extension not in ("jpg", "jpeg", "png", "webp"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image format. Use JPG, PNG, or WebP.",
        )

    # --------------------------------------------------------
    # 2. DISEASE PREDICTION (MobileNetV3)
    # --------------------------------------------------------

    from PIL import Image
    import io

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    prediction = crop_disease_model.predict(image)

    disease = prediction["disease"]
    confidence = float(prediction["confidence"])

    # --------------------------------------------------------
    # 3. SEVERITY STAGING
    # --------------------------------------------------------

    severity_stage = estimate_severity_stage(disease, confidence)

    # --------------------------------------------------------
    # 4. UPLOAD IMAGE TO SUPABASE STORAGE
    # --------------------------------------------------------

    file_name = f"{user.id}/{uuid.uuid4().hex}.{extension}"

    try:
        supabase.storage.from_(STORAGE_BUCKET).upload(
            file_name,
            image_bytes,
            {
                "content-type": (
                    f"image/{extension}"
                    if extension != "jpg"
                    else "image/jpeg"
                ),
                "upsert": False,
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Image upload failed: {str(exc)}",
        )

    # --------------------------------------------------------
    # 5. SAVE DIAGNOSIS
    # --------------------------------------------------------

    diagnosis_row = {
        "owner_id": user.id,
        "crop_cycle_id": crop_cycle_id,
        "photo_url": file_name,
        "disease": disease,
        "severity_stage": severity_stage,
        "confidence": confidence,
        "status": "auto",
    }

    try:
        diag_response = (
            supabase
            .table("diagnoses")
            .insert(diagnosis_row)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save diagnosis: {str(exc)}",
        )

    diagnosis = (diag_response.data or [{}])[0]
    diagnosis_id = diagnosis.get("id")

    # --------------------------------------------------------
    # 6. GENERATE PRESCRIPTION (Gemma RAG)
    # --------------------------------------------------------

    recheck = compute_recheck_date(severity_stage)

    try:
        advisory = await generate_crop_advisory(
            disease=disease,
            classifier_confidence=confidence,
            crop=crop_name_for_advisory,
            language=language,
        )
    except Exception:
        advisory = {
            "answer": (
                "Diagnosis completed but advisory "
                "generation failed. Please try asking "
                "Crop Doctor."
            ),
        }

    # Save prescription
    prescription_row = {
        "diagnosis_id": diagnosis_id,
        "treatment_steps": advisory.get("actions", []),
        "phi_days": None,
        "resistance_flag": False,
        "cost_estimate": None,
        "expected_recovery_pct": None,
        "recheck_date": recheck.isoformat(),
    }

    prescription = None
    prescription_error = False
    try:
        presc_response = (
            supabase
            .table("prescriptions")
            .insert(prescription_row)
            .execute()
        )
        prescription = (presc_response.data or [{}])[0]
    except Exception as exc:
        print(f"[Diagnoses] Prescription insert failed: {exc}")
        prescription_error = True

    # --------------------------------------------------------
    # 7. AUTO-CREATE HOTSPOT REPORT
    # --------------------------------------------------------

    if (
        disease.lower() != "healthy"
        and latitude is not None
        and longitude is not None
    ):
        try:
            supabase.table("hotspot_reports").insert({
                "diagnosis_id": diagnosis_id,
                "owner_id": user.id,
                "latitude": latitude,
                "longitude": longitude,
                "disease": disease,
                "confirmed_by": "farmer",
            }).execute()
        except Exception:
            pass  # non-critical

    # --------------------------------------------------------
    # 8. RESPONSE
    # --------------------------------------------------------

    return {
        "success": True,
        "diagnosis": diagnosis,
        "prediction": prediction,
        "severity_stage": severity_stage,
        "prescription": prescription,
        "prescription_error": prescription_error,
        "advisory": advisory,
        "recheck_date": recheck.isoformat(),
        "crop_used_for_advisory": crop_name_for_advisory,
    }


# ============================================================
# GET /api/diagnoses — List Diagnoses
# ============================================================

@router.get("")
def list_diagnoses(
    crop_cycle_id: Optional[str] = None,
    limit: int = 50,
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    supabase = get_supabase()

    query = (
        supabase
        .table("diagnoses")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", desc=True)
        .limit(min(limit, 200))
    )

    if crop_cycle_id:
        query = query.eq("crop_cycle_id", crop_cycle_id)

    response = query.execute()

    return {
        "success": True,
        "count": len(response.data or []),
        "diagnoses": response.data or [],
    }


# ============================================================
# GET /api/diagnoses/:id — Single Diagnosis + Prescription
# ============================================================

@router.get("/{diagnosis_id}")
def get_diagnosis(
    diagnosis_id: str,
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    supabase = get_supabase()

    # Get diagnosis
    diag_response = (
        supabase
        .table("diagnoses")
        .select("*")
        .eq("id", diagnosis_id)
        .eq("owner_id", user.id)
        .limit(1)
        .execute()
    )

    if not diag_response.data:
        raise HTTPException(
            status_code=404,
            detail="Diagnosis not found.",
        )

    diagnosis = diag_response.data[0]

    # Get prescription
    presc_response = (
        supabase
        .table("prescriptions")
        .select("*")
        .eq("diagnosis_id", diagnosis_id)
        .limit(1)
        .execute()
    )

    prescription = (
        presc_response.data[0]
        if presc_response.data
        else None
    )

    # Get feedback if any
    fb_response = (
        supabase
        .table("feedback")
        .select("*")
        .eq("diagnosis_id", diagnosis_id)
        .limit(1)
        .execute()
    )

    feedback = (
        fb_response.data[0]
        if fb_response.data
        else None
    )

    return {
        "success": True,
        "diagnosis": diagnosis,
        "prescription": prescription,
        "feedback": feedback,
    }
