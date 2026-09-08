"""
Input Marketplace schemas — USP 9 (Verified & Cheaper Inputs).
"""

from typing import Optional

from pydantic import BaseModel, Field


# ============================================================
# SELLER
# ============================================================

class SellerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    license_no: str = Field(min_length=1, max_length=100)
    cib_registration_ref: Optional[str] = Field(
        default=None, max_length=100,
    )
    district: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=15)


class SellerResponse(BaseModel):
    id: str
    name: str
    license_no: str
    cib_registration_ref: Optional[str] = None
    verified_status: str = "pending"
    district: Optional[str] = None
    phone: Optional[str] = None
    created_at: Optional[str] = None


# ============================================================
# INPUT PRODUCT
# ============================================================

class InputProductResponse(BaseModel):
    id: str
    name: str
    active_ingredient: str
    cib_registration_no: Optional[str] = None
    category: str = "pesticide"


# ============================================================
# INPUT LISTING (seller's price for a product)
# ============================================================

class InputListingResponse(BaseModel):
    id: str
    seller_id: str
    seller_name: Optional[str] = None
    seller_verified: Optional[str] = None
    product_id: str
    product_name: Optional[str] = None
    price: float
    stock: int = 0
    unit: str = "unit"
