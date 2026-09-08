from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent


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
    # ML MODEL PATHS
    #
    # Relative paths are resolved against the repository root
    # so the backend runs on Linux/macOS/Windows without
    # hardcoded absolute paths.
    # ---------------------------------------------------------
    model_dir: str = "ml/models"
    sugarcane_model_file: str = "mobilenet_v3_large_best.pth"
    cotton_model_path: str = (
        "frontend/ml/cotton/runs/yolo26n_seg_clean/weights/best.pt"
    )

    # ---------------------------------------------------------
    # CORS (comma-separated origins)
    # ---------------------------------------------------------
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # ---------------------------------------------------------
    # ENVIRONMENT
    # ---------------------------------------------------------
    model_config = SettingsConfigDict(
        env_file=[str(BACKEND_DIR / ".env"), ".env"],
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

    def _resolve(self, raw: str) -> Path:
        """
        Resolve a configured path. Absolute paths are used
        as-is; relative paths are anchored to PROJECT_ROOT.
        """
        candidate = Path(raw)

        if candidate.is_absolute():
            return candidate

        return PROJECT_ROOT / candidate

    @property
    def model_dir_path(self) -> Path:
        """Directory holding trained model weights."""
        return self._resolve(self.model_dir)

    @property
    def sugarcane_model_path(self) -> Path:
        """Full path to the sugarcane MobileNetV3 checkpoint."""
        return self.model_dir_path / self.sugarcane_model_file

    @property
    def cotton_model_path_resolved(self) -> Path:
        """Full path to the cotton YOLO segmentation weights."""
        return self._resolve(self.cotton_model_path)


# -------------------------------------------------------------
# GLOBAL SETTINGS
# -------------------------------------------------------------

settings = Settings()
