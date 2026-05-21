"""Construction de la commande consolidée (toutes les prévisions 14j)."""

from datetime import datetime

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.config import settings
from app.ml.orders import build_order_lines, stock_effectif_commande
from app.models import CommandeSuggestion, Prevision, Produit
from app.schemas import CommandeLigneOut, CommandeResumeOut
from app.services.pricing import resolve_prix_achat


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


def _order_inputs_from_previsions(
    previsions: dict[int, Prevision],
    produit_map: dict[int, Produit],
) -> list[dict]:
    order_inputs = []
    for produit_id, prev in previsions.items():
        produit = produit_map.get(produit_id)
        if not produit:
            continue
        order_inputs.append(
            {
                "id": produit.id,
                "nom": produit.nom,
                "stock": produit.stock_actuel,
                "prix_achat": resolve_prix_achat(
                    float(produit.prix_achat),
                    float(produit.prix_vente_ttc),
                ),
                "demande_prevue": float(prev.demande_prevue),
                "stock_securite": float(prev.stock_securite),
                "sigma": 0,
                "delai": produit.delai_fournisseur_jours,
                "mae": float(prev.mae) if prev.mae is not None else None,
            }
        )
    return order_inputs


def build_qte_commande_map(db: Session) -> dict[int, int]:
    """Qté à commander par produit (même calcul que l'onglet Commande)."""
    previsions = _latest_previsions(db)
    if not previsions:
        return {}
    produit_map = {p.id: p for p in db.query(Produit).all()}
    order_inputs = _order_inputs_from_previsions(previsions, produit_map)
    if not order_inputs:
        return {}
    order_df, _, _ = build_order_lines(order_inputs)
    return {
        int(row["produit_id"]): int(row["qte_commande"])
        for _, row in order_df.iterrows()
    }


def _ligne_from_row(row, produit: Produit, prev: Prevision) -> CommandeLigneOut:
    demande = float(row["demande_prevue"])
    ss = float(row["stock_securite"])
    besoin = round(demande + ss, 2)
    stock_cmd = stock_effectif_commande(
        int(row["stock"]), demande, ss
    )
    pa = resolve_prix_achat(float(produit.prix_achat), float(produit.prix_vente_ttc))
    mae = float(prev.mae) if prev.mae is not None else None
    return CommandeLigneOut(
        produit_id=produit.id,
        produit_nom=produit.nom,
        code_article=produit.code_article,
        stock_actuel=int(row["stock"]),
        stock_commande=stock_cmd,
        demande_prevue=demande,
        stock_securite=ss,
        besoin_total=besoin,
        qte_commande=int(row["qte_commande"]),
        prix_achat=pa,
        prix_vente_ttc=float(produit.prix_vente_ttc),
        montant=float(row["montant"]),
        risque_rupture=str(row["risque_rupture"]),
        mae=mae,
        modele_prevision="xgboost" if mae is not None else "fallback",
    )


def build_commande_resume(db: Session) -> CommandeResumeOut:
    """Tous les produits avec prévision 14j (y compris qté commande = 0)."""
    previsions = _latest_previsions(db)
    if not previsions:
        return CommandeResumeOut(
            lignes=[],
            montant_total=0,
            seuil_fournisseur=settings.seuil_fournisseur,
            seuil_atteint=False,
            date_calcul=None,
            nb_lignes=0,
            nb_unites_total=0,
            nb_lignes_a_commander=0,
            nb_produits_prevision=0,
            horizon_jours=settings.forecast_horizon_days,
            reference_commande=None,
            demande_cumul_14j=0,
            besoin_cumul_14j=0,
        )

    produit_map = {p.id: p for p in db.query(Produit).all()}
    order_inputs = _order_inputs_from_previsions(previsions, produit_map)
    order_df, montant_total, seuil_atteint = build_order_lines(order_inputs)

    lignes: list[CommandeLigneOut] = []
    for _, row in order_df.iterrows():
        pid = int(row["produit_id"])
        produit = produit_map.get(pid)
        prev = previsions.get(pid)
        if not produit or not prev:
            continue
        lignes.append(_ligne_from_row(row, produit, prev))

    lignes.sort(key=lambda l: (-l.montant, -l.demande_prevue, l.produit_nom))

    date_prev = db.query(func.max(Prevision.date_calcul)).scalar()
    date_cmd = db.query(func.max(CommandeSuggestion.date_calcul)).scalar()
    date_calc = date_cmd or date_prev or datetime.utcnow()

    ref = (
        f"CMD-{date_calc.strftime('%Y%m%d-%H%M')}"
        if hasattr(date_calc, "strftime")
        else f"CMD-{datetime.utcnow().strftime('%Y%m%d-%H%M')}"
    )

    a_commander = [l for l in lignes if l.qte_commande > 0]

    return CommandeResumeOut(
        lignes=lignes,
        montant_total=montant_total,
        seuil_fournisseur=settings.seuil_fournisseur,
        seuil_atteint=seuil_atteint,
        date_calcul=date_calc,
        nb_lignes=len(lignes),
        nb_produits_prevision=len(lignes),
        nb_lignes_a_commander=len(a_commander),
        nb_unites_total=sum(l.qte_commande for l in a_commander),
        horizon_jours=settings.forecast_horizon_days,
        reference_commande=ref,
        demande_cumul_14j=round(sum(l.demande_prevue for l in lignes), 2),
        besoin_cumul_14j=round(sum(l.besoin_total for l in lignes), 2),
    )
