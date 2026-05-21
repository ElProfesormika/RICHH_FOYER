from __future__ import annotations

import numpy as np
import pandas as pd

from app.config import settings
from app.ml.forecast import compute_safety_stock, rupture_risk


def build_order_lines(
    produits: list[dict],
    seuil: float | None = None,
) -> tuple[pd.DataFrame, float, bool]:
    seuil_val = seuil if seuil is not None else settings.seuil_fournisseur
    rows = []

    for p in produits:
        if p.get("stock_securite") is not None:
            ss = float(p["stock_securite"])
        else:
            ss = compute_safety_stock(
                p.get("sigma", 0),
                p.get("delai", settings.lead_time_days),
            )
        d = p["demande_prevue"]
        s = p["stock"]
        qte = max(0, int(np.ceil(d + ss - s)))
        montant = qte * p["prix_achat"]
        rows.append(
            {
                "produit": p["nom"],
                "produit_id": p.get("id"),
                "stock": s,
                "demande_prevue": round(d, 2),
                "stock_securite": round(ss, 2),
                "qte_commande": qte,
                "prix_achat": p["prix_achat"],
                "montant": round(montant, 2),
                "mae": p.get("mae"),
                "risque_rupture": rupture_risk(s, d, ss),
            }
        )

    df = pd.DataFrame(rows)
    montant_total = float(df["montant"].sum()) if len(df) else 0.0
    seuil_atteint = montant_total >= seuil_val

    if montant_total > 0 and montant_total < seuil_val:
        ratio = seuil_val / montant_total
        df["qte_commande"] = (df["qte_commande"] * ratio).round().astype(int)
        df["montant"] = (df["qte_commande"] * df["prix_achat"]).round(2)
        montant_total = float(df["montant"].sum())
        seuil_atteint = montant_total >= seuil_val

    return df, montant_total, seuil_atteint
