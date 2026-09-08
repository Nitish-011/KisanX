from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client, create_client

from app.services.supabase_service import get_server_supabase


router = APIRouter(
    prefix="/api/farm-intelligence",
    tags=["Farm Intelligence"],
)


class AuthenticatedUser(BaseModel):
    id: str


def get_settings():
    from app.config import settings
    return settings


def get_authenticated_user(
    authorization: str = Header(...),
) -> AuthenticatedUser:

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header.",
        )

    token = authorization.replace(
        "Bearer ",
        "",
        1,
    ).strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing access token.",
        )

    settings = get_settings()

    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase URL is not configured.",
        )

    if not settings.supabase_publishable_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase publishable key is not configured.",
        )

    try:
        supabase = create_client(
            settings.supabase_url,
            settings.supabase_publishable_key,
        )

        response = supabase.auth.get_user(token)

    except Exception as exc:

        print("")
        print("========== FARM INTELLIGENCE AUTH ERROR ==========")
        print("ERROR TYPE:", type(exc).__name__)
        print("ERROR:", repr(exc))
        print("===================================================")
        print("")

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        ) from exc

    if not response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found.",
        )

    return AuthenticatedUser(
        id=response.user.id,
    )


class ContextEntryCreate(BaseModel):
    farm_id: str

    plot_id: Optional[str] = None

    crop_cycle_id: Optional[str] = None

    category: str = Field(
        min_length=1,
        max_length=100,
    )

    key: str = Field(
        min_length=1,
        max_length=150,
    )

    value_text: Optional[str] = None

    value_number: Optional[float] = None

    value_json: Optional[Dict[str, Any]] = None

    source_type: str = "farmer_reported"

    confidence: str = "medium"

    language: str = "en"


VALID_SOURCE_TYPES = {
    "farmer_reported",
    "measured",
    "estimated",
    "ai_inferred",
    "external_source",
}


VALID_CONFIDENCE_LEVELS = {
    "low",
    "medium",
    "high",
}


def validate_context_payload(
    payload: ContextEntryCreate,
) -> None:

    if payload.source_type not in VALID_SOURCE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid source_type. Allowed values: "
                "farmer_reported, measured, estimated, "
                "ai_inferred, external_source."
            ),
        )

    if payload.confidence not in VALID_CONFIDENCE_LEVELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid confidence. Allowed values: "
                "low, medium, high."
            ),
        )

    if (
        payload.value_text is None
        and payload.value_number is None
        and payload.value_json is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "At least one of value_text, "
                "value_number, or value_json is required."
            ),
        )


def verify_farm_ownership(
    supabase: Client,
    farm_id: str,
    user_id: str,
) -> Dict[str, Any]:

    response = (
        supabase
        .table("farms")
        .select("*")
        .eq("id", farm_id)
        .eq("owner_id", user_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found.",
        )

    return response.data[0]


@router.get("/{farm_id}/context")
def get_farm_context(
    farm_id: str,
    category: Optional[str] = None,
    plot_id: Optional[str] = None,
    limit: int = 100,
    user: AuthenticatedUser = Depends(
        get_authenticated_user
    ),
):

    limit = max(1, min(limit, 200))

    supabase = get_server_supabase()

    verify_farm_ownership(
        supabase=supabase,
        farm_id=farm_id,
        user_id=user.id,
    )

    query = (
        supabase
        .table("farm_context_entries")
        .select("*")
        .eq("farm_id", farm_id)
        .eq("owner_id", user.id)
    )

    if category:
        query = query.eq(
            "category",
            category,
        )

    if plot_id:
        query = query.eq(
            "plot_id",
            plot_id,
        )

    response = (
        query
        .order(
            "recorded_at",
            desc=True,
        )
        .limit(limit)
        .execute()
    )

    return {
        "success": True,
        "farm_id": farm_id,
        "count": len(response.data or []),
        "context": response.data or [],
    }


@router.post(
    "/{farm_id}/context",
    status_code=status.HTTP_201_CREATED,
)
def create_farm_context(
    farm_id: str,
    payload: ContextEntryCreate,
    user: AuthenticatedUser = Depends(
        get_authenticated_user
    ),
):

    if payload.farm_id != farm_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="farm_id in body does not match URL farm_id.",
        )

    validate_context_payload(payload)

    supabase = get_server_supabase()

    verify_farm_ownership(
        supabase=supabase,
        farm_id=farm_id,
        user_id=user.id,
    )

    row = {
        "owner_id": user.id,
        "farm_id": farm_id,
        "plot_id": payload.plot_id,
        "crop_cycle_id": payload.crop_cycle_id,
        "category": payload.category,
        "key": payload.key,
        "value_text": payload.value_text,
        "value_number": payload.value_number,
        "value_json": payload.value_json,
        "source_type": payload.source_type,
        "confidence": payload.confidence,
        "language": payload.language,
    }

    try:

        response = (
            supabase
            .table("farm_context_entries")
            .insert(row)
            .execute()
        )

    except Exception as exc:

        print("")
        print("========== CONTEXT INSERT ERROR ==========")
        print("ERROR TYPE:", type(exc).__name__)
        print("ERROR:", repr(exc))
        print("===========================================")
        print("")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Failed to save farm context: "
                f"{str(exc)}"
            ),
        ) from exc

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Farm context was not saved.",
        )

    return {
        "success": True,
        "message": "Farm context saved successfully.",
        "context": response.data[0],
    }


@router.delete("/{farm_id}/context/{context_id}")
def delete_farm_context(
    farm_id: str,
    context_id: str,
    user: AuthenticatedUser = Depends(
        get_authenticated_user
    ),
):

    supabase = get_server_supabase()

    verify_farm_ownership(
        supabase=supabase,
        farm_id=farm_id,
        user_id=user.id,
    )

    response = (
        supabase
        .table("farm_context_entries")
        .delete()
        .eq("id", context_id)
        .eq("farm_id", farm_id)
        .eq("owner_id", user.id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm context entry not found.",
        )

    return {
        "success": True,
        "message": "Farm context deleted successfully.",
        "context": response.data[0],
    }


@router.get("/{farm_id}/scans")
def get_scan_history(
    farm_id: str,
    plot_id: Optional[str] = None,
    crop_cycle_id: Optional[str] = None,
    limit: int = 100,
    user: AuthenticatedUser = Depends(
        get_authenticated_user
    ),
):

    limit = max(1, min(limit, 200))

    supabase = get_server_supabase()

    verify_farm_ownership(
        supabase=supabase,
        farm_id=farm_id,
        user_id=user.id,
    )

    query = (
        supabase
        .table("crop_scans")
        .select("*")
        .eq("farm_id", farm_id)
        .eq("owner_id", user.id)
    )

    if plot_id:
        query = query.eq(
            "plot_id",
            plot_id,
        )

    if crop_cycle_id:
        query = query.eq(
            "crop_cycle_id",
            crop_cycle_id,
        )

    response = (
        query
        .order(
            "created_at",
            desc=True,
        )
        .limit(limit)
        .execute()
    )

    return {
        "success": True,
        "farm_id": farm_id,
        "count": len(response.data or []),
        "scans": response.data or [],
    }


@router.get("/{farm_id}/messages")
def get_assistant_messages(
    farm_id: str,
    plot_id: Optional[str] = None,
    crop_cycle_id: Optional[str] = None,
    scan_id: Optional[str] = None,
    limit: int = 100,
    user: AuthenticatedUser = Depends(
        get_authenticated_user
    ),
):

    limit = max(1, min(limit, 300))

    supabase = get_server_supabase()

    verify_farm_ownership(
        supabase=supabase,
        farm_id=farm_id,
        user_id=user.id,
    )

    query = (
        supabase
        .table("assistant_messages")
        .select("*")
        .eq("farm_id", farm_id)
        .eq("owner_id", user.id)
    )

    if plot_id:
        query = query.eq(
            "plot_id",
            plot_id,
        )

    if crop_cycle_id:
        query = query.eq(
            "crop_cycle_id",
            crop_cycle_id,
        )

    if scan_id:
        query = query.eq(
            "scan_id",
            scan_id,
        )

    response = (
        query
        .order(
            "created_at",
            desc=False,
        )
        .limit(limit)
        .execute()
    )

    return {
        "success": True,
        "farm_id": farm_id,
        "count": len(response.data or []),
        "messages": response.data or [],
    }
