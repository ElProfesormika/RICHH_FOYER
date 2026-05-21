import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import config_api, dashboard, import_router, ml, produits, ventes

logger = logging.getLogger(__name__)
_init_lock = threading.Lock()
_init_status = {"ready": False, "loading": False, "error": None}


def _background_init():
    global _init_status
    with _init_lock:
        if _init_status["loading"] or _init_status["ready"]:
            return
        _init_status["loading"] = True

    from app.database import SessionLocal
    from app.models import Produit
    from app import models_appdb  # noqa: F401 — tables miroir
    from app.config import settings
    from app.services.import_app_db import import_app_db
    from app.services.import_data import import_csv
    from app.services.ml_pipeline import run_full_pipeline

    db = SessionLocal()
    try:
        need_import = (
            db.query(Produit).count() == 0
            or settings.force_reimport
        )
        if need_import:
            if settings.import_source == "app_db":
                logger.info("Import app_db.sql + pipeline ML en arrière-plan…")
                import_app_db(db, clear_existing=settings.force_reimport)
            else:
                logger.info("Import CSV + pipeline ML en arrière-plan…")
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
    from app import models_appdb  # noqa: F401
    from app.migrate import run_migrations

    Base.metadata.create_all(bind=engine)
    run_migrations()
    threading.Thread(target=_background_init, daemon=True).start()
    yield


app = FastAPI(
    title="Foyer — Gestion stocks & commandes",
    description="Prévision XGBoost et aide à la commande",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


@app.get("/api/health")
def health():
    from app.database import SessionLocal
    from app.models import Produit

    db = SessionLocal()
    try:
        n = db.query(Produit).count()
    finally:
        db.close()
    return {
        "status": "ok",
        "produits": n,
        "data_ready": n > 0 and _init_status["ready"],
        "loading": _init_status["loading"],
        "error": _init_status["error"],
    }
