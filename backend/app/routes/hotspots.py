"""
Hotspot Reports route — USP 4 (Pest Migration Corridors).

POST /api/hotspot-reports  → log a confirmed case
GET  /api/hotspots         → query map data by district/disease
"""

from datetime import date, timedelta
from typing import Optional

from fastapi import (
    APIRouter, Depends, HTTPException, Query, status,
)

from app.dependencies import (
    AuthenticatedUser,
    get_authenticated_user,
    get_supabase,
)
from app.schemas.hotspot import HotspotCreate


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api",
    tags=["Hotspots"],
)


# ============================================================
# POST /api/hotspot-reports — Log Confirmed Case
# ============================================================

@router.post("/hotspot-reports", status_code=201)
def create_hotspot(
    payload: HotspotCreate,
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """Log a confirmed disease case for the heatmap."""

    supabase = get_supabase()

    row = {
        "owner_id": user.id,
        "diagnosis_id": payload.diagnosis_id,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "disease": payload.disease,
        "confirmed_by": payload.confirmed_by,
    }

    try:
        response = (
            supabase
            .table("hotspot_reports")
            .insert(row)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save hotspot: {str(exc)}",
        )

    return {
        "success": True,
        "hotspot": (response.data or [{}])[0],
    }


# ============================================================
# GET /api/hotspots — Map Data Query
# ============================================================

@router.get("/hotspots")
def get_hotspots(
    disease: Optional[str] = Query(default=None),
    district: Optional[str] = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=500, ge=1, le=2000),
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """
    Query hotspot data for map rendering.

    Returns geo-coded disease reports for the specified
    time window, optionally filtered by disease and district.
    """

    supabase = get_supabase()

    cutoff = (
        date.today() - timedelta(days=days)
    ).isoformat()

    query = (
        supabase
        .table("hotspot_reports")
        .select("id, latitude, longitude, disease, confirmed_by, created_at")
        .gte("created_at", cutoff)
        .order("created_at", desc=True)
        .limit(limit)
    )

    if disease:
        query = query.eq("disease", disease)

    response = query.execute()
    reports = response.data or []

    # --------------------------------------------------------
    # Build summary stats for the frontend
    # --------------------------------------------------------

    disease_counts: dict[str, int] = {}
    for r in reports:
        d = r.get("disease", "unknown")
        disease_counts[d] = disease_counts.get(d, 0) + 1

    return {
        "success": True,
        "count": len(reports),
        "time_window_days": days,
        "disease_summary": disease_counts,
        "reports": reports,
    }
