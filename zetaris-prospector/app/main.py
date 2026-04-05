"""
Zetaris Sales Prospector — FastAPI Application
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.database import init_db

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info("Starting Zetaris Prospector...")
    await init_db()

    from app.tasks.scheduler import start_scheduler
    start_scheduler()

    yield

    from app.tasks.scheduler import stop_scheduler
    stop_scheduler()
    logger.info("Zetaris Prospector stopped.")


app = FastAPI(
    title="Zetaris Sales Prospector",
    description="AI-powered B2B sales prospecting for Zetaris data platform",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# Register API routers
from app.api.prospects import router as prospects_router
from app.api.outreach import router as outreach_router
from app.api.dashboard import router as dashboard_router
from app.api.scoring import router as scoring_router

app.include_router(prospects_router)
app.include_router(outreach_router)
app.include_router(dashboard_router)
app.include_router(scoring_router)


# Serve frontend static files
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR / "static")), name="static")

    @app.get("/")
    async def serve_index():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/prospect/{prospect_id}")
    async def serve_prospect(prospect_id: int):
        return FileResponse(str(FRONTEND_DIR / "prospect.html"))

    @app.get("/add")
    async def serve_add():
        return FileResponse(str(FRONTEND_DIR / "add_prospect.html"))


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
