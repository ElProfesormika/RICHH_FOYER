"""Import des données depuis app_db.sql (dump MySQL du foyer)."""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    CommandeSuggestion,
    Prevision,
    Produit,
    Vente,
    VenteJournaliere,
)
from app.models_appdb import (
    AppFacture,
    AppHistoriqueVente,
    AppLimite,
    AppLog,
    AppStock,
    AppTpeCodeArticle,
)
from app.services.pricing import (
    PRIX_ACHAT_RATIO,
    STOCK_PLANCHER,
    load_csv_price_maps,
    lookup_csv_price,
    resolve_prix_achat,
    resolve_prix_vente,
)
from app.services.mysql_dump_parser import parse_datetime, parse_dump_tables

logger = logging.getLogger(__name__)

CHUNK = 3000

# Correspondances TPE historique → code article Metro (nom affiché caisse)
NOM_TO_CODE: dict[str, str] = {
    "barquette chocolat": "0433433",
    "barquettes (choc/fraise)": "0433433",
    "oreo": "1153436",
    "granola": "1516475",
    "lion peanut": "1764182",
    "lion": "1768167",
    "coca cola": "1858885",
    "coca-cola": "1858885",
    "coca cola cherry": "2029551",
    "coca zéro": "2029536",
    "coca zero": "2029536",
    "kit kat": "1873694",
    "kit-kat": "1873694",
    "schweppes agrumes": "2015642",
    "schweppes citron": "2015667",
    "schweppes pomme": "2015675",
    "oasis tropical": "2015683",
    "oasis": "2015683",
    "oasis pcf": "2687697",
    "cacolac": "2025856",
    "fanta orange": "2029692",
    "fanta": "2029692",
    "fanta citron": "2031458",
    "fanta mangue/dragon": "2461713",
    "kinder delice": "2137701",
    "kinder bueno": "2155760",
    "kinder bueno/white": "2156503",
    "kinder bueno white": "2156503",
    "kinder maxi": "2156891",
    "fuze tea peche": "2200434",
    "fuze tea cannette": "2200434",
    "fuzetea menthe/citron": "2645380",
    "monster mango loco": "2461440",
    "monster": "2461440",
    "monster pipeline punch": "2989598",
    "monster ultra zero": "3104171",
    "prince": "2467561",
    "milka cookies": "2469567",
    "milka cookie": "2469567",
    "milka choco brownie": "2470995",
    "milka brownie": "2470995",
    "bounty": "2469658",
    "m&ms": "2471712",
    "dragibus": "2473296",
    "dragibus 40g": "2473296",
    "petit écolier": "2474799",
    "napolitains": "2475739",
    "napolitain": "2475739",
    "twix": "2476455",
    "lait": "2477057",
    "lait végé": "2477057",
    "+ lait végé": "2477057",
    "vége cacafé au lait": "2477057",
    "cacafé au lait": "2477057",
    "minute maid": "2817583",
    "minute maid pomme": "2817583",
    "san pell": "2816155",
    "san pelle nature": "2816155",
    "dada cerise": "2882926",
    "dada": "2882926",
    "mars": "3055324",
    "+ marschmallow": "3055324",
    "snickers": "3055332",
    "7up mojito": "3082658",
    "dr pepper": "3132735",
}


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _find_code(nom: str, tpe_by_norm: dict[str, AppTpeCodeArticle]) -> str | None:
    key = _norm(nom)
    if key in NOM_TO_CODE:
        return NOM_TO_CODE[key]
    if nom in NOM_TO_CODE:
        return NOM_TO_CODE[nom]
    tpe = tpe_by_norm.get(key)
    if tpe:
        return tpe.code_article
    for tpe_nom, row in tpe_by_norm.items():
        if tpe_nom in key or key in tpe_nom:
            return row.code_article
    return None


def clear_all_data(db: Session) -> None:
    db.query(CommandeSuggestion).delete()
    db.query(Prevision).delete()
    db.query(Vente).delete()
    db.query(VenteJournaliere).delete()
    db.query(Produit).delete()
    db.query(AppHistoriqueVente).delete()
    db.query(AppLimite).delete()
    db.query(AppTpeCodeArticle).delete()
    db.query(AppStock).delete()
    db.query(AppFacture).delete()
    db.query(AppLog).delete()
    db.commit()


def _bulk_chunks(db: Session, model, rows: list[dict]) -> int:
    total = 0
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i : i + CHUNK]
        db.bulk_insert_mappings(model, chunk)
        total += len(chunk)
    return total


def import_app_db(
    db: Session,
    sql_path: str | None = None,
    *,
    clear_existing: bool = False,
) -> dict:
    path = sql_path or settings.app_db_sql_path
    if not Path(path).is_file():
        raise FileNotFoundError(f"Dump SQL introuvable : {path}")

    if clear_existing or db.query(Produit).count() > 0:
        logger.info("Réinitialisation des tables avant import app_db…")
        clear_all_data(db)

    tables = parse_dump_tables(path)
    logger.info(
        "Tables parsées : %s",
        {k: len(v) for k, v in tables.items()},
    )

    # --- Miroir app_db ---
    stock_rows = [
        {
            "code_article": r[0],
            "designation": r[1],
            "quantite": float(r[2]),
        }
        for r in tables.get("stock", [])
    ]
    tpe_rows = [
        {
            "code_article": r[0],
            "nom_tpe": r[1],
            "type": r[2],
            "debit_factor": float(r[3]),
        }
        for r in tables.get("tpe_code_article", [])
    ]
    hist_rows = [
        {
            "id": int(r[0]),
            "nom_tpe": r[1],
            "datetime": parse_datetime(r[2]) if isinstance(r[2], str) else r[2],
            "status": int(r[3]),
        }
        for r in tables.get("historique_vente", [])
    ]
    lim_rows = [
        {
            "code_article": r[0],
            "sup": int(r[1]) if r[1] is not None else None,
            "inf": int(r[2]) if r[2] is not None else None,
        }
        for r in tables.get("limites", [])
    ]
    fact_rows = [
        {"id": int(r[0]), "name": r[1], "path": r[2]}
        for r in tables.get("factures", [])
    ]
    log_rows = [
        {
            "id": int(r[0]),
            "datetime": parse_datetime(r[1]) if isinstance(r[1], str) else r[1],
            "detail": r[2],
        }
        for r in tables.get("logs", [])
    ]

    _bulk_chunks(db, AppStock, stock_rows)
    _bulk_chunks(db, AppTpeCodeArticle, tpe_rows)
    _bulk_chunks(db, AppHistoriqueVente, hist_rows)
    _bulk_chunks(db, AppLimite, lim_rows)
    _bulk_chunks(db, AppFacture, fact_rows)
    _bulk_chunks(db, AppLog, log_rows)
    db.flush()

    stock_map = {s.code_article: s for s in db.query(AppStock).all()}
    tpe_list = db.query(AppTpeCodeArticle).all()
    tpe_by_norm = {_norm(t.nom_tpe): t for t in tpe_list}
    tpe_by_code = {t.code_article: t for t in tpe_list}
    exact_prices, norm_prices = load_csv_price_maps(settings.csv_path)

    # Ventes par jour / nom TPE
    daily: dict[tuple[date, str], int] = defaultdict(int)
    noms_historique: set[str] = set()
    for hv in db.query(AppHistoriqueVente).yield_per(5000):
        noms_historique.add(hv.nom_tpe)
        daily[(hv.datetime.date(), hv.nom_tpe)] += 1

    jours_periode = 1
    if daily:
        jours = {k[0] for k in daily}
        jours_periode = max(1, (max(jours) - min(jours)).days + 1)

    ventes_par_nom = defaultdict(int)
    for (_, nom), q in daily.items():
        ventes_par_nom[nom] += q

    # --- Produits analytiques ---
    for nom in sorted(noms_historique):
        code = _find_code(nom, tpe_by_norm)
        tpe = tpe_by_code.get(code) if code else None
        stock_row = stock_map.get(code) if code else None

        aliases = [tpe.nom_tpe] if tpe else []
        prix_vente = lookup_csv_price(nom, exact_prices, norm_prices, aliases)
        prix_vente = resolve_prix_vente(prix_vente)
        prix_achat = resolve_prix_achat(
            round(prix_vente * PRIX_ACHAT_RATIO, 2) if prix_vente > 0 else 0.0,
            prix_vente,
        )

        if stock_row is not None:
            stock_actuel = max(0, int(stock_row.quantite))
        else:
            moy_jour = ventes_par_nom[nom] / jours_periode
            stock_actuel = max(
                STOCK_PLANCHER,
                int(moy_jour * settings.forecast_horizon_days),
            )

        db.add(
            Produit(
                nom=nom,
                code_article=code,
                type_produit=tpe.type if tpe else None,
                debit_factor=tpe.debit_factor if tpe else 1.0,
                prix_vente_ttc=prix_vente,
                prix_achat=prix_achat,
                stock_actuel=stock_actuel,
            )
        )

    db.flush()
    nom_to_id = {p.nom: p.id for p in db.query(Produit).all()}

    vj_records = []
    for (jour, nom), quantite in daily.items():
        pid = nom_to_id.get(nom)
        if pid:
            vj_records.append(
                {"jour": jour, "produit_id": pid, "quantite": quantite}
            )

    if vj_records:
        _bulk_chunks(db, VenteJournaliere, vj_records)

    db.commit()

    metro = db.query(Produit).filter(Produit.code_article.isnot(None)).count()
    return {
        "source": "app_db.sql",
        "fichier": path,
        "tables_miroir": {
            "stock": len(stock_rows),
            "tpe_code_article": len(tpe_rows),
            "historique_vente": len(hist_rows),
            "limites": len(lim_rows),
            "factures": len(fact_rows),
            "logs": len(log_rows),
        },
        "produits": db.query(Produit).count(),
        "produits_metro": metro,
        "ventes_journalieres": db.query(VenteJournaliere).count(),
        "jours": db.query(VenteJournaliere.jour).distinct().count(),
        "ventes_historique": len(hist_rows),
    }
