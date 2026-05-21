from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Produit, Vente
from app.schemas import VenteCreate, VenteRecenteOut, VenteResponse
from app.services.ventes import enregistrer_vente

router = APIRouter(prefix="/api/ventes", tags=["ventes"])


@router.post("", response_model=VenteResponse)
def creer_vente(body: VenteCreate, db: Session = Depends(get_db)):
    result = enregistrer_vente(db, body.produit_id, body.quantite)
    return VenteResponse(**result)


@router.get("/recentes", response_model=list[VenteRecenteOut])
def ventes_recentes(
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
):
    rows = (
        db.query(Vente, Produit)
        .join(Produit, Produit.id == Vente.produit_id)
        .order_by(desc(Vente.date_vente))
        .limit(limit)
        .all()
    )
    return [
        VenteRecenteOut(
            id=v.id,
            produit_nom=p.nom,
            quantite=v.quantite,
            tarif_ttc=v.tarif_ttc,
            date_vente=v.date_vente,
            stock_restant=p.stock_actuel,
        )
        for v, p in rows
    ]


@router.get("/aujourdhui")
def ventes_aujourdhui(db: Session = Depends(get_db)):
    today = date.today()
    total = (
        db.query(func.coalesce(func.sum(Vente.quantite), 0))
        .filter(Vente.jour == today)
        .scalar()
    )
    return {"jour": today.isoformat(), "total_ventes": int(total or 0)}
