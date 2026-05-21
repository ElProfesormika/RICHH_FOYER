import logging
import threading
import time
from pathlib import Path

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

from app.config import settings
from app.database import Base, engine
from app.routers import config_api, dashboard, import_router, ml, produits, ventes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

_init_lock = threading.Lock()
_init_status = {
    "ready": False,
    "loading": False,
    "error": None,
    "db_connected": False,
}


def _wait_for_db(max_attempts: int = 30, delay_sec: float = 2.0) -> bool:
    """Attend que PostgreSQL soit joignable (Railway : Postgres démarre parfois après l'API)."""
    for attempt in range(1, max_attempts + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.warning(
                "PostgreSQL indisponible (tentative %s/%s): %s",
                attempt,
                max_attempts,
                e,
            )
            time.sleep(delay_sec)
    return False


def _setup_schema() -> None:
    from app import models_appdb  # noqa: F401
    from app.migrate import run_migrations

    Base.metadata.create_all(bind=engine)
    run_migrations()
    _init_status["db_connected"] = True
    logger.info("Schéma PostgreSQL prêt.")


def _background_init():
    global _init_status
    with _init_lock:
        if _init_status["loading"] or _init_status["ready"]:
            return
        _init_status["loading"] = True

    from app.database import SessionLocal
    from app.models import Produit
    from app import models_appdb  # noqa: F401
    from app.services.import_app_db import import_app_db
    from app.services.import_data import import_csv
    from app.services.ml_pipeline import run_full_pipeline

    db = SessionLocal()
    try:
        need_import = (
            db.query(Produit).count() == 0 or settings.force_reimport
        )
        if need_import:
            if settings.import_source == "app_db":
                logger.info("Import app_db.sql + pipeline ML…")
                import_app_db(db, clear_existing=settings.force_reimport)
            else:
                logger.info("Import CSV + pipeline ML…")
                import_csv(db)
            run_full_pipeline(db)
        _init_status["ready"] = True
        logger.info("Initialisation terminée.")
    except Exception as e:
        _init_status["error"] = str(e)
        logger.exception("Erreur initialisation: %s", e)
    finally:
        db.close()
        _init_status["loading"] = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Démarrage Foyer_UTT API…")
    if _wait_for_db():
        try:
            _setup_schema()
            threading.Thread(target=_background_init, daemon=True).start()
        except Exception as e:
            _init_status["error"] = f"Schéma DB: {e}"
            logger.exception("Échec création schéma: %s", e)
    else:
        _init_status["error"] = (
            "PostgreSQL injoignable. Vérifiez DATABASE_URL=${{Postgres.DATABASE_URL}} "
            "et que le service Postgres est lié."
        )
        logger.error(_init_status["error"])
    yield
    logger.info("Arrêt API.")


app = FastAPI(
    title="Foyer_UTT — Gestion stocks & commandes",
    description="Prévision XGBoost et aide à la commande",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(config_api.router)
app.include_router(import_router.router)
app.include_router(dashboard.router)
app.include_router(produits.router)
app.include_router(ventes.router)
app.include_router(ml.router)


@app.get("/api/health/live")
def health_live():
    """Liveness Railway — ne touche pas à la base (répond toujours 200)."""
    return {"status": "alive", "app": "Foyer_UTT"}


@app.get("/api/health")
def health():
    """État détaillé (peut être en chargement tant que l'import tourne)."""
    produits_count = 0
    db_ok = False
    db_error = None

    if _init_status["db_connected"]:
        try:
            from app.database import SessionLocal
            from app.models import Produit

            db = SessionLocal()
            try:
                produits_count = db.query(Produit).count()
                db_ok = True
            finally:
                db.close()
        except Exception as e:
            db_error = str(e)

    body = {
        "status": "ok" if db_ok or not _init_status["db_connected"] else "degraded",
        "produits": produits_count,
        "data_ready": produits_count > 0 and _init_status["ready"],
        "loading": _init_status["loading"],
        "db_connected": _init_status["db_connected"],
        "error": _init_status["error"] or db_error,
    }
    return JSONResponse(content=body, status_code=200)


def _mount_frontend(application: FastAPI) -> None:
    """Interface React — monté en dernier pour ne pas bloquer /api/*."""
    if not STATIC_DIR.is_dir():
        logger.warning("Dossier static/ absent — pas d'interface web embarquée.")

        @application.get("/")
        def api_only_root():
            return {
                "app": "Foyer_UTT",
                "docs": "/docs",
                "health": "/api/health",
            }

        return

    assets_dir = STATIC_DIR / "assets"
    if assets_dir.is_dir():
        application.mount(
            "/assets",
            StaticFiles(directory=assets_dir),
            name="frontend-assets",
        )

    application.mount(
        "/",
        StaticFiles(directory=STATIC_DIR, html=True),
        name="frontend-spa",
    )
    logger.info("Interface web servie depuis %s", STATIC_DIR)


_mount_frontend(app)
