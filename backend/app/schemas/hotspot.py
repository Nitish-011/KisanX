"""
Hotspot Report schemas — USP 4 (Pest Migration Corridors).
"""

from typing import Optional

from pydantic import BaseModel, Field


# ============================================================
# CREATE
# ============================================================

class HotspotCreate(BaseModel):
    diagnosis_id: Optional[str] = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    disease: str
    confirmed_by: str = Field(
        default="farmer",
        pattern="^(farmer|expert)$",
    )


# ============================================================
# RESPONSE
# ============================================================

class HotspotResponse(BaseModel):
    id: str
    diagnosis_id: Optional[str] = None
    latitude: float
    longitude: float
    disease: str
    confirmed_by: str
    created_at: Optional[str] = None


# ============================================================
# MAP QUERY
# ============================================================

class HotspotMapQuery(BaseModel):
    """Query parameters for the hotspot map endpoint."""
    district: Optional[str] = None
    disease: Optional[str] = None
    days: int = Field(default=30, ge=1, le=365)
