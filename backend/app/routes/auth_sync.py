from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.services.supabase_service import get_server_supabase

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

@router.post("/profile", status_code=status.HTTP_200_OK)
def sync_user_profile(payload: ProfileSyncRequest):
    """
    Guarantees user profile creation/synchronization using the backend
    service role key, bypassing any client-side RLS policy restriction.
    """
    supabase = get_server_supabase()
    try:
        profile_data = {
            "id": payload.id,
            "full_name": payload.full_name,
            "role": payload.role.upper(),
        }
        res = supabase.table("profiles").upsert(profile_data).execute()

        return {
            "success": True,
            "message": "User profile synchronized successfully.",
            "profile": res.data[0] if res.data else None,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Profile synchronization failed: {str(exc)}",
        ) from exc
