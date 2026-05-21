"""Tables miroir du dump MySQL app_db.sql."""

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AppFacture(Base):
    __tablename__ = "app_factures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    path: Mapped[str] = mapped_column(Text)


class AppHistoriqueVente(Base):
    __tablename__ = "app_historique_vente"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nom_tpe: Mapped[str] = mapped_column(String(50), index=True)
    datetime: Mapped[datetime] = mapped_column(DateTime, index=True)
    status: Mapped[int] = mapped_column(Integer, default=0)


class AppLimite(Base):
    __tablename__ = "app_limites"

    code_article: Mapped[str] = mapped_column(String(20), primary_key=True)
    sup: Mapped[int | None] = mapped_column(Integer, nullable=True)
    inf: Mapped[int | None] = mapped_column(Integer, nullable=True)


class AppLog(Base):
    __tablename__ = "app_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    datetime: Mapped[datetime] = mapped_column(DateTime)
    detail: Mapped[str] = mapped_column(Text)


class AppStock(Base):
    __tablename__ = "app_stock"

    code_article: Mapped[str] = mapped_column(String(20), primary_key=True)
    designation: Mapped[str] = mapped_column(Text)
    quantite: Mapped[float] = mapped_column(Float, default=0)


class AppTpeCodeArticle(Base):
    __tablename__ = "app_tpe_code_article"

    code_article: Mapped[str] = mapped_column(String(20), primary_key=True)
    nom_tpe: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    type: Mapped[str] = mapped_column(String(32))
    debit_factor: Mapped[float] = mapped_column(Float, default=1.0)
