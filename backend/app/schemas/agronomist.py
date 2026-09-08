"""
Agronomist + Consultation schemas — USP 10 (Ask-an-Agronomist).
"""

from typing import Optional

from pydantic import BaseModel, Field


# ============================================================
# AGRONOMIST
# ============================================================

class AgronomistResponse(BaseModel):
    id: str
    name: str
    credentials: Optional[str] = None
    kvk_affiliation: Optional[str] = None
    specialisation: Optional[str] = None
    rating: float = 0.0
    total_sessions: int = 0
    availability: bool = True
    fee_per_session: float = 30.0


# ============================================================
# CONSULTATION CREATE
# ============================================================

class ConsultationCreate(BaseModel):
    agronomist_id: str
    diagnosis_id: Optional[str] = None
    channel: str = Field(
        default="chat",
        pattern="^(chat|voice|video)$",
    )


# ============================================================
# CONSULTATION RESPONSE
# ============================================================

class ConsultationResponse(BaseModel):
    id: str
    farmer_id: str
    agronomist_id: str
    diagnosis_id: Optional[str] = None
    channel: str = "chat"
    fee: float = 30.0
    status: str = "pending"
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ============================================================
# CONSULTATION STATUS UPDATE
# ============================================================

class ConsultationUpdate(BaseModel):
    status: str = Field(
        pattern="^(accepted|in_progress|completed|cancelled)$",
    )
    notes: Optional[str] = None
