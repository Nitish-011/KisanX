"""
Epidemiological Risk Engine — USP 3.

Combines five factors into a single daily crop health score:
  Risk Score = f(Weather, Crop Stage, Variety Susceptibility,
                 Soil Condition, Regional Pest/Disease History)

Output: score 0-100, color code, per-factor breakdown.
"""

from datetime import date, datetime, timedelta
from typing import Any, Optional

from app.services.weather_service import get_weather


# ============================================================
# VARIETY SUSCEPTIBILITY LOOKUP
# ============================================================
# Scale: 0 = resistant, 100 = highly susceptible
# These are real Maharashtra sugarcane & cotton varieties.

VARIETY_SUSCEPTIBILITY: dict[str, dict[str, float]] = {
    # Sugarcane varieties
    "co-86032": {
        "red_rot": 30, "smut": 20, "rust": 40,
        "mosaic": 50, "yellow": 35, "default": 35,
    },
    "co-0238": {
        "red_rot": 70, "smut": 30, "rust": 25,
        "mosaic": 40, "yellow": 30, "default": 40,
    },
    "co-94012": {
        "red_rot": 20, "smut": 25, "rust": 50,
        "mosaic": 45, "yellow": 40, "default": 35,
    },
    "vsi-434": {
        "red_rot": 40, "smut": 35, "rust": 30,
        "mosaic": 50, "yellow": 45, "default": 40,
    },
    # Cotton varieties
    "bt-cotton": {
        "pink_bollworm": 60, "whitefly": 50,
        "default": 50,
    },
}

DEFAULT_SUSCEPTIBILITY = 50.0


# ============================================================
# SOIL RISK LOOKUP
# ============================================================

SOIL_RISK: dict[str, float] = {
    "clay": 60,         # waterlogging risk → wilt
    "loamy": 30,        # well-drained, lower risk
    "sandy": 45,        # drought stress risk
    "black_cotton": 65, # poor drainage
    "red": 40,
    "alluvial": 35,
}

DEFAULT_SOIL_RISK = 40.0


# ============================================================
# CROP STAGE VULNERABILITY
# ============================================================

def get_crop_stage_risk(
    sowing_date: Optional[date],
    crop_name: str = "sugarcane",
) -> tuple[float, str]:
    """
    Return (risk_score, stage_name) based on days since sowing.

    Sugarcane growth stages & peak vulnerability windows:
      - Germination (0-35 days): moderate — settling borer
      - Tillering (36-120 days): HIGH — shoot borer, smut
      - Grand Growth (121-270 days): moderate — red rot, rust
      - Maturity (271+ days): lower — but quality matters
    """

    if not sowing_date:
        return (50.0, "unknown")

    today = date.today()
    days = (today - sowing_date).days

    if days < 0:
        return (20.0, "pre-sowing")

    if crop_name.lower() in ("sugarcane",):
        if days <= 35:
            return (45.0, "germination")
        elif days <= 120:
            return (80.0, "tillering")  # peak vulnerability
        elif days <= 270:
            return (55.0, "grand_growth")
        else:
            return (30.0, "maturity")

    elif crop_name.lower() in ("cotton",):
        if days <= 30:
            return (40.0, "seedling")
        elif days <= 70:
            return (60.0, "squaring")
        elif days <= 120:
            return (85.0, "flowering_boll")  # peak
        else:
            return (35.0, "boll_opening")

    # Fallback
    return (50.0, "unknown")


# ============================================================
# WEATHER RISK (from Open-Meteo data)
# ============================================================

def compute_weather_risk(
    weather_data: dict[str, Any],
) -> float:
    """
    Score 0-100 based on current conditions conducive to
    disease (high humidity + warm temp + recent rain).
    """

    current = weather_data.get("current", {})

    temp = current.get("temperature_2m", 25.0)
    humidity = current.get("relative_humidity_2m", 50.0)
    rain = current.get("rain", 0.0)

    # Ideal disease window: 25-30°C, humidity > 80%, recent rain
    temp_score = 0.0
    if 25 <= temp <= 30:
        temp_score = 100.0
    elif 20 <= temp < 25 or 30 < temp <= 35:
        temp_score = 60.0
    elif 15 <= temp < 20 or 35 < temp <= 40:
        temp_score = 30.0
    else:
        temp_score = 10.0

    humidity_score = min(humidity, 100.0)

    rain_score = min(rain * 10, 100.0)  # cap at 100

    # Weighted combination
    weather_risk = (
        0.35 * temp_score
        + 0.45 * humidity_score
        + 0.20 * rain_score
    )

    return round(min(weather_risk, 100.0), 1)


# ============================================================
# REGIONAL HISTORY RISK
# ============================================================

def compute_history_risk(
    nearby_report_count: int,
) -> float:
    """
    Score based on confirmed reports in the region
    within the last 30 days.

    0 reports → 0, 1-3 → 30, 4-7 → 60, 8+ → 90
    """

    if nearby_report_count == 0:
        return 0.0
    elif nearby_report_count <= 3:
        return 30.0
    elif nearby_report_count <= 7:
        return 60.0
    else:
        return 90.0


# ============================================================
# COLOR CODE
# ============================================================

def score_to_color(score: int) -> str:
    if score <= 25:
        return "green"
    elif score <= 50:
        return "yellow"
    elif score <= 75:
        return "orange"
    else:
        return "red"


# ============================================================
# RECOMMENDATION TEXT
# ============================================================

def score_to_recommendation(score: int, color: str) -> str:

    if color == "green":
        return (
            "Low risk. Continue regular monitoring. "
            "No immediate action needed."
        )
    elif color == "yellow":
        return (
            "Moderate risk. Increase field inspection "
            "frequency. Watch for early symptoms."
        )
    elif color == "orange":
        return (
            "High risk. Start preventive measures. "
            "Consider prophylactic spraying if "
            "symptoms appear. Check trap counts."
        )
    else:
        return (
            "Critical risk. Immediate preventive action "
            "recommended. Consult an agronomist. "
            "Deploy biological and cultural controls."
        )


# ============================================================
# MAIN: COMPUTE RISK SCORE
# ============================================================

async def compute_risk_score(
    crop_cycle: dict[str, Any],
    latitude: float,
    longitude: float,
    nearby_report_count: int = 0,
) -> dict[str, Any]:
    """
    Compute the 5-factor epidemiological risk score
    for a crop cycle.

    Parameters
    ----------
    crop_cycle : dict
        Row from the ``crop_cycles`` table.
    latitude, longitude : float
        Farm GPS coordinates.
    nearby_report_count : int
        Number of confirmed disease reports within ~10 km
        in the last 30 days.

    Returns
    -------
    dict with score, color_code, factors breakdown,
    and recommendation text.
    """

    crop_name = crop_cycle.get("crop_name", "sugarcane")
    variety = (crop_cycle.get("variety") or "").lower().strip()
    soil_type = (crop_cycle.get("soil_type") or "").lower().strip()

    # Parse sowing date
    sowing_date = None
    raw_date = crop_cycle.get("planting_date")
    if raw_date:
        if isinstance(raw_date, str):
            try:
                sowing_date = date.fromisoformat(raw_date)
            except ValueError:
                pass
        elif isinstance(raw_date, (date, datetime)):
            sowing_date = (
                raw_date.date()
                if isinstance(raw_date, datetime)
                else raw_date
            )

    # --- Factor 1: Weather ---
    try:
        weather_data = await get_weather(
            latitude=latitude,
            longitude=longitude,
            forecast_days=1,
        )
        weather_score = compute_weather_risk(weather_data)
    except Exception:
        weather_score = 50.0  # neutral fallback

    # --- Factor 2: Crop stage ---
    stage_score, stage_name = get_crop_stage_risk(
        sowing_date, crop_name,
    )

    # --- Factor 3: Variety susceptibility ---
    variety_data = VARIETY_SUSCEPTIBILITY.get(variety, {})
    variety_score = variety_data.get(
        "default", DEFAULT_SUSCEPTIBILITY,
    )

    # --- Factor 4: Soil ---
    soil_score = SOIL_RISK.get(
        soil_type, DEFAULT_SOIL_RISK,
    )

    # --- Factor 5: Regional history ---
    history_score = compute_history_risk(
        nearby_report_count,
    )

    # --- Weighted aggregate ---
    # Weights: weather 30%, stage 25%, variety 15%,
    #          soil 10%, history 20%
    aggregate = (
        0.30 * weather_score
        + 0.25 * stage_score
        + 0.15 * variety_score
        + 0.10 * soil_score
        + 0.20 * history_score
    )

    score = int(round(min(max(aggregate, 0), 100)))
    color = score_to_color(score)
    recommendation = score_to_recommendation(score, color)

    return {
        "crop_cycle_id": crop_cycle.get("id"),
        "score_date": date.today().isoformat(),
        "score": score,
        "color_code": color,
        "factors": {
            "weather": round(weather_score, 1),
            "crop_stage": round(stage_score, 1),
            "variety": round(variety_score, 1),
            "soil": round(soil_score, 1),
            "regional_history": round(history_score, 1),
        },
        "stage_name": stage_name,
        "recommendation": recommendation,
    }
