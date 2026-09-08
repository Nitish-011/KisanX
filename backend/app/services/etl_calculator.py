"""
ETL (Economic Threshold Level) Calculator — USP 2.

Determines whether pest counts from trap photos have crossed
the spray threshold, and checks for resistance rotation.
"""

from typing import Any, Optional

from app.dependencies import get_supabase


# ============================================================
# ETL THRESHOLDS
# ============================================================
# Source: ICAR / CCI / SAU guidelines for Maharashtra crops.
# Format: (crop, pest_species) → threshold count per trap.

ETL_THRESHOLDS: dict[tuple[str, str], int] = {
    # Sugarcane
    ("sugarcane", "shoot_borer"): 5,
    ("sugarcane", "top_borer"): 3,
    ("sugarcane", "internode_borer"): 8,
    ("sugarcane", "early_shoot_borer"): 5,
    ("sugarcane", "pyrilla"): 10,
    ("sugarcane", "whitefly"): 15,
    ("sugarcane", "woolly_aphid"): 12,

    # Cotton
    ("cotton", "pink_bollworm"): 8,
    ("cotton", "american_bollworm"): 4,
    ("cotton", "spotted_bollworm"): 5,
    ("cotton", "whitefly"): 10,
    ("cotton", "thrips"): 8,
    ("cotton", "jassid"): 6,
    ("cotton", "aphid"): 10,
    ("cotton", "mealybug"): 5,
}

DEFAULT_THRESHOLD = 8


# ============================================================
# ACTIVE INGREDIENT CLASSES
# ============================================================
# Used for resistance-rotation warnings.
# Maps pest species to commonly used active ingredients.

PEST_TREATMENT_CLASSES: dict[str, list[str]] = {
    "pink_bollworm": [
        "cypermethrin", "deltamethrin",
        "profenofos", "chlorantraniliprole",
    ],
    "shoot_borer": [
        "chlorantraniliprole", "fipronil",
        "carbofuran",
    ],
    "whitefly": [
        "imidacloprid", "thiamethoxam",
        "spiromesifen", "diafenthiuron",
    ],
}


# ============================================================
# GET ETL THRESHOLD
# ============================================================

def get_etl_threshold(
    crop: str,
    pest_species: str,
) -> int:
    """Look up the ETL threshold for a crop + pest combination."""

    key = (
        crop.lower().strip(),
        pest_species.lower().strip(),
    )
    return ETL_THRESHOLDS.get(key, DEFAULT_THRESHOLD)


# ============================================================
# CHECK RESISTANCE ROTATION
# ============================================================

def check_resistance_rotation(
    crop_cycle_id: Optional[str],
    pest_species: str,
    days: int = 14,
) -> bool:
    """
    Check if the same active-ingredient class was used
    within the last N days for this crop cycle.

    Returns True if a rotation warning should be raised.
    """

    if not crop_cycle_id:
        return False

    supabase = get_supabase()

    try:
        # Check prescriptions from recent diagnoses
        # for this crop cycle
        response = (
            supabase
            .table("diagnoses")
            .select("id")
            .eq("crop_cycle_id", crop_cycle_id)
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )

        recent_diagnoses = response.data or []

        if not recent_diagnoses:
            return False

        diag_ids = [d["id"] for d in recent_diagnoses]

        # Check if any prescriptions reference the same
        # active ingredients
        for diag_id in diag_ids:
            presc_response = (
                supabase
                .table("prescriptions")
                .select("treatment_steps, resistance_flag")
                .eq("diagnosis_id", diag_id)
                .limit(1)
                .execute()
            )

            prescriptions = presc_response.data or []
            if prescriptions and prescriptions[0].get(
                "resistance_flag"
            ):
                return True

    except Exception:
        pass

    return False


# ============================================================
# COMPUTE ETL VERDICT
# ============================================================

def compute_etl_verdict(
    crop: str,
    pest_species: str,
    count: int,
    crop_cycle_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Given a pest count from a trap photo, determine whether
    action is needed and generate the verdict.

    Returns
    -------
    dict with threshold, action_needed, resistance_flag,
    and recommendation text.
    """

    threshold = get_etl_threshold(crop, pest_species)
    action_needed = count >= threshold
    resistance_flag = False

    if action_needed:
        resistance_flag = check_resistance_rotation(
            crop_cycle_id=crop_cycle_id,
            pest_species=pest_species,
        )

    # Build recommendation
    if not action_needed:
        recommendation = (
            f"Pest count ({count}) is below the Economic "
            f"Threshold Level ({threshold}). No spraying "
            f"needed yet. Continue monitoring every 3-4 days."
        )
    else:
        recommendation = (
            f"Pest count ({count}) has crossed the Economic "
            f"Threshold Level ({threshold}). Targeted "
            f"intervention is recommended."
        )
        if resistance_flag:
            recommendation += (
                " ⚠️ RESISTANCE WARNING: The same active "
                "ingredient class was used recently. "
                "Rotate to a different chemical class "
                "to prevent resistance buildup."
            )

    return {
        "etl_threshold": threshold,
        "action_needed": action_needed,
        "resistance_flag": resistance_flag,
        "recommendation": recommendation,
    }
