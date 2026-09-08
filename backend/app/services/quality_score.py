"""
Quality Score computation — USP 8 (CropGuard Mandi).

QualityScore = f(disease_free_days, confirmed_treatments_resolved,
                 phi_compliance_flag) → 0–100

Queries the farmer's diagnosis history for the relevant crop
to compute a trust signal for marketplace buyers.
"""

from datetime import date, timedelta
from typing import Any

from app.dependencies import get_supabase


# ============================================================
# COMPUTE QUALITY SCORE
# ============================================================

def compute_quality_score(
    farmer_id: str,
    crop_type: str,
) -> int:
    """
    Compute a 0-100 quality score for a farmer's crop
    based on their diagnosis and treatment history.

    Factors (each scaled 0-100, then weighted):
      - Disease-free days ratio       (40%)
      - Treatment resolution rate     (35%)
      - PHI compliance               (25%)
    """

    supabase = get_supabase()

    # ---------------------------------------------------------
    # 1. Fetch recent diagnoses for this farmer + crop type
    # ---------------------------------------------------------

    lookback_days = 180  # 6 months
    cutoff = (
        date.today() - timedelta(days=lookback_days)
    ).isoformat()

    try:
        # Get diagnoses via crop_scans joined info
        response = (
            supabase
            .table("diagnoses")
            .select("id, disease, severity_stage, status, created_at")
            .eq("owner_id", farmer_id)
            .gte("created_at", cutoff)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        diagnoses = response.data or []
    except Exception:
        diagnoses = []

    # ---------------------------------------------------------
    # 2. Disease-free days ratio
    # ---------------------------------------------------------

    total_days = lookback_days
    disease_days = len([
        d for d in diagnoses
        if d.get("disease", "").lower() != "healthy"
    ]) * 5  # assume each diagnosis affects ~5 days

    disease_free_days = max(total_days - disease_days, 0)
    disease_free_ratio = disease_free_days / total_days
    disease_free_score = min(disease_free_ratio * 100, 100)

    # ---------------------------------------------------------
    # 3. Treatment resolution rate
    # ---------------------------------------------------------
    # Check feedback for resolved treatments

    diagnosis_ids = [d["id"] for d in diagnoses if d.get("id")]

    resolved_count = 0
    total_treated = 0

    if diagnosis_ids:
        try:
            # Check how many have positive feedback
            for diag_id in diagnosis_ids[:20]:  # limit queries
                fb_response = (
                    supabase
                    .table("feedback")
                    .select("outcome")
                    .eq("diagnosis_id", diag_id)
                    .limit(1)
                    .execute()
                )
                fb = fb_response.data or []
                if fb:
                    total_treated += 1
                    if fb[0].get("outcome") in ("yes", "partial"):
                        resolved_count += 1
        except Exception:
            pass

    if total_treated > 0:
        resolution_score = (resolved_count / total_treated) * 100
    else:
        # No feedback yet → neutral score
        resolution_score = 60.0

    # ---------------------------------------------------------
    # 4. PHI compliance (simplified)
    # ---------------------------------------------------------
    # If no severe non-compliant flags exist, assume compliant.
    # In production this would check prescription.phi_days
    # against actual harvest dates.

    phi_score = 80.0  # default: mostly compliant

    # Check for any recent severe diagnoses that weren't resolved
    unresolved_severe = [
        d for d in diagnoses
        if (
            d.get("severity_stage", 0) or 0
        ) >= 3
        and d.get("status") == "auto"
    ]

    if unresolved_severe:
        # Penalty for unresolved severe cases
        phi_score = max(
            80.0 - (len(unresolved_severe) * 15),
            20.0,
        )

    # ---------------------------------------------------------
    # 5. Weighted aggregate
    # ---------------------------------------------------------

    quality_score = int(round(
        0.40 * disease_free_score
        + 0.35 * resolution_score
        + 0.25 * phi_score
    ))

    return max(0, min(quality_score, 100))
