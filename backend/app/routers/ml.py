from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Prevision, Produit
from app.schemas import CommandeResumeOut, MlStatusOut, PrevisionOut
from app.services.commande_resume import build_commande_resume
from app.services.import_data import import_csv
from app.services.ml_pipeline import run_full_pipeline
from app.services.ml_status import get_ml_status

router = APIRouter(prefix="/api/ml", tags=["ml"])


@router.post("/import")
def trigger_import(db: Session = Depends(get_db)):
    return import_csv(db)


@router.post("/run")
def trigger_pipeline(db: Session = Depends(get_db)):
    return run_full_pipeline(db)


@router.get("/status", response_model=MlStatusOut)
def ml_status(db: Session = Depends(get_db)):
    return get_ml_status(db)


@router.get("/previsions", response_model=list[PrevisionOut])
def list_previsions(db: Session = Depends(get_db)):
    rows = (
        db.query(Prevision, Produit)
        .join(Produit, Produit.id == Prevision.produit_id)
        .order_by(Prevision.risque_rupture.desc(), Prevision.demande_prevue.desc())
        .all()
    )
    return [
        PrevisionOut(
            produit_id=p.id,
            produit_nom=p.nom,
            demande_prevue=prev.demande_prevue,
            stock_securite=prev.stock_securite,
            stock_actuel=p.stock_actuel,
            mae=prev.mae,
            risque_rupture=prev.risque_rupture,
            horizon_jours=prev.horizon_jours,
        )
        for prev, p in rows
    ]


@router.get("/commande", response_model=CommandeResumeOut)
def get_commande(db: Session = Depends(get_db)):
    """Toutes les prévisions 14j par produit (qté commande peut être 0)."""
    return build_commande_resume(db)
