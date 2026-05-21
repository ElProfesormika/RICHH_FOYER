from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Produit(Base):
    __tablename__ = "produits"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    code_article: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    type_produit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    debit_factor: Mapped[float] = mapped_column(Float, default=1.0)
    prix_vente_ttc: Mapped[float] = mapped_column(Float, default=0.0)
    prix_achat: Mapped[float] = mapped_column(Float, default=0.0)
    stock_actuel: Mapped[int] = mapped_column(Integer, default=0)
    delai_fournisseur_jours: Mapped[int] = mapped_column(Integer, default=3)

    ventes: Mapped[list["Vente"]] = relationship(back_populates="produit")
    previsions: Mapped[list["Prevision"]] = relationship(back_populates="produit")


class Vente(Base):
    __tablename__ = "ventes"

    id: Mapped[int] = mapped_column(primary_key=True)
    date_vente: Mapped[datetime] = mapped_column(DateTime, index=True)
    jour: Mapped[date] = mapped_column(Date, index=True)
    produit_id: Mapped[int] = mapped_column(ForeignKey("produits.id"), index=True)
    quantite: Mapped[int] = mapped_column(Integer, default=1)
    tarif_ttc: Mapped[float] = mapped_column(Float, default=0.0)
    panier_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    produit: Mapped["Produit"] = relationship(back_populates="ventes")


class VenteJournaliere(Base):
    __tablename__ = "ventes_journalieres"
    __table_args__ = (UniqueConstraint("jour", "produit_id", name="uq_jour_produit"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    jour: Mapped[date] = mapped_column(Date, index=True)
    produit_id: Mapped[int] = mapped_column(ForeignKey("produits.id"), index=True)
    quantite: Mapped[int] = mapped_column(Integer, default=0)

    produit: Mapped["Produit"] = relationship()


class Prevision(Base):
    __tablename__ = "previsions"

    id: Mapped[int] = mapped_column(primary_key=True)
    produit_id: Mapped[int] = mapped_column(ForeignKey("produits.id"), index=True)
    date_calcul: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    horizon_jours: Mapped[int] = mapped_column(Integer, default=14)
    demande_prevue: Mapped[float] = mapped_column(Float)
    mae: Mapped[float | None] = mapped_column(Float, nullable=True)
    stock_securite: Mapped[float] = mapped_column(Float, default=0.0)
    risque_rupture: Mapped[str] = mapped_column(String(20), default="faible")

    produit: Mapped["Produit"] = relationship(back_populates="previsions")


class CommandeSuggestion(Base):
    __tablename__ = "commandes_suggestions"

    id: Mapped[int] = mapped_column(primary_key=True)
    date_calcul: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    produit_id: Mapped[int] = mapped_column(ForeignKey("produits.id"), index=True)
    qte_commande: Mapped[int] = mapped_column(Integer, default=0)
    montant: Mapped[float] = mapped_column(Float, default=0.0)
    montant_total: Mapped[float] = mapped_column(Float, default=0.0)
    seuil_atteint: Mapped[bool] = mapped_column(default=False)

    produit: Mapped["Produit"] = relationship()
