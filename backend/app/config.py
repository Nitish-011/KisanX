from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ---------------------------------------------------------
    # SUPABASE
    # ---------------------------------------------------------
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_secret_key: str = ""
    supabase_service_role_key: str = ""

    # ---------------------------------------------------------
    # OLLAMA / GEMMA
    # ---------------------------------------------------------
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "gemma3:4b"

    # ---------------------------------------------------------
    # ML MODEL DIRECTORY
    # ---------------------------------------------------------
    model_dir: str = "ml/models"

    # ---------------------------------------------------------
    # CORS (comma-separated origins)
    # ---------------------------------------------------------
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # ---------------------------------------------------------
    # ENVIRONMENT
    # ---------------------------------------------------------
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def server_secret_key(self) -> str:
        """
        Prefer the newer Supabase secret key.

        Fall back to the legacy service-role key if present.
        Both are backend-only secrets.
        """
        return (
            self.supabase_secret_key
            or self.supabase_service_role_key
        )

    @property
    def supabase_service_key(self) -> str:
        """
        Alias used by the legacy farms.py route.
        Returns whichever server key is available.
        """
        return self.server_secret_key

    @property
    def cors_origin_list(self) -> list[str]:
        """
        Parse the comma-separated CORS_ORIGINS env var
        into a list of origin strings.
        """
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


# -------------------------------------------------------------
# GLOBAL SETTINGS
# -------------------------------------------------------------

settings = Settings()
