from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Prevision, Produit, Vente, VenteJournaliere
from app.services.commande_resume import build_qte_commande_map
from app.services.ml_status import get_ml_status
from app.schemas import (
    DashboardKPI,
    StockOverviewOut,
    TopProduitOut,
    VenteTrendPoint,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

RISK_ORDER = {"critique": 0, "eleve": 1, "moyen": 2, "faible": 3}


def _latest_previsions(db: Session) -> dict[int, Prevision]:
    subq = (
        db.query(
            Prevision.produit_id,
            func.max(Prevision.id).label("max_id"),
        )
        .group_by(Prevision.produit_id)
        .subquery()
    )
    rows = (
        db.query(Prevision)
        .join(subq, Prevision.id == subq.c.max_id)
        .all()
    )
    return {p.produit_id: p for p in rows}


@router.get("/kpi", response_model=DashboardKPI)
def get_kpi(db: Session = Depends(get_db)):
    total_produits = db.query(Produit).count()
    total_ventes = int(
        db.query(func.coalesce(func.sum(VenteJournaliere.quantite), 0)).scalar() or 0
    )

    jours = db.query(VenteJournaliere.jour).distinct().count()
    debut = db.query(func.min(VenteJournaliere.jour)).scalar()
    fin = db.query(func.max(VenteJournaliere.jour)).scalar()

    ml = get_ml_status(db)
    montant = float(ml["montant_commande_eur"])
    seuil_ok = bool(ml["seuil_atteint"])

    today = date.today()
    ventes_jour = int(
        db.query(func.coalesce(func.sum(Vente.quantite), 0))
        .filter(Vente.jour == today)
        .scalar()
        or 0
    )

    previsions_latest = _latest_previsions(db)
    alertes = sum(
        1
        for p in previsions_latest.values()
        if p.risque_rupture in ("critique", "eleve", "moyen")
    )

    return DashboardKPI(
        total_produits=total_produits,
        total_ventes=total_ventes,
        ventes_aujourdhui=ventes_jour,
        jours_vente=jours,
        alertes_stock=alertes,
        periode_debut=debut,
        periode_fin=fin,
        montant_commande_suggeree=montant,
        seuil_fournisseur=settings.seuil_fournisseur,
        seuil_atteint=seuil_ok,
        horizon_jours=settings.forecast_horizon_days,
        ml_pret=bool(ml["pret"]),
        date_dernier_calcul_ml=ml["date_dernier_calcul_commande"],
        lignes_commande=int(ml["lignes_commande"]),
        produits_avec_prevision=int(ml["produits_avec_prevision"]),
    )


@router.get("/stocks-overview", response_model=list[StockOverviewOut])
def stocks_overview(
    db: Session = Depends(get_db),
    alertes_only: bool = Query(False),
    risque: str | None = Query(None),
):
    previsions = _latest_previsions(db)
    qte_map = build_qte_commande_map(db)
    result: list[StockOverviewOut] = []

    for p in db.query(Produit).order_by(Produit.nom).all():
        prev = previsions.get(p.id)

        demande = float(prev.demande_prevue) if prev else 0.0
        ss = float(prev.stock_securite) if prev else 0.0
        risque_val = prev.risque_rupture if prev else "faible"
        horizon = settings.forecast_horizon_days
        couverture = (
            round(p.stock_actuel / (demande / horizon), 1) if demande > 0 else 99.0
        )
        qte_cmd = qte_map.get(p.id, 0) if prev else 0

        if alertes_only and risque_val not in ("critique", "eleve", "moyen"):
            continue
        if risque and risque_val != risque:
            continue

        result.append(
            StockOverviewOut(
                produit_id=p.id,
                produit_nom=p.nom,
                stock_actuel=p.stock_actuel,
                prix_vente_ttc=p.prix_vente_ttc,
                demande_prevue_horizon=demande,
                stock_securite=ss,
                qte_commande_suggeree=qte_cmd,
                risque_rupture=risque_val,
                jours_couverture=min(couverture, 99.0),
            )
        )

    result.sort(
        key=lambda x: (
            RISK_ORDER.get(x.risque_rupture, 4),
            -x.demande_prevue_horizon,
        )
    )
    return result


@router.get("/ventes-trend", response_model=list[VenteTrendPoint])
def ventes_trend(db: Session = Depends(get_db), days: int = 90):
    rows = (
        db.query(
            VenteJournaliere.jour,
            func.sum(VenteJournaliere.quantite).label("q"),
        )
        .group_by(VenteJournaliere.jour)
        .order_by(VenteJournaliere.jour.desc())
        .limit(days)
        .all()
    )
    rows = sorted(rows, key=lambda r: r.jour)
    return [VenteTrendPoint(jour=r.jour, quantite=int(r.q)) for r in rows]


@router.get("/top-produits", response_model=list[TopProduitOut])
def top_produits(db: Session = Depends(get_db), limit: int = 15):
    rows = (
        db.query(
            Produit.nom,
            func.sum(VenteJournaliere.quantite).label("total"),
        )
        .join(VenteJournaliere, VenteJournaliere.produit_id == Produit.id)
        .group_by(Produit.id, Produit.nom)
        .order_by(func.sum(VenteJournaliere.quantite).desc())
        .limit(limit)
        .all()
    )
    return [
        TopProduitOut(produit_nom=r.nom, total_ventes=int(r.total)) for r in rows
    ]
