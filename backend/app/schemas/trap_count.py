"""
Trap Count schemas — USP 2 (Trap Photo Counter + ETL).
"""

from typing import Optional

from pydantic import BaseModel, Field


# ============================================================
# RESPONSE
# ============================================================

class TrapCountResponse(BaseModel):
    id: str
    crop_cycle_id: Optional[str] = None
    photo_url: str
    pest_species: str
    count: int = 0
    etl_threshold: int
    action_needed: bool = False
    resistance_flag: bool = False
    recommendation: Optional[str] = None
    created_at: Optional[str] = None
