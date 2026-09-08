"""
Marketplace route — USP 8 (CropGuard Mandi).

POST  /api/market/listings        → create listing + quality score
GET   /api/market/listings        → browse (sort: recommended/price/quality)
GET   /api/market/listings/:id    → single listing
PATCH /api/market/listings/:id    → update status
POST  /api/market/orders          → place order (stub)
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
from app.schemas.marketplace import (
    ListingCreate, ListingUpdate, OrderCreate,
)
from app.services.quality_score import compute_quality_score


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/market",
    tags=["Marketplace"],
)


# ============================================================
# POST /api/market/listings — Create Listing
# ============================================================

@router.post("/listings", status_code=201)
def create_listing(
    payload: ListingCreate,
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """
    Create a crop listing on CropGuard Mandi.
    Quality score is auto-computed from the farmer's
    diagnosis history.
    """

    # Compute quality score
    quality_score = compute_quality_score(
        farmer_id=user.id,
        crop_type=payload.crop_type,
    )

    supabase = get_supabase()

    row = {
        "farmer_id": user.id,
        "crop_type": payload.crop_type,
        "variety": payload.variety,
        "grade": payload.grade,
        "quantity": payload.quantity,
        "unit": payload.unit,
        "asking_price": payload.asking_price,
        "quality_score": quality_score,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "district": payload.district,
        "harvest_date": (
            payload.harvest_date.isoformat()
            if payload.harvest_date
            else None
        ),
        "photos": payload.photos or [],
        "status": "active",
    }

    try:
        response = (
            supabase
            .table("market_listings")
            .insert(row)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create listing: {str(exc)}",
        )

    listing = (response.data or [{}])[0]

    return {
        "success": True,
        "listing": listing,
        "quality_score": quality_score,
    }


# ============================================================
# GET /api/market/listings — Browse Listings
# ============================================================

@router.get("/listings")
def browse_listings(
    crop: Optional[str] = Query(default=None),
    district: Optional[str] = Query(default=None),
    sort: str = Query(
        default="recommended",
        pattern="^(recommended|price_asc|price_desc|quality|newest)$",
    ),
    limit: int = Query(default=50, ge=1, le=200),
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """
    Browse active crop listings, filterable by crop and district.

    Sort options:
    - recommended: weighted score (quality + proximity + price)
    - price_asc / price_desc: by asking price
    - quality: by quality score descending
    - newest: by created_at descending
    """

    supabase = get_supabase()

    query = (
        supabase
        .table("market_listings")
        .select("*")
        .eq("status", "active")
        .limit(limit)
    )

    if crop:
        query = query.ilike("crop_type", f"%{crop}%")

    if district:
        query = query.ilike("district", f"%{district}%")

    # Apply sorting
    if sort == "price_asc":
        query = query.order("asking_price", desc=False)
    elif sort == "price_desc":
        query = query.order("asking_price", desc=True)
    elif sort == "quality":
        query = query.order("quality_score", desc=True)
    elif sort == "newest":
        query = query.order("created_at", desc=True)
    else:
        # Recommended: sort by quality score (best proxy)
        # Full weighted scoring would need a DB function
        query = query.order("quality_score", desc=True)

    response = query.execute()

    return {
        "success": True,
        "count": len(response.data or []),
        "listings": response.data or [],
    }


# ============================================================
# GET /api/market/listings/:id — Single Listing
# ============================================================

@router.get("/listings/{listing_id}")
def get_listing(
    listing_id: str,
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    supabase = get_supabase()

    response = (
        supabase
        .table("market_listings")
        .select("*")
        .eq("id", listing_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Listing not found.",
        )

    return {
        "success": True,
        "listing": response.data[0],
    }


# ============================================================
# PATCH /api/market/listings/:id — Update Listing
# ============================================================

@router.patch("/listings/{listing_id}")
def update_listing(
    listing_id: str,
    payload: ListingUpdate,
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """Update listing status or price. Owner only."""

    supabase = get_supabase()

    # Verify ownership
    existing = (
        supabase
        .table("market_listings")
        .select("id")
        .eq("id", listing_id)
        .eq("farmer_id", user.id)
        .limit(1)
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=404,
            detail="Listing not found or not yours.",
        )

    update_data = {}
    if payload.status:
        update_data["status"] = payload.status
    if payload.asking_price:
        update_data["asking_price"] = payload.asking_price
    if payload.quantity:
        update_data["quantity"] = payload.quantity

    if not update_data:
        raise HTTPException(
            status_code=400,
            detail="No fields to update.",
        )

    try:
        response = (
            supabase
            .table("market_listings")
            .update(update_data)
            .eq("id", listing_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Update failed: {str(exc)}",
        )

    return {
        "success": True,
        "listing": (response.data or [{}])[0],
    }


# ============================================================
# POST /api/market/orders — Place Order (stub)
# ============================================================

@router.post("/orders", status_code=201)
def create_order(
    payload: OrderCreate,
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """
    Place an order. Stub — no payment processing yet.
    Just records the order intent.
    """

    supabase = get_supabase()

    # Get listing price
    listing_response = (
        supabase
        .table("market_listings")
        .select("asking_price, status")
        .eq("id", payload.listing_id)
        .limit(1)
        .execute()
    )

    if not listing_response.data:
        raise HTTPException(
            status_code=404,
            detail="Listing not found.",
        )

    listing = listing_response.data[0]

    if listing.get("status") != "active":
        raise HTTPException(
            status_code=400,
            detail="This listing is no longer active.",
        )

    total_price = listing["asking_price"] * payload.quantity

    row = {
        "order_type": payload.order_type,
        "buyer_id": user.id,
        "listing_id": payload.listing_id,
        "quantity": payload.quantity,
        "total_price": total_price,
        "status": "pending",
        "payment_status": "unpaid",
    }

    try:
        response = (
            supabase
            .table("orders")
            .insert(row)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create order: {str(exc)}",
        )

    return {
        "success": True,
        "order": (response.data or [{}])[0],
        "message": (
            "Order placed. Payment integration "
            "coming soon."
        ),
    }
