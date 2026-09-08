"""
Trap Counts route — USP 2 (Trap Photo Counter + ETL).

POST /api/trap-counts              → upload trap photo → count + ETL verdict
GET  /api/trap-counts/:crop_cycle_id → historical trap counts
"""

import uuid
from typing import Optional

from fastapi import (
    APIRouter, Depends, File, Form,
    HTTPException, UploadFile, status,
)

from app.dependencies import (
    AuthenticatedUser,
    get_authenticated_user,
    get_supabase,
)
from app.services.etl_calculator import compute_etl_verdict


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/trap-counts",
    tags=["Trap Counts"],
)

STORAGE_BUCKET = "crop-scans"


# ============================================================
# MOCK PEST COUNTER
# ============================================================
# In production, this would be a fine-tuned vision model
# (e.g., object detection on bollworm-in-trap datasets).
# For now, we use a stub that returns a configurable count
# so the ETL logic and API contract can be tested end-to-end.

def count_pests_in_image(
    image_bytes: bytes,
    pest_species: str,
) -> int:
    """
    Stub pest counter.

    TODO: Replace with a real object-detection model
    fine-tuned on trap images (e.g., BOLLWM dataset).
    Returns a mock count for demo purposes.
    """

    # Simple hash-based mock so different images give
    # different (but deterministic) counts.
    hash_val = hash(image_bytes[:1024]) % 20
    return hash_val


# ============================================================
# POST /api/trap-counts — Upload Trap Photo
# ============================================================

@router.post("")
async def create_trap_count(
    file: UploadFile = File(...),
    crop_cycle_id: Optional[str] = Form(default=None),
    pest_species: str = Form(default="pink_bollworm"),
    crop: str = Form(default="sugarcane"),
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """
    Upload a trap photo → count pests → compare against ETL
    threshold → check resistance rotation → return verdict.
    """

    supabase = get_supabase()

    # --------------------------------------------------------
    # 1. READ IMAGE
    # --------------------------------------------------------

    image_bytes = await file.read()
    extension = (
        (file.filename or "trap.jpg").rsplit(".", 1)[-1].lower()
    )

    # --------------------------------------------------------
    # 2. COUNT PESTS
    # --------------------------------------------------------

    count = count_pests_in_image(image_bytes, pest_species)

    # --------------------------------------------------------
    # 3. ETL VERDICT
    # --------------------------------------------------------

    verdict = compute_etl_verdict(
        crop=crop,
        pest_species=pest_species,
        count=count,
        crop_cycle_id=crop_cycle_id,
    )

    # --------------------------------------------------------
    # 4. UPLOAD IMAGE
    # --------------------------------------------------------

    file_name = f"{user.id}/traps/{uuid.uuid4().hex}.{extension}"

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
            detail=f"Trap image upload failed: {str(exc)}",
        )

    # --------------------------------------------------------
    # 5. SAVE TO DATABASE
    # --------------------------------------------------------

    row = {
        "owner_id": user.id,
        "crop_cycle_id": crop_cycle_id,
        "photo_url": file_name,
        "pest_species": pest_species,
        "count": count,
        "etl_threshold": verdict["etl_threshold"],
        "action_needed": verdict["action_needed"],
        "resistance_flag": verdict["resistance_flag"],
    }

    try:
        response = (
            supabase
            .table("trap_counts")
            .insert(row)
            .execute()
        )
        saved = (response.data or [{}])[0]
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save trap count: {str(exc)}",
        )

    # --------------------------------------------------------
    # 6. RESPONSE
    # --------------------------------------------------------

    return {
        "success": True,
        "trap_count": saved,
        "pest_species": pest_species,
        "count": count,
        "etl_threshold": verdict["etl_threshold"],
        "action_needed": verdict["action_needed"],
        "resistance_flag": verdict["resistance_flag"],
        "recommendation": verdict["recommendation"],
    }


# ============================================================
# GET /api/trap-counts/:crop_cycle_id — History
# ============================================================

@router.get("/{crop_cycle_id}")
def get_trap_counts(
    crop_cycle_id: str,
    limit: int = 50,
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    supabase = get_supabase()

    response = (
        supabase
        .table("trap_counts")
        .select("*")
        .eq("crop_cycle_id", crop_cycle_id)
        .eq("owner_id", user.id)
        .order("created_at", desc=True)
        .limit(min(limit, 200))
        .execute()
    )

    return {
        "success": True,
        "crop_cycle_id": crop_cycle_id,
        "count": len(response.data or []),
        "trap_counts": response.data or [],
    }
