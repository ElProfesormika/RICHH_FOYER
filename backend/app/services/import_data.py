from datetime import date

import pandas as pd
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Produit, VenteJournaliere
from app.services.pricing import PRIX_ACHAT_RATIO, STOCK_PLANCHER, _parse_price


def import_csv(db: Session, csv_path: str | None = None) -> dict:
    path = csv_path or settings.csv_path
    df = pd.read_csv(path, sep=";")
    df["Date"] = pd.to_datetime(df["Date"])
    df["Jour"] = df["Date"].dt.date
    df["Tarif"] = df["Tarif TTC"].apply(_parse_price)

    produits_df = (
        df.groupby("Produit")
        .agg(prix_vente=("Tarif", "mean"), ventes=("Produit", "count"))
        .reset_index()
    )

    jours_periode = max(1, (df["Jour"].max() - df["Jour"].min()).days + 1)

    for _, row in produits_df.iterrows():
        nom = row["Produit"]
        prix_vente = round(row["prix_vente"], 2)
        prix_achat = round(prix_vente * PRIX_ACHAT_RATIO, 2)
        produit = db.query(Produit).filter(Produit.nom == nom).first()
        if produit:
            produit.prix_vente_ttc = prix_vente
            if produit.prix_achat <= 0:
                produit.prix_achat = prix_achat
        else:
            moy_jour = int(row["ventes"]) / jours_periode
            stock_init = max(
                STOCK_PLANCHER,
                int(moy_jour * settings.forecast_horizon_days),
            )
            db.add(
                Produit(
                    nom=nom,
                    prix_vente_ttc=prix_vente,
                    prix_achat=prix_achat,
                    stock_actuel=stock_init,
                )
            )

    db.flush()
    produit_map = {p.nom: p.id for p in db.query(Produit).all()}

    db.query(VenteJournaliere).delete()
    daily = (
        df.groupby(["Jour", "Produit"])
        .size()
        .reset_index(name="quantite")
    )

    records = []
    for _, r in daily.iterrows():
        pid = produit_map.get(r["Produit"])
        if not pid:
            continue
        jour = r["Jour"] if isinstance(r["Jour"], date) else r["Jour"]
        records.append(
            {
                "jour": jour,
                "produit_id": pid,
                "quantite": int(r["quantite"]),
            }
        )

    if records:
        db.bulk_insert_mappings(VenteJournaliere, records)

    db.commit()

    total_ventes = int(daily["quantite"].sum()) if len(daily) else 0
    return {
        "lignes_csv": len(df),
        "produits": db.query(Produit).count(),
        "ventes": total_ventes,
        "jours": db.query(VenteJournaliere.jour).distinct().count(),
    }
