from typing import Any, Dict, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from supabase import Client

from app.config import settings
from app.services.supabase_service import (
    get_server_supabase,
)
from app.services.weather_service import (
    get_farm_weather,
)


router = APIRouter(
    prefix="/api/weather",
    tags=["Weather"],
)


from app.dependencies import get_authenticated_user, AuthenticatedUser
from app.services.weather_service import get_weather


@router.get("", summary="Get current weather and spray feasibility")
@router.get("/current", summary="Get current weather and spray feasibility")
async def get_current_weather(
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    supabase: Client = Depends(get_server_supabase),
):
    """
    Get current weather and 7-day forecast for coordinates or farmer's primary farm,
    including real-time agricultural spray feasibility advisory.
    """
    user_id = user.id if hasattr(user, "id") else user.get("id")

    if lat is None or lon is None:
        try:
            farms_res = (
                supabase
                .table("farms")
                .select("latitude, longitude, name, district")
                .eq("owner_id", user_id)
                .not_.is_("latitude", "null")
                .limit(1)
                .execute()
            )
            if farms_res.data and len(farms_res.data) > 0:
                lat = float(farms_res.data[0]["latitude"])
                lon = float(farms_res.data[0]["longitude"])
            else:
                lat = 19.5682
                lon = 74.2111
        except Exception:
            lat = 19.5682
            lon = 74.2111

    try:
        weather = await get_weather(
            latitude=lat,
            longitude=lon,
            timezone="auto",
            forecast_days=7,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Weather service unavailable: {str(exc)}",
        )

    current = weather.get("current", {})
    temp = current.get("temperature_2m", 26.0)
    humidity = current.get("relative_humidity_2m", 58.0)
    wind = current.get("wind_speed_10m", 7.5)
    rain = current.get("precipitation", 0.0)

    spray_status = "OPTIMAL"
    spray_color = "emerald"
    reasons = []

    if wind > 18.0:
        spray_status = "UNFAVORABLE"
        spray_color = "rose"
        reasons.append(f"High wind speed ({wind} km/h) causes droplet drift")
    elif wind > 12.0:
        spray_status = "CAUTION"
        spray_color = "amber"
        reasons.append(f"Moderate wind speed ({wind} km/h)")

    if rain > 0.5:
        spray_status = "DO_NOT_SPRAY"
        spray_color = "rose"
        reasons.append("Precipitation detected — chemical wash-off risk")

    if temp > 35.0:
        spray_status = "CAUTION"
        spray_color = "amber"
        reasons.append("High temperature (>35°C) increases droplet evaporation")

    if not reasons:
        reasons.append("Optimal wind, temperature, and humidity for foliar application.")

    return {
        "success": True,
        "location": {"latitude": lat, "longitude": lon},
        "weather": weather,
        "spray_advisory": {
            "status": spray_status,
            "badge_color": spray_color,
            "reasons": reasons,
            "temperature_c": temp,
            "humidity_pct": humidity,
            "wind_speed_kmh": wind,
            "precipitation_mm": rain,
        },
    }



@router.get(
    "/farm/{farm_id}",
    summary="Get weather for a farm",
)
async def get_farm_weather_endpoint(
    farm_id: str,
    user: AuthenticatedUser = Depends(
        get_authenticated_user
    ),
    supabase: Client = Depends(
        get_server_supabase
    ),
):
    """
    Get current weather and a 7-day forecast
    for a farmer's registered farm.

    The farm latitude and longitude are retrieved
    from Supabase after verifying ownership.
    """

    user_id = user["id"]

    try:

        response = (
            supabase
            .table("farms")
            .select(
                "id, name, village, district, latitude, longitude"
            )
            .eq(
                "id",
                farm_id,
            )
            .eq(
                "owner_id",
                user_id,
            )
            .single()
            .execute()
        )

    except Exception as exc:

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve farm.",
        ) from exc

    farm = response.data

    if not farm:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Farm not found or you do not "
                "have access to it."
            ),
        )

    latitude = farm.get(
        "latitude"
    )

    longitude = farm.get(
        "longitude"
    )

    if (
        latitude is None
        or longitude is None
    ):

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "This farm does not have valid GPS "
                "coordinates. Please update the farm "
                "location first."
            ),
        )

    try:

        latitude = float(
            latitude
        )

        longitude = float(
            longitude
        )

    except (
        TypeError,
        ValueError,
    ) as exc:

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Farm latitude or longitude is invalid."
            ),
        ) from exc

    try:

        weather = await get_farm_weather(
            farm_id=farm_id,
            latitude=latitude,
            longitude=longitude,
            timezone="auto",
            forecast_days=7,
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    except RuntimeError as exc:

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    except Exception as exc:

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Unexpected error while fetching weather."
            ),
        ) from exc

    return {
        "success": True,

        "farm": {
            "id": str(
                farm["id"]
            ),
            "name": farm.get(
                "name"
            ),
            "village": farm.get(
                "village"
            ),
            "district": farm.get(
                "district"
            ),
        },

        "weather": weather,
    }
