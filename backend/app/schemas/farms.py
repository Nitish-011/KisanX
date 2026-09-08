from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class FarmCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    village: Optional[str] = Field(default=None, max_length=100)
    district: Optional[str] = Field(default=None, max_length=100)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    area_acres: float = Field(gt=0, le=100000)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return value.strip()


class PlotCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    area_acres: float = Field(gt=0, le=100000)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    boundary: Optional[dict] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return value.strip()


class CropCycleCreate(BaseModel):
    crop_name: str = Field(
        min_length=2,
        max_length=100,
    )
    variety: Optional[str] = Field(default=None, max_length=100)
    crop_stage: Optional[str] = Field(default=None, max_length=100)
    planting_date: Optional[date] = None
    soil_type: Optional[str] = Field(default=None, max_length=100)


class FarmRegistrationRequest(BaseModel):
    farm: FarmCreate
    plot: PlotCreate
    crop_cycle: CropCycleCreate
