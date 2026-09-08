"""
Feedback route — USP 7 (Active Learning from Field Confirmations).

POST /api/feedback               → farmer confirms/rejects outcome
GET  /api/feedback/:diagnosis_id → get feedback for a diagnosis
"""

from fastapi import (
    APIRouter, Depends, HTTPException, status,
)

from app.dependencies import (
    AuthenticatedUser,
    get_authenticated_user,
    get_supabase,
)
from app.schemas.feedback import FeedbackCreate


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/feedback",
    tags=["Feedback"],
)


# ============================================================
# POST /api/feedback — Submit Feedback
# ============================================================

@router.post("", status_code=201)
def submit_feedback(
    payload: FeedbackCreate,
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """
    Farmer confirms or rejects a diagnosis outcome.

    outcome = 'yes'     → treatment worked
    outcome = 'partial' → partially worked
    outcome = 'no'      → didn't work → flag for retraining
                           + offer agronomist escalation

    This powers the active learning feedback loop:
    - 'no' outcomes flag the original diagnosis image
      for expert re-labeling and model retraining.
    """

    supabase = get_supabase()

    # Verify the diagnosis exists and belongs to this user
    diag_response = (
        supabase
        .table("diagnoses")
        .select("id, disease, photo_url")
        .eq("id", payload.diagnosis_id)
        .eq("owner_id", user.id)
        .limit(1)
        .execute()
    )

    if not diag_response.data:
        raise HTTPException(
            status_code=404,
            detail="Diagnosis not found.",
        )

    # Flag for retraining if outcome is negative
    flagged = payload.outcome == "no"

    row = {
        "diagnosis_id": payload.diagnosis_id,
        "farmer_id": user.id,
        "outcome": payload.outcome,
        "comment": payload.comment,
        "flagged_for_retraining": flagged,
    }

    try:
        response = (
            supabase
            .table("feedback")
            .insert(row)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save feedback: {str(exc)}",
        )

    feedback = (response.data or [{}])[0]

    # Build response with escalation suggestion if needed
    result = {
        "success": True,
        "feedback": feedback,
    }

    if flagged:
        result["escalation"] = {
            "suggested": True,
            "message": (
                "The diagnosis has been flagged for review. "
                "Would you like to consult an agronomist? "
                "Sessions start at ₹30."
            ),
            "action": "POST /api/consultations",
        }
        result["retraining"] = {
            "flagged": True,
            "message": (
                "This image has been queued for expert "
                "re-labeling to improve future predictions."
            ),
        }
    elif payload.outcome == "partial":
        result["follow_up"] = {
            "message": (
                "Partial improvement noted. Consider a "
                "follow-up scan in 3-5 days to track "
                "progression."
            ),
        }
    else:
        result["message"] = (
            "Great! Treatment confirmed as effective. "
            "Your feedback helps improve CropGuard for "
            "all farmers."
        )

    return result


# ============================================================
# GET /api/feedback/:diagnosis_id — Get Feedback
# ============================================================

@router.get("/{diagnosis_id}")
def get_feedback(
    diagnosis_id: str,
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    supabase = get_supabase()

    response = (
        supabase
        .table("feedback")
        .select("*")
        .eq("diagnosis_id", diagnosis_id)
        .eq("farmer_id", user.id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    return {
        "success": True,
        "diagnosis_id": diagnosis_id,
        "count": len(response.data or []),
        "feedback": response.data or [],
    }
