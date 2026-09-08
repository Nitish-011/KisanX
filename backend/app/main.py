from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

# ---------------------------------------------------------
# EXISTING KISANX ROUTERS
# ---------------------------------------------------------
from app.routes.assistant import router as assistant_router
from app.routes.farms import router as farms_router
from app.routes.scans import router as scans_router
from app.routes.rag import router as rag_router
from app.routes.farm_intelligence import (
    router as farm_intelligence_router,
)
from app.routes.weather import router as weather_router
from app.routes.marketplace import router as marketplace_router
from app.routes.auth_sync import router as auth_sync_router

# ---------------------------------------------------------
# NEW CROPGUARD ROUTERS
# ---------------------------------------------------------
from app.routes.diagnoses import (
    router as diagnoses_router,
)
from app.routes.trap_counts import (
    router as trap_counts_router,
)
from app.routes.risk_scores import (
    router as risk_scores_router,
)
from app.routes.hotspots import (
    router as hotspots_router,
)

from app.routes.input_market import (
    router as input_market_router,
)
from app.routes.agronomist import (
    router as agronomist_router,
)
from app.routes.feedback import (
    router as feedback_router,
)


# ============================================================
# KISANX / CROPGUARD FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="KisanX API",
    description=(
        "AI-Powered Crop Health, Harvest "
        "& Market Intelligence API — "
        "KisanX + CropGuard"
    ),
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# EXISTING KISANX ROUTES
# ============================================================

app.include_router(farms_router)
app.include_router(scans_router)
app.include_router(rag_router)
app.include_router(assistant_router)
app.include_router(farm_intelligence_router)
app.include_router(weather_router)
app.include_router(marketplace_router)
app.include_router(auth_sync_router)


# ============================================================
# NEW CROPGUARD ROUTES
# ============================================================

app.include_router(diagnoses_router)
app.include_router(trap_counts_router)
app.include_router(risk_scores_router)
app.include_router(hotspots_router)

app.include_router(input_market_router)
app.include_router(agronomist_router)
app.include_router(feedback_router)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "status": "ok",
        "service": "kisanx-api",
        "version": "1.0.0",
    }


# ============================================================
# HEALTH & LIVENESS CHECKS
# ============================================================

@app.get("/live")
def live_check():
    return {"status": "ok"}

@app.get("/ready")
def ready_check():
    # Verify models exist
    cotton_ready = settings.cotton_model_path_resolved.exists()
    sugarcane_ready = settings.sugarcane_model_path.exists()
    
    ready = cotton_ready and sugarcane_ready
    
    return {
        "status": "ready" if ready else "not_ready",
        "cotton_model": "ok" if cotton_ready else "missing",
        "sugarcane_model": "ok" if sugarcane_ready else "missing"
    }

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "kisanx-api",
        "version": "1.0.0"
    }
