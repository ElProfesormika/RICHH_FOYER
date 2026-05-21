from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.ml.forecast import rupture_risk
from app.models import Prevision, Produit, Vente, VenteJournaliere


def enregistrer_vente(
    db: Session,
    produit_id: int,
    quantite: int = 1,
) -> dict:
    if quantite < 1:
        raise HTTPException(400, "La quantité doit être au moins 1")

    produit = db.query(Produit).filter(Produit.id == produit_id).first()
    if not produit:
        raise HTTPException(404, "Produit introuvable")

    if produit.stock_actuel < quantite:
        raise HTTPException(
            400,
            f"Stock insuffisant ({produit.stock_actuel} disponible)",
        )

    now = datetime.utcnow()
    today = now.date()

    produit.stock_actuel -= quantite

    db.add(
        Vente(
            date_vente=now,
            jour=today,
            produit_id=produit_id,
            quantite=quantite,
            tarif_ttc=produit.prix_vente_ttc,
        )
    )

    vj = (
        db.query(VenteJournaliere)
        .filter(
            VenteJournaliere.jour == today,
            VenteJournaliere.produit_id == produit_id,
        )
        .first()
    )
    if vj:
        vj.quantite += quantite
    else:
        db.add(
            VenteJournaliere(
                jour=today,
                produit_id=produit_id,
                quantite=quantite,
            )
        )

    prev = (
        db.query(Prevision)
        .filter(Prevision.produit_id == produit_id)
        .order_by(desc(Prevision.id))
        .first()
    )
    if prev:
        prev.risque_rupture = rupture_risk(
            produit.stock_actuel,
            prev.demande_prevue,
            prev.stock_securite,
        )

    db.commit()
    db.refresh(produit)

    return {
        "produit_id": produit.id,
        "produit_nom": produit.nom,
        "quantite": quantite,
        "stock_actuel": produit.stock_actuel,
        "risque_rupture": prev.risque_rupture if prev else "faible",
        "date_vente": now.isoformat(),
    }
