from datetime import datetime

import pandas as pd
from sqlalchemy.orm import Session

from app.config import settings
from app.ml.forecast import compute_safety_stock, forecast_product, rupture_risk
from app.ml.orders import build_order_lines
from app.models import CommandeSuggestion, Prevision, Produit, VenteJournaliere


def run_full_pipeline(db: Session) -> dict:
    db.query(Prevision).delete()
    db.query(CommandeSuggestion).delete()

    produits = db.query(Produit).all()
    order_inputs = []
    previsions_out = []

    for produit in produits:
        rows = (
            db.query(VenteJournaliere)
            .filter(VenteJournaliere.produit_id == produit.id)
            .order_by(VenteJournaliere.jour)
            .all()
        )
        if not rows:
            continue

        daily = pd.DataFrame(
            [{"jour": pd.Timestamp(r.jour), "quantite": r.quantite} for r in rows]
        )

        result = forecast_product(daily)
        if not result:
            last7 = daily.tail(7)["quantite"].mean()
            demande = float(last7 * settings.forecast_horizon_days)
            sigma = float(daily["quantite"].std() or 0)
            mae = None
        else:
            demande = result["demande_prevue"]
            sigma = result["sigma"]
            mae = result["mae"]

        ss = float(compute_safety_stock(sigma, produit.delai_fournisseur_jours))
        risque = rupture_risk(produit.stock_actuel, demande, ss)

        prev = Prevision(
            produit_id=produit.id,
            date_calcul=datetime.utcnow(),
            horizon_jours=settings.forecast_horizon_days,
            demande_prevue=float(demande),
            mae=float(mae) if mae is not None else None,
            stock_securite=ss,
            risque_rupture=risque,
        )
        db.add(prev)
        previsions_out.append(prev)

        order_inputs.append(
            {
                "id": produit.id,
                "nom": produit.nom,
                "stock": produit.stock_actuel,
                "prix_achat": float(produit.prix_achat),
                "demande_prevue": float(demande),
                "sigma": float(sigma),
                "delai": produit.delai_fournisseur_jours,
                "mae": float(mae) if mae is not None else None,
            }
        )

    db.flush()

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

    db.commit()

    return {
        "produits_forecast": len(previsions_out),
        "lignes_commande": len(order_df[order_df["qte_commande"] > 0]),
        "montant_total": montant_total,
        "seuil_atteint": seuil_atteint,
        "seuil_fournisseur": settings.seuil_fournisseur,
    }
