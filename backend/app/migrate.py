"""Migrations légères (colonnes / tables manquantes)."""

from sqlalchemy import inspect, text

from app.database import engine


def run_migrations() -> None:
    insp = inspect(engine)
    tables = set(insp.get_table_names())

    with engine.begin() as conn:
        if "produits" in tables:
            cols = {c["name"] for c in insp.get_columns("produits")}
            if "code_article" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE produits ADD COLUMN code_article VARCHAR(20)"
                    )
                )
            if "type_produit" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE produits ADD COLUMN type_produit VARCHAR(32)"
                    )
                )
            if "debit_factor" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE produits ADD COLUMN debit_factor "
                        "DOUBLE PRECISION DEFAULT 1.0"
                    )
                )
