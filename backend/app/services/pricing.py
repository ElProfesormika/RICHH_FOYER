"""Prix vente/achat — chargement CSV et valeurs par défaut."""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from app.config import settings

STOCK_PLANCHER = 5
PRIX_ACHAT_RATIO = 0.6
DEFAULT_PRIX_VENTE_TTC = 0.65
DEFAULT_PRIX_ACHAT = 0.39


def norm_name(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _parse_price(val) -> float:
    if pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    return float(str(val).replace(",", "."))


def load_csv_price_maps(
    csv_path: str | None = None,
) -> tuple[dict[str, float], dict[str, float]]:
    """Retourne (noms exacts, noms normalisés) → prix vente TTC moyen."""
    path = csv_path or settings.csv_path
    if not path or not Path(path).is_file():
        return {}, {}
    df = pd.read_csv(path, sep=";")
    df["Tarif"] = df["Tarif TTC"].apply(_parse_price)
    exact = df.groupby("Produit")["Tarif"].mean().round(2).to_dict()
    exact = {str(k): float(v) for k, v in exact.items()}
    by_norm = {norm_name(k): v for k, v in exact.items()}
    return exact, by_norm


def lookup_csv_price(
    nom: str,
    exact: dict[str, float],
    by_norm: dict[str, float],
    aliases: list[str] | None = None,
) -> float:
    if nom in exact:
        return exact[nom]
    key = norm_name(nom)
    if key in by_norm:
        return by_norm[key]
    for alias in aliases or []:
        if alias in exact:
            return exact[alias]
        ak = norm_name(alias)
        if ak in by_norm:
            return by_norm[ak]
    for nk, price in by_norm.items():
        if len(nk) >= 4 and (nk in key or key in nk):
            return price
    return 0.0


def resolve_prix_achat(prix_achat: float, prix_vente_ttc: float) -> float:
    if prix_achat > 0:
        return round(float(prix_achat), 2)
    if prix_vente_ttc > 0:
        return round(float(prix_vente_ttc) * PRIX_ACHAT_RATIO, 2)
    return DEFAULT_PRIX_ACHAT


def resolve_prix_vente(prix_vente_ttc: float) -> float:
    if prix_vente_ttc > 0:
        return round(float(prix_vente_ttc), 2)
    return DEFAULT_PRIX_VENTE_TTC
