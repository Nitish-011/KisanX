from functools import lru_cache

from supabase import create_client, Client

from app.config import settings


@lru_cache
def get_server_supabase() -> Client:

    secret_key = settings.server_secret_key

    if not settings.supabase_url:
        raise RuntimeError(
            "SUPABASE_URL is not configured."
        )

    if not secret_key:
        raise RuntimeError(
            "SUPABASE_SECRET_KEY is not configured."
        )

    return create_client(
        settings.supabase_url,
        secret_key,
    )
