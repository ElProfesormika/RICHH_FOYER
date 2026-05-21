from fastapi import APIRouter, Depends
from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.ml.orders import stock_effectif_commande
from app.models import CommandeSuggestion, Prevision, Produit
from app.services.pricing import resolve_prix_achat
from app.schemas import CommandeLigneOut, CommandeResumeOut, MlStatusOut, PrevisionOut
from app.services.import_data import import_csv
from app.services.ml_pipeline import run_full_pipeline
from app.services.ml_status import get_ml_status

router = APIRouter(prefix="/api/ml", tags=["ml"])


def _commande_resume_vide(date_calc=None) -> CommandeResumeOut:
    return CommandeResumeOut(
        lignes=[],
        montant_total=0,
        seuil_fournisseur=settings.seuil_fournisseur,
        seuil_atteint=False,
        date_calcul=date_calc,
        nb_lignes=0,
        nb_unites_total=0,
        horizon_jours=settings.forecast_horizon_days,
        reference_commande=None,
    )


def _build_ligne(cmd, p, prev) -> CommandeLigneOut:
    demande = float(prev.demande_prevue) if prev else 0.0
    ss = float(prev.stock_securite) if prev else 0.0
    besoin = round(demande + ss, 2)
    stock_cmd = stock_effectif_commande(p.stock_actuel, demande, ss)
    pa = resolve_prix_achat(float(p.prix_achat), float(p.prix_vente_ttc))
    mae = float(prev.mae) if prev and prev.mae is not None else None
    return CommandeLigneOut(
        produit_id=p.id,
        produit_nom=p.nom,
        code_article=p.code_article,
        stock_actuel=p.stock_actuel,
        stock_commande=stock_cmd,
        demande_prevue=demande,
        stock_securite=ss,
        besoin_total=besoin,
        qte_commande=cmd.qte_commande,
        prix_achat=pa,
        prix_vente_ttc=float(p.prix_vente_ttc),
        montant=float(cmd.montant),
        risque_rupture=prev.risque_rupture if prev else "faible",
        mae=mae,
        modele_prevision="xgboost" if mae is not None else "fallback",
    )


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
        return _commande_resume_vide()

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
        return _commande_resume_vide(date_calc)

    montant_total = float(rows[0][0].montant_total)
    seuil_ok = bool(rows[0][0].seuil_atteint)

    lignes = [_build_ligne(cmd, p, prev) for cmd, p, prev in rows]
    ref = f"CMD-{date_calc.strftime('%Y%m%d-%H%M')}"

    return CommandeResumeOut(
        lignes=lignes,
        montant_total=montant_total,
        seuil_fournisseur=settings.seuil_fournisseur,
        seuil_atteint=seuil_ok,
        date_calcul=date_calc,
        nb_lignes=len(lignes),
        nb_unites_total=sum(l.qte_commande for l in lignes),
        horizon_jours=settings.forecast_horizon_days,
        reference_commande=ref,
    )
