from datetime import datetime

import pandas as pd
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.config import settings
from app.ml.forecast import compute_safety_stock, forecast_product, rupture_risk
from app.ml.orders import build_order_lines
from app.models import CommandeSuggestion, Prevision, Produit, VenteJournaliere


def _daily_df(db: Session, produit_id: int) -> pd.DataFrame | None:
    rows = (
        db.query(VenteJournaliere)
        .filter(VenteJournaliere.produit_id == produit_id)
        .order_by(VenteJournaliere.jour)
        .all()
    )
    if not rows:
        return None
    return pd.DataFrame(
        [{"jour": pd.Timestamp(r.jour), "quantite": r.quantite} for r in rows]
    )


def _compute_forecast(
    produit: Produit, daily: pd.DataFrame
) -> tuple[float, float, float | None]:
    result = forecast_product(daily)
    if not result:
        h = settings.forecast_horizon_days
        moy_recente = daily.tail(h)["quantite"].mean()
        demande = float(moy_recente * h)
        sigma = float(daily["quantite"].std() or 0)
        mae = None
    else:
        demande = result["demande_prevue"]
        sigma = result["sigma"]
        mae = result["mae"]
    ss = float(compute_safety_stock(sigma, produit.delai_fournisseur_jours))
    return float(demande), ss, float(mae) if mae is not None else None


def forecast_produit(db: Session, produit_id: int) -> Prevision | None:
    """Recalcule la prévision XGBoost d'un seul produit."""
    produit = db.query(Produit).filter(Produit.id == produit_id).first()
    if not produit:
        return None

    daily = _daily_df(db, produit_id)
    if daily is None:
        db.query(Prevision).filter(Prevision.produit_id == produit_id).delete()
        return None

    demande, ss, mae = _compute_forecast(produit, daily)
    risque = rupture_risk(produit.stock_actuel, demande, ss)

    db.query(Prevision).filter(Prevision.produit_id == produit_id).delete()
    prev = Prevision(
        produit_id=produit_id,
        date_calcul=datetime.utcnow(),
        horizon_jours=settings.forecast_horizon_days,
        demande_prevue=demande,
        mae=mae,
        stock_securite=ss,
        risque_rupture=risque,
    )
    db.add(prev)
    db.flush()
    return prev


def rebuild_commande_suggestions(db: Session) -> dict:
    """Reconstruit la commande fournisseur à partir des prévisions actuelles."""
    db.query(CommandeSuggestion).delete()

    produits = db.query(Produit).all()
    order_inputs = []

    for produit in produits:
        prev = (
            db.query(Prevision)
            .filter(Prevision.produit_id == produit.id)
            .order_by(desc(Prevision.id))
            .first()
        )
        if not prev:
            continue
        order_inputs.append(
            {
                "id": produit.id,
                "nom": produit.nom,
                "stock": produit.stock_actuel,
                "prix_achat": float(produit.prix_achat),
                "demande_prevue": float(prev.demande_prevue),
                "stock_securite": float(prev.stock_securite),
                "sigma": 0,
                "delai": produit.delai_fournisseur_jours,
                "mae": float(prev.mae) if prev.mae is not None else None,
            }
        )

    order_df, montant_total, seuil_atteint = build_order_lines(order_inputs)

    for _, row in order_df.iterrows():
        if row["qte_commande"] <= 0:
            continue
        db.add(
            CommandeSuggestion(
                date_calcul=datetime.utcnow(),
                produit_id=int(row["produit_id"]),
                qte_commande=int(row["qte_commande"]),
                montant=float(row["montant"]),
                montant_total=montant_total,
                seuil_atteint=seuil_atteint,
            )
        )

    return {
        "lignes_commande": len(order_df[order_df["qte_commande"] > 0]),
        "montant_total": montant_total,
        "seuil_atteint": seuil_atteint,
        "seuil_fournisseur": settings.seuil_fournisseur,
    }


def refresh_after_stock_change(db: Session, produit_id: int) -> dict:
    """Prévision + commande après vente ou ajustement de stock."""
    forecast_produit(db, produit_id)
    return rebuild_commande_suggestions(db)


def run_full_pipeline(db: Session) -> dict:
    db.query(Prevision).delete()
    db.query(CommandeSuggestion).delete()

    produits = db.query(Produit).all()
    count = 0
    for produit in produits:
        if forecast_produit(db, produit.id):
            count += 1

    cmd = rebuild_commande_suggestions(db)
    db.commit()

    return {
        "produits_forecast": count,
        **cmd,
    }
