"""
Marketplace schemas — USP 8 (CropGuard Mandi).
"""

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


# ============================================================
# LISTING CREATE
# ============================================================

class ListingCreate(BaseModel):
    crop_type: str = Field(min_length=1, max_length=100)
    variety: Optional[str] = Field(default=None, max_length=100)
    grade: Optional[str] = Field(default=None, max_length=50)
    quantity: float = Field(gt=0)
    unit: str = Field(default="quintal", max_length=30)
    asking_price: float = Field(gt=0)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    district: Optional[str] = Field(default=None, max_length=100)
    harvest_date: Optional[date] = None
    photos: Optional[list[str]] = None


# ============================================================
# LISTING UPDATE
# ============================================================

class ListingUpdate(BaseModel):
    status: Optional[str] = Field(
        default=None,
        pattern="^(active|sold|withdrawn|expired)$",
    )
    asking_price: Optional[float] = Field(default=None, gt=0)
    quantity: Optional[float] = Field(default=None, gt=0)


# ============================================================
# LISTING RESPONSE
# ============================================================

class ListingResponse(BaseModel):
    id: str
    farmer_id: str
    crop_type: str
    variety: Optional[str] = None
    grade: Optional[str] = None
    quantity: float
    unit: str = "quintal"
    asking_price: float
    quality_score: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    district: Optional[str] = None
    harvest_date: Optional[date] = None
    photos: Optional[list[str]] = None
    status: str = "active"
    created_at: Optional[str] = None


# ============================================================
# ORDER CREATE (stub — no payment yet)
# ============================================================

class OrderCreate(BaseModel):
    order_type: str = Field(
        pattern="^(crop|input)$",
    )
    listing_id: str
    quantity: float = Field(gt=0, default=1)


# ============================================================
# ORDER RESPONSE
# ============================================================

class OrderResponse(BaseModel):
    id: str
    order_type: str
    buyer_id: str
    listing_id: str
    quantity: float
    total_price: float
    status: str = "pending"
    payment_status: str = "unpaid"
    created_at: Optional[str] = None
