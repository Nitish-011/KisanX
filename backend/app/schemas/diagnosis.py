"""
Diagnosis + Prescription schemas — USP 1 & 5.
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# ============================================================
# DIAGNOSIS
# ============================================================

class DiagnosisResponse(BaseModel):
    id: str
    crop_cycle_id: Optional[str] = None
    scan_id: Optional[str] = None
    photo_url: str
    disease: str
    severity_stage: Optional[int] = Field(
        default=None, ge=1, le=4,
    )
    confidence: Optional[float] = None
    status: str = "auto"
    created_at: Optional[str] = None


# ============================================================
# TREATMENT STEP (inside prescription)
# ============================================================

class TreatmentStep(BaseModel):
    type: str = Field(
        description="immediate | biological | cultural",
    )
    description: str
    product: Optional[str] = None
    dosage: Optional[str] = None
    safety_level: Optional[str] = None
    phi_days: Optional[int] = None
    cost_per_acre: Optional[float] = None
    resistance_check: Optional[str] = None


# ============================================================
# PRESCRIPTION
# ============================================================

class PrescriptionResponse(BaseModel):
    id: str
    diagnosis_id: str
    treatment_steps: list[TreatmentStep] = []
    phi_days: Optional[int] = None
    resistance_flag: bool = False
    cost_estimate: Optional[float] = None
    expected_recovery_pct: Optional[float] = None
    recheck_date: Optional[date] = None
    created_at: Optional[str] = None


# ============================================================
# COMBINED RESPONSE
# ============================================================

class DiagnosisWithPrescription(BaseModel):
    diagnosis: DiagnosisResponse
    prescription: Optional[PrescriptionResponse] = None
    advisory: Optional[dict] = None
