"""
Shared dependencies for CropGuard API routes.

Centralises authentication and Supabase client creation
so individual route modules don't duplicate this logic.
"""

from functools import lru_cache
from typing import Optional

from fastapi import Header, HTTPException, status
from pydantic import BaseModel
from supabase import Client, create_client

from app.config import settings
from app.services.supabase_service import get_server_supabase


# ============================================================
# AUTHENTICATED USER MODEL
# ============================================================

class AuthenticatedUser(BaseModel):
    id: str
    role: Optional[str] = None
    name: Optional[str] = None


# ============================================================
# SUPABASE CLIENT HELPERS
# ============================================================

def get_supabase() -> Client:
    """Return the server-role Supabase client."""
    return get_server_supabase()


@lru_cache
def _get_auth_client() -> Client:
    """
    Return a cached Supabase client for auth validation.
    Uses the publishable (anon) key so it can call
    auth.get_user() with user tokens.
    """
    return create_client(
        settings.supabase_url,
        settings.supabase_publishable_key,
    )


# ============================================================
# AUTHENTICATION DEPENDENCY
# ============================================================

def get_authenticated_user(
    authorization: Optional[str] = Header(default=None),
) -> AuthenticatedUser:
    """
    Validate a Supabase JWT from the Authorization header.

    Expected format: ``Bearer <token>``

    Returns an :class:`AuthenticatedUser` on success;
    raises ``401`` otherwise.
    """

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header.",
        )

    # Strip the "Bearer " prefix if present.
    token = authorization
    if token.lower().startswith("bearer "):
        token = token[7:]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty authentication token.",
        )

    try:
        auth_client = _get_auth_client()
        auth_response = auth_client.auth.get_user(token)

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired authentication token.",
        ) from exc

    if not auth_response or not auth_response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to authenticate user.",
        )

    user_metadata = auth_response.user.user_metadata or {}

    return AuthenticatedUser(
        id=str(auth_response.user.id),
        role=user_metadata.get("role", "farmer"),
        name=user_metadata.get("full_name", "Unknown User"),
    )
