from typing import Any

import httpx


OPEN_METEO_FORECAST_URL = (
    "https://api.open-meteo.com/v1/forecast"
)

REQUEST_TIMEOUT_SECONDS = 15.0


CURRENT_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "precipitation",
    "rain",
    "weather_code",
    "wind_speed_10m",
    "wind_direction_10m",
    "et0_fao_evapotranspiration",
    "vapour_pressure_deficit",
]

HOURLY_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation_probability",
    "precipitation",
    "rain",
    "weather_code",
    "wind_speed_10m",
    "wind_direction_10m",
    "et0_fao_evapotranspiration",
    "vapour_pressure_deficit",
]

DAILY_VARIABLES = [
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "rain_sum",
    "precipitation_hours",
    "wind_speed_10m_max",
    "et0_fao_evapotranspiration",
    "sunrise",
    "sunset",
]


def validate_coordinates(
    latitude: float,
    longitude: float,
) -> None:

    if not -90 <= latitude <= 90:
        raise ValueError(
            "Latitude must be between -90 and 90."
        )

    if not -180 <= longitude <= 180:
        raise ValueError(
            "Longitude must be between -180 and 180."
        )


async def get_weather(
    latitude: float,
    longitude: float,
    timezone: str = "auto",
    forecast_days: int = 7,
) -> dict[str, Any]:

    validate_coordinates(
        latitude,
        longitude,
    )

    if not 1 <= forecast_days <= 16:
        raise ValueError(
            "forecast_days must be between 1 and 16."
        )

    params = {
        "latitude": latitude,
        "longitude": longitude,

        "current": ",".join(
            CURRENT_VARIABLES
        ),

        "hourly": ",".join(
            HOURLY_VARIABLES
        ),

        "daily": ",".join(
            DAILY_VARIABLES
        ),

        "forecast_days": forecast_days,

        "timezone": timezone,

        "temperature_unit": "celsius",

        "wind_speed_unit": "kmh",

        "precipitation_unit": "mm",
    }

    try:

        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT_SECONDS
        ) as client:

            response = await client.get(
                OPEN_METEO_FORECAST_URL,
                params=params,
            )

    except httpx.TimeoutException as exc:

        raise RuntimeError(
            "Weather provider request timed out."
        ) from exc

    except httpx.RequestError as exc:

        raise RuntimeError(
            "Could not connect to the weather provider."
        ) from exc

    if response.status_code != 200:

        try:
            error_data = response.json()
        except Exception:
            error_data = {}

        reason = (
            error_data.get("reason")
            if isinstance(
                error_data,
                dict,
            )
            else None
        )

        raise RuntimeError(
            "Weather provider returned an error"
            + (
                f": {reason}"
                if reason
                else f" (HTTP {response.status_code})"
            )
        )

    try:

        data = response.json()

    except Exception as exc:

        raise RuntimeError(
            "Weather provider returned invalid JSON."
        ) from exc

    if not isinstance(data, dict):

        raise RuntimeError(
            "Weather provider returned an invalid response."
        )

    return data


async def get_farm_weather(
    farm_id: str,
    latitude: float,
    longitude: float,
    timezone: str = "auto",
    forecast_days: int = 7,
) -> dict[str, Any]:

    if not farm_id:

        raise ValueError(
            "farm_id is required."
        )

    weather = await get_weather(
        latitude=latitude,
        longitude=longitude,
        timezone=timezone,
        forecast_days=forecast_days,
    )

    return {
        "farm_id": farm_id,

        "location": {
            "latitude": weather.get(
                "latitude"
            ),
            "longitude": weather.get(
                "longitude"
            ),
            "elevation": weather.get(
                "elevation"
            ),
            "timezone": weather.get(
                "timezone"
            ),
            "timezone_abbreviation": weather.get(
                "timezone_abbreviation"
            ),
        },

        "current": weather.get(
            "current",
            {},
        ),

        "current_units": weather.get(
            "current_units",
            {},
        ),

        "hourly": weather.get(
            "hourly",
            {},
        ),

        "hourly_units": weather.get(
            "hourly_units",
            {},
        ),

        "daily": weather.get(
            "daily",
            {},
        ),

        "daily_units": weather.get(
            "daily_units",
            {},
        ),

        "source": {
            "provider": "Open-Meteo",
            "endpoint": OPEN_METEO_FORECAST_URL,
        },
    }
