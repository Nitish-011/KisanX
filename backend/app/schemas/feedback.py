"""
Feedback schemas — USP 7 (Active Learning from Field Confirmations).
"""

from typing import Optional

from pydantic import BaseModel, Field


# ============================================================
# CREATE
# ============================================================

class FeedbackCreate(BaseModel):
    diagnosis_id: str
    outcome: str = Field(
        pattern="^(yes|no|partial)$",
        description="Did the treatment work? yes | no | partial",
    )
    comment: Optional[str] = Field(
        default=None, max_length=1000,
    )


# ============================================================
# RESPONSE
# ============================================================

class FeedbackResponse(BaseModel):
    id: str
    diagnosis_id: str
    farmer_id: str
    outcome: str
    comment: Optional[str] = None
    flagged_for_retraining: bool = False
    created_at: Optional[str] = None
