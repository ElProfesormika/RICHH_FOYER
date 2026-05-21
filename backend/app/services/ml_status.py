"""État du moteur ML / commande suggérée."""

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CommandeSuggestion, Prevision, Produit


def get_ml_status(db: Session) -> dict:
    nb_produits = db.query(Produit).count()
    nb_previsions = db.query(Prevision).count()
    nb_lignes_cmd = db.query(CommandeSuggestion).filter(
        CommandeSuggestion.qte_commande > 0
    ).count()

    date_calc = db.query(func.max(CommandeSuggestion.date_calcul)).scalar()
    date_prev = db.query(func.max(Prevision.date_calcul)).scalar()

    last_cmd = None
    if date_calc:
        last_cmd = (
            db.query(CommandeSuggestion)
            .filter(CommandeSuggestion.date_calcul == date_calc)
            .first()
        )

    montant = float(last_cmd.montant_total) if last_cmd else 0.0
    seuil_ok = bool(last_cmd.seuil_atteint) if last_cmd else False

    return {
        "mode": "automatique",
        "description": "Recalcul XGBoost à chaque vente ou ajustement de stock",
        "pret": nb_previsions > 0 and nb_lignes_cmd > 0,
        "produits_total": nb_produits,
        "produits_avec_prevision": db.query(Prevision.produit_id).distinct().count(),
        "lignes_commande": nb_lignes_cmd if date_calc else 0,
        "montant_commande_eur": montant,
        "seuil_fournisseur_eur": settings.seuil_fournisseur,
        "seuil_atteint": seuil_ok,
        "horizon_jours": settings.forecast_horizon_days,
        "date_dernier_calcul_commande": date_calc,
        "date_dernier_calcul_prevision": date_prev,
        "formule_commande": "Q = max(0, D + SS - S) sur horizon jours",
        "formule_stock_securite": "SS = z x sigma x racine(L)",
    }
