"""
Risk Scores route — USP 3 (Epidemiological Risk Forecasting).

GET /api/risk-score/:crop_cycle_id → compute & return risk score
"""

from datetime import date, timedelta
from typing import Optional

from fastapi import (
    APIRouter, Depends, HTTPException, status,
)

from app.dependencies import (
    AuthenticatedUser,
    get_authenticated_user,
    get_supabase,
)
from app.services.risk_engine import compute_risk_score


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/risk-score",
    tags=["Risk Scores"],
)


# ============================================================
# GET /api/risk-score/:crop_cycle_id
# ============================================================

@router.get("/{crop_cycle_id}")
async def get_risk_score(
    crop_cycle_id: str,
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """
    Compute and return the current epidemiological risk score
    for a crop cycle, combining weather, crop stage, variety,
    soil, and regional history.
    """

    supabase = get_supabase()

    # --------------------------------------------------------
    # 1. GET CROP CYCLE + FARM COORDINATES
    # --------------------------------------------------------

    try:
        cycle_response = (
            supabase
            .table("crop_cycles")
            .select("*, plots(*, farms(*))")
            .eq("id", crop_cycle_id)
            .eq("owner_id", user.id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch crop cycle: {str(exc)}",
        )

    if not cycle_response.data:
        raise HTTPException(
            status_code=404,
            detail="Crop cycle not found.",
        )

    crop_cycle = cycle_response.data[0]

    # Extract GPS from plot → farm chain
    plot = crop_cycle.get("plots") or {}
    farm = plot.get("farms") or {}
    latitude = (
        plot.get("latitude")
        or farm.get("latitude")
    )
    longitude = (
        plot.get("longitude")
        or farm.get("longitude")
    )

    if latitude is None or longitude is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "Farm/plot has no GPS coordinates. "
                "Update the farm location first."
            ),
        )

    latitude = float(latitude)
    longitude = float(longitude)

    # --------------------------------------------------------
    # 2. COUNT NEARBY REPORTS (within ~10km, last 30 days)
    # --------------------------------------------------------
    # Supabase doesn't have PostGIS functions via the client,
    # so we do a rough bounding-box filter (~0.1° ≈ 11km).

    cutoff = (
        date.today() - timedelta(days=30)
    ).isoformat()

    try:
        reports_response = (
            supabase
            .table("hotspot_reports")
            .select("id")
            .gte("created_at", cutoff)
            .gte("latitude", latitude - 0.1)
            .lte("latitude", latitude + 0.1)
            .gte("longitude", longitude - 0.1)
            .lte("longitude", longitude + 0.1)
            .execute()
        )
        nearby_count = len(reports_response.data or [])
    except Exception:
        nearby_count = 0

    # --------------------------------------------------------
    # 3. COMPUTE RISK SCORE
    # --------------------------------------------------------

    result = await compute_risk_score(
        crop_cycle=crop_cycle,
        latitude=latitude,
        longitude=longitude,
        nearby_report_count=nearby_count,
    )

    # --------------------------------------------------------
    # 4. CACHE IN DATABASE
    # --------------------------------------------------------

    try:
        supabase.table("risk_scores").upsert({
            "crop_cycle_id": crop_cycle_id,
            "score_date": result["score_date"],
            "score": result["score"],
            "color_code": result["color_code"],
            "factors": result["factors"],
        }).execute()
    except Exception:
        pass  # non-critical — score is returned regardless

    # --------------------------------------------------------
    # 5. RESPONSE
    # --------------------------------------------------------

    return {
        "success": True,
        **result,
    }
