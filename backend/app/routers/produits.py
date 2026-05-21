from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Produit
from app.schemas import ProduitOut, ProduitUpdate

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
    if body.stock_actuel is not None:
        p.stock_actuel = body.stock_actuel
    if body.prix_achat is not None:
        p.prix_achat = body.prix_achat
    db.commit()
    db.refresh(p)
    return p
