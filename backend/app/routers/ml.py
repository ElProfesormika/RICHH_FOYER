from fastapi import APIRouter, Depends
from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import CommandeSuggestion, Prevision, Produit
from app.schemas import CommandeLigneOut, CommandeResumeOut, PrevisionOut
from app.services.import_data import import_csv
from app.services.ml_pipeline import run_full_pipeline

router = APIRouter(prefix="/api/ml", tags=["ml"])


@router.post("/import")
def trigger_import(db: Session = Depends(get_db)):
    return import_csv(db)


@router.post("/run")
def trigger_pipeline(db: Session = Depends(get_db)):
    return run_full_pipeline(db)


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
    subq = (
        db.query(
            Prevision.produit_id,
            func.max(Prevision.id).label("max_id"),
        )
        .group_by(Prevision.produit_id)
        .subquery()
    )

    cmds = (
        db.query(CommandeSuggestion, Produit, Prevision)
        .join(Produit, Produit.id == CommandeSuggestion.produit_id)
        .outerjoin(subq, subq.c.produit_id == Produit.id)
        .outerjoin(Prevision, and_(Prevision.id == subq.c.max_id))
        .order_by(CommandeSuggestion.montant.desc())
        .all()
    )

    if not cmds:
        return CommandeResumeOut(
            lignes=[],
            montant_total=0,
            seuil_fournisseur=settings.seuil_fournisseur,
            seuil_atteint=False,
            date_calcul=None,
        )

    date_calc = cmds[0][0].date_calcul
    montant_total = float(cmds[0][0].montant_total)
    seuil_ok = bool(cmds[0][0].seuil_atteint)

    lignes = []
    for cmd, p, prev in cmds:
        lignes.append(
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
        )

    return CommandeResumeOut(
        lignes=lignes,
        montant_total=montant_total,
        seuil_fournisseur=settings.seuil_fournisseur,
        seuil_atteint=seuil_ok,
        date_calcul=date_calc,
    )
