from typing import Optional

from pydantic import BaseModel, Field


class CropScanCreate(BaseModel):
    farm_id: Optional[str] = None
    plot_id: Optional[str] = None
    crop_cycle_id: Optional[str] = None

    image_url: Optional[str] = None

    latitude: Optional[float] = Field(
        default=None,
        ge=-90,
        le=90,
    )

    longitude: Optional[float] = Field(
        default=None,
        ge=-180,
        le=180,
    )


class CropScanResponse(BaseModel):
    success: bool
    message: str
    scan: dict
