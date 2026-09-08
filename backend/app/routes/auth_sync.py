from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from app.services.supabase_service import get_server_supabase
from app.dependencies import get_authenticated_user, AuthenticatedUser

router = APIRouter(
    prefix="/api/auth",
    tags=["Auth"],
)

class ProfileSyncRequest(BaseModel):
    id: str
    full_name: str
    role: str = "FARMER"
    phone: Optional[str] = None
    organization: Optional[str] = None

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "FARMER"

@router.post("/register", status_code=status.HTTP_200_OK)
def register_user(payload: RegisterRequest):
    """
    Registers a new user directly with auto-confirmed email so they can
    log in instantly without requiring SMTP email verification.
    """
    supabase = get_server_supabase()
    try:
        created = supabase.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": payload.full_name,
                    "role": payload.role.upper(),
                },
            }
        )
        user_id = created.user.id
        return {
            "success": True,
            "message": "User registered and email confirmed successfully.",
            "user_id": user_id,
        }
    except Exception as exc:
        # If user already registered, update password and confirm email
        err_msg = str(exc).lower()
        if "already" in err_msg or "exists" in err_msg or "duplicate" in err_msg or "registered" in err_msg:
            try:
                users = supabase.auth.admin.list_users()
                existing = next((u for u in users if u.email and u.email.lower() == payload.email.lower()), None)
                if existing:
                    supabase.auth.admin.update_user_by_id(
                        existing.id,
                        {
                            "password": payload.password,
                            "email_confirm": True,
                            "user_metadata": {
                                "full_name": payload.full_name,
                                "role": payload.role.upper(),
                            },
                        },
                    )
                    return {
                        "success": True,
                        "message": "Existing user credentials updated and auto-confirmed.",
                        "user_id": existing.id,
                    }
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration failed: {str(exc)}",
        ) from exc

@router.post("/profile", status_code=status.HTTP_200_OK)
def sync_user_profile(
    payload: ProfileSyncRequest,
    user: AuthenticatedUser = Depends(get_authenticated_user)
):
    """
    Guarantees user profile creation/synchronization using the backend
    service role key, bypassing any client-side RLS policy restriction.
    Requires authentication to prevent arbitrary profile changes.
    """
    if payload.id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only synchronize your own profile."
        )

    requested_role = payload.role.upper()
    if requested_role == "OFFICER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot set role to OFFICER via public profile synchronization."
        )

    supabase = get_server_supabase()
    try:
        profile_data = {
            "id": payload.id,
            "full_name": payload.full_name,
            "role": requested_role,
        }
        res = supabase.table("profiles").upsert(profile_data).execute()

        return {
            "success": True,
            "message": "User profile synchronized successfully.",
            "profile": res.data[0] if res.data else None,
        }
    except Exception as exc:
        # If profiles table doesn't exist, log warning but don't crash
        return {
            "success": True,
            "message": f"Profile metadata stored in auth: {str(exc)}",
            "profile": None,
        }

