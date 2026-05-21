from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Produit
from app.models_appdb import AppStock
from app.schemas import ProduitOut, ProduitUpdate
from app.services.ml_pipeline import refresh_after_stock_change

router = APIRouter(prefix="/api/produits", tags=["produits"])


@router.get("", response_model=list[ProduitOut])
def list_produits(db: Session = Depends(get_db)):
    return db.query(Produit).order_by(Produit.nom).all()


@router.patch("/{produit_id}", response_model=ProduitOut)
def update_produit(
    produit_id: int,
    body: ProduitUpdate,
    db: Session = Depends(get_db),
):
    p = db.query(Produit).filter(Produit.id == produit_id).first()
    if not p:
        raise HTTPException(404, "Produit introuvable")
    stock_changed = False
    if body.stock_actuel is not None:
        p.stock_actuel = body.stock_actuel
        stock_changed = True
        if p.code_article:
            metro = (
                db.query(AppStock)
                .filter(AppStock.code_article == p.code_article)
                .first()
            )
            if metro:
                metro.quantite = float(body.stock_actuel)
    if body.prix_achat is not None:
        p.prix_achat = body.prix_achat

    if stock_changed:
        refresh_after_stock_change(db, produit_id)

    db.commit()
    db.refresh(p)
    return p
