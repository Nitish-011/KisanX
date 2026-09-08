from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from supabase import Client, create_client

from app.schemas.farms import FarmRegistrationRequest


router = APIRouter(
    prefix="/api/farms",
    tags=["Farms"],
)


class AuthenticatedUser(BaseModel):
    id: str


def get_settings():
    from app.config import settings
    return settings


def get_supabase() -> Client:
    settings = get_settings()

    secret_key = settings.server_secret_key or settings.supabase_secret_key or settings.supabase_service_role_key

    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase URL is not configured.",
        )

    if not secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase server secret is not configured.",
        )

    try:
        return create_client(
            settings.supabase_url,
            secret_key,
        )
    except Exception as exc:
        print("========== SUPABASE CLIENT ERROR ==========")
        print(type(exc).__name__)
        print(repr(exc))
        print("============================================")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase client creation failed: {str(exc)}",
        ) from exc


def get_authenticated_user(
    authorization: Optional[str] = Header(None),
) -> AuthenticatedUser:

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header is required.",
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header. Must start with 'Bearer '.",
        )

    token = authorization.replace(
        "Bearer ",
        "",
        1,
    ).strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing access token.",
        )

    settings = get_settings()

    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase URL is not configured.",
        )

    if not settings.supabase_publishable_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase publishable key is not configured.",
        )

    try:
        supabase = create_client(
            settings.supabase_url,
            settings.supabase_publishable_key,
        )

        response = supabase.auth.get_user(token)

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        ) from exc

    if not response or not response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found.",
        )

    return AuthenticatedUser(
        id=response.user.id,
    )


def get_optional_authenticated_user(
    authorization: Optional[str] = Header(None),
) -> Optional[AuthenticatedUser]:
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.replace("Bearer ", "", 1).strip()
    if not token:
        return None

    try:
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_publishable_key:
            return None

        supabase = create_client(
            settings.supabase_url,
            settings.supabase_publishable_key,
        )
        response = supabase.auth.get_user(token)
        if response and response.user:
            return AuthenticatedUser(id=response.user.id)
    except Exception:
        return None

    return None


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
)
def register_farm(
    payload: FarmRegistrationRequest,
    user: AuthenticatedUser = Depends(
        get_authenticated_user
    ),
):

    supabase = get_supabase()

    farm_id = None
    plot_id = None

    try:

        farm_data = {
            "owner_id": user.id,
            "name": payload.farm.name,
            "village": payload.farm.village,
            "district": payload.farm.district,
            "latitude": payload.farm.latitude,
            "longitude": payload.farm.longitude,
            "area_acres": payload.farm.area_acres,
        }

        print("")
        print("========== CREATING FARM ==========")
        print(farm_data)
        print("====================================")

        farm_response = (
            supabase
            .table("farms")
            .insert(farm_data)
            .execute()
        )

        if not farm_response.data:
            raise Exception(
                "Farm insert returned no data."
            )

        farm = farm_response.data[0]
        farm_id = farm["id"]

        print(
            "Farm created successfully:",
            farm_id,
        )

        plot_data = {
            "farm_id": farm_id,
            "owner_id": user.id,
            "name": payload.plot.name,
            "area_acres": payload.plot.area_acres,
            "latitude": payload.plot.latitude,
            "longitude": payload.plot.longitude,
            "boundary": payload.plot.boundary,
        }

        print("")
        print("========== CREATING PLOT ==========")
        print(plot_data)
        print("====================================")

        plot_response = (
            supabase
            .table("plots")
            .insert(plot_data)
            .execute()
        )

        if not plot_response.data:
            raise Exception(
                "Plot insert returned no data."
            )

        plot = plot_response.data[0]
        plot_id = plot["id"]

        print(
            "Plot created successfully:",
            plot_id,
        )

        crop_cycle_data = {
            "plot_id": plot_id,
            "owner_id": user.id,
            "crop_name": payload.crop_cycle.crop_name,
            "variety": payload.crop_cycle.variety,
            "crop_stage": payload.crop_cycle.crop_stage,
            "planting_date": (
                payload.crop_cycle.planting_date.isoformat()
                if payload.crop_cycle.planting_date
                else None
            ),
            "soil_type": payload.crop_cycle.soil_type,
            "status": "ACTIVE",
        }

        print("")
        print("======= CREATING CROP CYCLE =======")
        print(crop_cycle_data)
        print("====================================")

        crop_response = (
            supabase
            .table("crop_cycles")
            .insert(crop_cycle_data)
            .execute()
        )

        if not crop_response.data:
            raise Exception(
                "Crop cycle insert returned no data."
            )

        crop_cycle = crop_response.data[0]

        print(
            "Crop cycle created successfully:",
            crop_cycle["id"],
        )

        print("")
        print("==========================================")
        print("     FARM REGISTRATION SUCCESSFUL")
        print("==========================================")
        print("")

        return {
            "success": True,
            "message": "Farm registered successfully.",
            "farm": farm,
            "plot": plot,
            "crop_cycle": crop_cycle,
        }

    except HTTPException:
        print("")
        print("========== HTTP ERROR ==========")
        print("An HTTP error occurred.")
        print("================================")
        print("")

        if plot_id:
            try:
                (
                    supabase
                    .table("plots")
                    .delete()
                    .eq("id", plot_id)
                    .execute()
                )
            except Exception as rollback_error:
                print(
                    "Plot rollback failed:",
                    repr(rollback_error),
                )

        if farm_id:
            try:
                (
                    supabase
                    .table("farms")
                    .delete()
                    .eq("id", farm_id)
                    .execute()
                )
            except Exception as rollback_error:
                print(
                    "Farm rollback failed:",
                    repr(rollback_error),
                )

        raise

    except Exception as exc:

        print("")
        print("==============================================")
        print("       FARM REGISTRATION ERROR")
        print("==============================================")
        print("ERROR TYPE:")
        print(type(exc).__name__)
        print("")
        print("ERROR:")
        print(repr(exc))
        print("")
        print("ERROR STRING:")
        print(str(exc))
        print("==============================================")
        print("")

        if plot_id:
            try:
                (
                    supabase
                    .table("plots")
                    .delete()
                    .eq("id", plot_id)
                    .execute()
                )

                print(
                    "Plot rollback successful."
                )

            except Exception as rollback_error:
                print(
                    "Plot rollback failed:",
                    repr(rollback_error),
                )

        if farm_id:
            try:
                (
                    supabase
                    .table("farms")
                    .delete()
                    .eq("id", farm_id)
                    .execute()
                )

                print(
                    "Farm rollback successful."
                )

            except Exception as rollback_error:
                print(
                    "Farm rollback failed:",
                    repr(rollback_error),
                )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Farm registration failed: {str(exc)}",
        ) from exc


@router.get(
    "",
    status_code=status.HTTP_200_OK,
)
def list_farms(
    user: Optional[AuthenticatedUser] = Depends(get_optional_authenticated_user),
):
    supabase = get_supabase()
    try:
        query = supabase.table("farms").select("*")
        if user and user.id:
            query = query.eq("owner_id", user.id)
        
        farms_res = query.order("created_at", desc=True).limit(25).execute()
        farms = farms_res.data or []
        farm_ids = [f["id"] for f in farms]

        plots_by_farm: Dict[str, List[Dict[str, Any]]] = {fid: [] for fid in farm_ids}
        if farm_ids:
            plots_res = (
                supabase.table("plots")
                .select("*")
                .in_("farm_id", farm_ids)
                .order("name", desc=False)
                .execute()
            )
            plots = plots_res.data or []
            plot_ids = [p["id"] for p in plots]

            cycles_by_plot: Dict[str, Dict[str, Any]] = {}
            if plot_ids:
                cycles_res = (
                    supabase.table("crop_cycles")
                    .select("*")
                    .in_("plot_id", plot_ids)
                    .eq("status", "ACTIVE")
                    .execute()
                )
                for c in (cycles_res.data or []):
                    cycles_by_plot[c["plot_id"]] = c

            for p in plots:
                p["active_crop_cycle"] = cycles_by_plot.get(p["id"])
                if p["farm_id"] in plots_by_farm:
                    plots_by_farm[p["farm_id"]].append(p)

        for f in farms:
            f["plots"] = plots_by_farm.get(f["id"], [])

        return {
            "success": True,
            "count": len(farms),
            "farms": farms,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch farms: {str(exc)}",
        ) from exc


@router.get(
    "/{farm_id}",
    status_code=status.HTTP_200_OK,
)
def get_farm(
    farm_id: str,
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    supabase = get_supabase()
    try:
        farm_res = (
            supabase.table("farms")
            .select("*")
            .eq("id", farm_id)
            .eq("owner_id", user.id)
            .limit(1)
            .execute()
        )
        if not farm_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farm not found.",
            )
        farm = farm_res.data[0]

        plots_res = (
            supabase.table("plots")
            .select("*")
            .eq("farm_id", farm_id)
            .order("name", desc=False)
            .execute()
        )
        plots = plots_res.data or []
        plot_ids = [p["id"] for p in plots]

        cycles_by_plot: Dict[str, Dict[str, Any]] = {}
        if plot_ids:
            cycles_res = (
                supabase.table("crop_cycles")
                .select("*")
                .in_("plot_id", plot_ids)
                .eq("status", "ACTIVE")
                .execute()
            )
            for c in (cycles_res.data or []):
                cycles_by_plot[c["plot_id"]] = c

        for p in plots:
            p["active_crop_cycle"] = cycles_by_plot.get(p["id"])

        farm["plots"] = plots

        return {
            "success": True,
            "farm": farm,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch farm details: {str(exc)}",
        ) from exc

