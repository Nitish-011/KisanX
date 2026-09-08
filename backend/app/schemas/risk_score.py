"""
Risk Score schemas — USP 3 (Epidemiological Risk Forecasting).
"""

from typing import Optional

from pydantic import BaseModel, Field


# ============================================================
# FACTOR BREAKDOWN
# ============================================================

class RiskFactors(BaseModel):
    weather: float = Field(
        0.0, ge=0, le=100,
        description="Weather risk contribution (0-100)",
    )
    crop_stage: float = Field(
        0.0, ge=0, le=100,
        description="Crop-stage vulnerability (0-100)",
    )
    variety: float = Field(
        0.0, ge=0, le=100,
        description="Variety susceptibility (0-100)",
    )
    soil: float = Field(
        0.0, ge=0, le=100,
        description="Soil condition risk (0-100)",
    )
    regional_history: float = Field(
        0.0, ge=0, le=100,
        description="Nearby outbreak history (0-100)",
    )


# ============================================================
# RESPONSE
# ============================================================

class RiskScoreResponse(BaseModel):
    crop_cycle_id: str
    score_date: str
    score: int = Field(ge=0, le=100)
    color_code: str = Field(
        description="green | yellow | orange | red",
    )
    factors: RiskFactors
    recommendation: Optional[str] = None
