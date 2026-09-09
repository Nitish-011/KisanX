from typing import Any, Dict

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
