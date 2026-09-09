"""
Trap Counts route — USP 2 (Trap Photo Counter + ETL).

POST /api/trap-counts              → upload trap photo → count + ETL verdict
GET  /api/trap-counts/:crop_cycle_id → historical trap counts
"""

import hashlib
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

    # Deterministic SHA-256 hash-based mock so different images give
    # different (but strictly deterministic across process restarts) counts.
    digest = hashlib.sha256(image_bytes[:2048]).hexdigest()
    hash_val = int(digest[:8], 16) % 20
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
    # 0. VERIFY CROP CYCLE OWNERSHIP
    # --------------------------------------------------------

    if crop_cycle_id:
        try:
            cycle_res = (
                supabase
                .table("crop_cycles")
                .select("id, owner_id")
                .eq("id", crop_cycle_id)
                .limit(1)
                .execute()
            )
            if not cycle_res.data:
                raise HTTPException(
                    status_code=404,
                    detail="Crop cycle not found.",
                )
            if cycle_res.data[0].get("owner_id") != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not own this crop cycle.",
                )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to verify crop cycle: {str(exc)}",
            )

    # --------------------------------------------------------
    # 1. READ AND VALIDATE IMAGE
    # --------------------------------------------------------

    image_bytes = await file.read()

    # Size limit
    MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB
    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image must be under 10 MB.",
        )

    extension = (
        (file.filename or "trap.jpg").rsplit(".", 1)[-1].lower()
    )

    # Extension validation
    ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image format '.{extension}'. Use JPG, PNG, or WebP.",
        )

    # MIME type validation
    ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported content type '{file.content_type}'. Must be a valid image.",
        )

    # PIL decode validation — ensures the bytes are a real image
    from PIL import Image
    import io
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.verify()  # Check file integrity
        # Re-open for dimension check (verify() closes the image)
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size
        if width > 8192 or height > 8192:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Image dimensions ({width}x{height}) exceed maximum allowed 8192x8192.",
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is not a valid image.",
        )

    # --------------------------------------------------------
    # 2. COUNT PESTS (MOCK — demo mode)
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
        "demo_mode": True,  # Flag: pest count is from a mock model, not real detection
        "demo_warning": "Pest count is generated by a demo stub. Do not use for real agronomic decisions.",
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
