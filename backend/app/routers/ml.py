from fastapi import APIRouter, Depends
from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import CommandeSuggestion, Prevision, Produit
from app.schemas import CommandeLigneOut, CommandeResumeOut, MlStatusOut, PrevisionOut
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
    date_calc = db.query(func.max(CommandeSuggestion.date_calcul)).scalar()
    if not date_calc:
        return CommandeResumeOut(
            lignes=[],
            montant_total=0,
            seuil_fournisseur=settings.seuil_fournisseur,
            seuil_atteint=False,
            date_calcul=None,
        )

    subq = (
        db.query(
            Prevision.produit_id,
            func.max(Prevision.id).label("max_id"),
        )
        .group_by(Prevision.produit_id)
        .subquery()
    )

    rows = (
        db.query(CommandeSuggestion, Produit, Prevision)
        .join(Produit, Produit.id == CommandeSuggestion.produit_id)
        .outerjoin(subq, subq.c.produit_id == Produit.id)
        .outerjoin(Prevision, and_(Prevision.id == subq.c.max_id))
        .filter(
            CommandeSuggestion.date_calcul == date_calc,
            CommandeSuggestion.qte_commande > 0,
        )
        .order_by(CommandeSuggestion.montant.desc())
        .all()
    )

    if not rows:
        return CommandeResumeOut(
            lignes=[],
            montant_total=0,
            seuil_fournisseur=settings.seuil_fournisseur,
            seuil_atteint=False,
            date_calcul=date_calc,
        )

    montant_total = float(rows[0][0].montant_total)
    seuil_ok = bool(rows[0][0].seuil_atteint)

    lignes = [
        CommandeLigneOut(
            produit_id=p.id,
            produit_nom=p.nom,
            stock_actuel=p.stock_actuel,
            demande_prevue=prev.demande_prevue if prev else 0,
            stock_securite=prev.stock_securite if prev else 0,
            qte_commande=cmd.qte_commande,
            prix_achat=p.prix_achat,
            montant=cmd.montant,
            risque_rupture=prev.risque_rupture if prev else "faible",
        )
        for cmd, p, prev in rows
    ]

    return CommandeResumeOut(
        lignes=lignes,
        montant_total=montant_total,
        seuil_fournisseur=settings.seuil_fournisseur,
        seuil_atteint=seuil_ok,
        date_calcul=date_calc,
    )
