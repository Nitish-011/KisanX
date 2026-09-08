"""
Input Marketplace route — USP 9 (Verified & Cheaper Inputs).

GET  /api/inputs/products               → browse products
GET  /api/inputs/products/:id/sellers    → sellers + prices
POST /api/inputs/sellers                 → register as seller
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
from app.schemas.input_market import SellerCreate


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/inputs",
    tags=["Input Marketplace"],
)


# ============================================================
# GET /api/inputs/products — Browse Products
# ============================================================

@router.get("/products")
def browse_products(
    category: Optional[str] = Query(default=None),
    active_ingredient: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """Browse verified input products (pesticides, fungicides, etc.)."""

    supabase = get_supabase()

    query = (
        supabase
        .table("input_products")
        .select("*")
        .limit(limit)
    )

    if category:
        query = query.eq("category", category)

    if active_ingredient:
        query = query.ilike(
            "active_ingredient",
            f"%{active_ingredient}%",
        )

    if search:
        query = query.ilike("name", f"%{search}%")

    query = query.order("name", desc=False)

    response = query.execute()

    return {
        "success": True,
        "count": len(response.data or []),
        "products": response.data or [],
    }


# ============================================================
# GET /api/inputs/products/:id/sellers — Sellers + Prices
# ============================================================

@router.get("/products/{product_id}/sellers")
def get_product_sellers(
    product_id: str,
    verified_only: bool = Query(default=True),
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """
    Get verified sellers and their prices for a specific product.
    Sorted by price (cheapest first) — lets farmers compare.
    """

    supabase = get_supabase()

    # Get the product
    prod_response = (
        supabase
        .table("input_products")
        .select("*")
        .eq("id", product_id)
        .limit(1)
        .execute()
    )

    if not prod_response.data:
        raise HTTPException(
            status_code=404,
            detail="Product not found.",
        )

    product = prod_response.data[0]

    # Get input listings for this product
    listings_response = (
        supabase
        .table("input_listings")
        .select("*, sellers(*)")
        .eq("product_id", product_id)
        .order("price", desc=False)
        .execute()
    )

    listings = listings_response.data or []

    # Filter by verification status if requested
    if verified_only:
        listings = [
            l for l in listings
            if (l.get("sellers") or {}).get(
                "verified_status"
            ) == "verified"
        ]

    # Flatten for cleaner response
    result = []
    for listing in listings:
        seller = listing.get("sellers") or {}
        result.append({
            "listing_id": listing.get("id"),
            "seller_id": listing.get("seller_id"),
            "seller_name": seller.get("name"),
            "seller_verified": seller.get("verified_status"),
            "seller_district": seller.get("district"),
            "price": listing.get("price"),
            "stock": listing.get("stock"),
            "unit": listing.get("unit"),
        })

    return {
        "success": True,
        "product": product,
        "seller_count": len(result),
        "sellers": result,
    }


# ============================================================
# POST /api/inputs/sellers — Register as Seller
# ============================================================

@router.post("/sellers", status_code=201)
def register_seller(
    payload: SellerCreate,
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """
    Register as an input seller.
    Starts in 'pending' verification status.
    """

    supabase = get_supabase()

    row = {
        "user_id": user.id,
        "name": payload.name,
        "license_no": payload.license_no,
        "cib_registration_ref": payload.cib_registration_ref,
        "district": payload.district,
        "phone": payload.phone,
        "verified_status": "pending",
    }

    try:
        response = (
            supabase
            .table("sellers")
            .insert(row)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to register seller: {str(exc)}",
        )

    return {
        "success": True,
        "seller": (response.data or [{}])[0],
        "message": (
            "Seller registered. Verification is pending."
        ),
    }
