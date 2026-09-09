"""
Shared dependencies for CropGuard API routes.

Centralises authentication, authorization, and Supabase client
creation so individual route modules don't duplicate this logic.
"""

from functools import lru_cache
from typing import Callable, Optional

from fastapi import Header, HTTPException, status, Depends
from pydantic import BaseModel
from supabase import Client, create_client

from app.config import settings
from app.services.supabase_service import get_server_supabase


# ============================================================
# ROLE CONSTANTS
# ============================================================

ROLE_FARMER = "FARMER"
ROLE_BUYER = "BUYER"
ROLE_OFFICER = "OFFICER"
VALID_ROLES = {ROLE_FARMER, ROLE_BUYER, ROLE_OFFICER}


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
# PROFILE-BASED ROLE LOADER
# ============================================================

def _load_profile_role_and_name(user_id: str) -> tuple[Optional[str], Optional[str]]:
    """
    Load the user's role and full_name from the profiles table.
    Returns (role, full_name). Falls back to (None, None) on error.
    """
    try:
        supabase = get_server_supabase()
        result = (
            supabase.table("profiles")
            .select("role, full_name")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        if result.data:
            return (
                (result.data.get("role") or "").upper() or None,
                result.data.get("full_name"),
            )
    except Exception:
        pass
    return None, None


# ============================================================
# AUTHENTICATION DEPENDENCY
# ============================================================

def get_authenticated_user(
    authorization: Optional[str] = Header(default=None),
) -> AuthenticatedUser:
    """
    Validate a Supabase JWT from the Authorization header.

    Expected format: ``Bearer <token>``

    Loads the user's role and name from the ``profiles`` table
    (not from JWT metadata, which can be stale or self-assigned).

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
            detail="Invalid or expired authentication token.",
        ) from exc

    if not auth_response or not auth_response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to authenticate user.",
        )

    user_id = str(auth_response.user.id)

    # Load authoritative role/name from profiles table
    profile_role, profile_name = _load_profile_role_and_name(user_id)

    # Fallback to JWT metadata only if profile lookup fails
    user_metadata = auth_response.user.user_metadata or {}
    role = profile_role or (user_metadata.get("role") or "FARMER").upper()
    name = profile_name or user_metadata.get("full_name", "Unknown User")

    return AuthenticatedUser(
        id=user_id,
        role=role,
        name=name,
    )


# ============================================================
# OPTIONAL AUTHENTICATION DEPENDENCY
# ============================================================

def get_optional_authenticated_user(
    authorization: Optional[str] = Header(default=None),
) -> Optional[AuthenticatedUser]:
    """
    Like :func:`get_authenticated_user` but returns ``None``
    instead of raising 401 when no valid token is provided.
    """
    if not authorization:
        return None

    token = authorization
    if token.lower().startswith("bearer "):
        token = token[7:]

    if not token:
        return None

    try:
        auth_client = _get_auth_client()
        auth_response = auth_client.auth.get_user(token)
        if not auth_response or not auth_response.user:
            return None

        user_id = str(auth_response.user.id)
        profile_role, profile_name = _load_profile_role_and_name(user_id)
        user_metadata = auth_response.user.user_metadata or {}

        return AuthenticatedUser(
            id=user_id,
            role=profile_role or (user_metadata.get("role") or "FARMER").upper(),
            name=profile_name or user_metadata.get("full_name", "Unknown User"),
        )
    except Exception:
        return None


# ============================================================
# ROLE-BASED AUTHORIZATION DEPENDENCY FACTORY
# ============================================================

def require_role(*allowed_roles: str) -> Callable:
    """
    Factory that returns a FastAPI dependency enforcing that
    the authenticated user has one of the specified roles.

    Usage::

        @router.post("/certify")
        def certify(user: AuthenticatedUser = Depends(require_role("OFFICER"))):
            ...

        @router.post("/negotiate")
        def negotiate(user: AuthenticatedUser = Depends(require_role("FARMER", "BUYER"))):
            ...
    """
    allowed_upper = {r.upper() for r in allowed_roles}

    def _dependency(
        user: AuthenticatedUser = Depends(get_authenticated_user),
    ) -> AuthenticatedUser:
        user_role = (user.role or "").upper()

        if user_role not in allowed_upper:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Required role: "
                    f"{', '.join(sorted(allowed_upper))}. "
                    f"Your role: {user_role or 'unknown'}."
                ),
            )
        return user

    return _dependency
