from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.import_app_db import import_app_db
from app.services.ml_pipeline import run_full_pipeline

router = APIRouter(prefix="/api/import", tags=["import"])


@router.post("/app-db")
def reimport_app_db(db: Session = Depends(get_db)):
    """Réimporte app_db.sql et recalcule les prévisions ML."""
    try:
        stats = import_app_db(db, clear_existing=True)
        ml_stats = run_full_pipeline(db)
        return {"import": stats, "ml": ml_stats}
    except FileNotFoundError as e:
        raise HTTPException(404, str(e)) from e
    except Exception as e:
        raise HTTPException(500, f"Import échoué : {e}") from e
