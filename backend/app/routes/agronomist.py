"""
Agronomist route — USP 10 (Ask-an-Agronomist).

GET   /api/agronomists              → list available agronomists
POST  /api/consultations            → book a session
GET   /api/consultations/:id        → session status
PATCH /api/consultations/:id        → update status
"""

from typing import Optional

from fastapi import (
    APIRouter, Depends, HTTPException, Query, status,
)

from app.dependencies import (
    AuthenticatedUser,
    get_authenticated_user,
    get_supabase,
)
from app.schemas.agronomist import (
    ConsultationCreate,
    ConsultationUpdate,
)


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api",
    tags=["Agronomist"],
)


# ============================================================
# GET /api/agronomists — List Available
# ============================================================

@router.get("/agronomists")
def list_agronomists(
    available: bool = Query(default=True),
    specialisation: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """List available agronomists for consultation."""

    supabase = get_supabase()

    query = (
        supabase
        .table("agronomists")
        .select("*")
        .limit(limit)
    )

    if available:
        query = query.eq("availability", True)

    if specialisation:
        query = query.ilike(
            "specialisation",
            f"%{specialisation}%",
        )

    query = query.order("rating", desc=True)

    response = query.execute()

    return {
        "success": True,
        "count": len(response.data or []),
        "agronomists": response.data or [],
    }


# ============================================================
# POST /api/consultations — Book Session
# ============================================================

@router.post("/consultations", status_code=201)
def create_consultation(
    payload: ConsultationCreate,
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """
    Book a consultation session with an agronomist.
    Fee is currently stubbed (no payment processing).
    """

    supabase = get_supabase()

    # Verify agronomist exists and is available
    agro_response = (
        supabase
        .table("agronomists")
        .select("id, name, fee_per_session, availability")
        .eq("id", payload.agronomist_id)
        .limit(1)
        .execute()
    )

    if not agro_response.data:
        raise HTTPException(
            status_code=404,
            detail="Agronomist not found.",
        )

    agronomist = agro_response.data[0]

    if not agronomist.get("availability"):
        raise HTTPException(
            status_code=400,
            detail="This agronomist is not currently available.",
        )

    fee = agronomist.get("fee_per_session", 30.0)

    row = {
        "farmer_id": user.id,
        "agronomist_id": payload.agronomist_id,
        "diagnosis_id": payload.diagnosis_id,
        "channel": payload.channel,
        "fee": fee,
        "status": "pending",
    }

    try:
        response = (
            supabase
            .table("consultation_sessions")
            .insert(row)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to book consultation: {str(exc)}",
        )

    session = (response.data or [{}])[0]

    return {
        "success": True,
        "consultation": session,
        "agronomist_name": agronomist.get("name"),
        "fee": fee,
        "message": (
            f"Consultation booked with "
            f"{agronomist.get('name')}. "
            f"Fee: ₹{fee}. Payment integration coming soon."
        ),
    }


# ============================================================
# GET /api/consultations/:id — Session Status
# ============================================================

@router.get("/consultations/{session_id}")
def get_consultation(
    session_id: str,
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    supabase = get_supabase()

    response = (
        supabase
        .table("consultation_sessions")
        .select("*, agronomists(*)")
        .eq("id", session_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Consultation session not found.",
        )

    session = response.data[0]

    # Verify the user is the farmer or the agronomist
    agronomist = session.get("agronomists") or {}
    if (
        session.get("farmer_id") != user.id
        and agronomist.get("user_id") != user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this session.",
        )

    return {
        "success": True,
        "consultation": session,
    }


# ============================================================
# PATCH /api/consultations/:id — Update Status
# ============================================================

@router.patch("/consultations/{session_id}")
def update_consultation(
    session_id: str,
    payload: ConsultationUpdate,
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """Update consultation status (accepted, completed, etc.)."""

    supabase = get_supabase()

    # Verify session exists
    existing = (
        supabase
        .table("consultation_sessions")
        .select("id, farmer_id, agronomist_id")
        .eq("id", session_id)
        .limit(1)
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=404,
            detail="Consultation session not found.",
        )

    update_data = {"status": payload.status}
    if payload.notes is not None:
        update_data["notes"] = payload.notes

    try:
        response = (
            supabase
            .table("consultation_sessions")
            .update(update_data)
            .eq("id", session_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Update failed: {str(exc)}",
        )

    # If completed, increment agronomist's session count
    if payload.status == "completed":
        try:
            session = existing.data[0]
            agro_id = session.get("agronomist_id")
            agro_response = (
                supabase
                .table("agronomists")
                .select("total_sessions")
                .eq("id", agro_id)
                .limit(1)
                .execute()
            )
            if agro_response.data:
                current = agro_response.data[0].get(
                    "total_sessions", 0,
                )
                supabase.table("agronomists").update({
                    "total_sessions": current + 1,
                }).eq("id", agro_id).execute()
        except Exception:
            pass  # non-critical

    return {
        "success": True,
        "consultation": (response.data or [{}])[0],
    }
