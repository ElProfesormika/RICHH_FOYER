from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error
from xgboost import XGBRegressor

from app.config import settings
from app.ml.features import FEATURE_COLUMNS, build_features


def _predict_one_day(model: XGBRegressor, history: pd.DataFrame, target_day: date) -> float:
    history = history.copy()
    history["jour"] = pd.to_datetime(history["jour"])
    row = {
        "jour": pd.Timestamp(target_day),
        "quantite": history.iloc[-1]["quantite"] if len(history) else 0,
    }
    extended = pd.concat([history, pd.DataFrame([row])], ignore_index=True)
    feat = build_features(extended).iloc[-1:]
    X = feat[FEATURE_COLUMNS].fillna(0)
    return float(model.predict(X)[0])


def forecast_product(
    daily: pd.DataFrame,
    horizon_days: int | None = None,
    min_history: int | None = None,
) -> dict | None:
    horizon = horizon_days or settings.forecast_horizon_days
    min_hist = min_history or settings.min_history_days

    if len(daily) < min_hist:
        return None

    data = build_features(daily.copy())
    data = data.dropna(subset=["lag_28"])

    if len(data) < 30:
        return None

    split = int(len(data) * 0.8)
    train = data.iloc[:split]
    test = data.iloc[split:]

    X_train = train[FEATURE_COLUMNS]
    y_train = train["quantite"]
    X_test = test[FEATURE_COLUMNS]
    y_test = test["quantite"]

    model = XGBRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=6,
        random_state=42,
        objective="reg:squarederror",
    )
    model.fit(X_train, y_train)

    mae = float(mean_absolute_error(y_test, model.predict(X_test))) if len(test) else 0.0

    history = data[["jour", "quantite"]].copy()
    last_day = pd.to_datetime(history["jour"].max()).date()
    preds = []
    for i in range(1, horizon + 1):
        target = last_day + timedelta(days=i)
        p = max(0.0, _predict_one_day(model, history, target))
        preds.append(p)
        history = pd.concat(
            [
                history,
                pd.DataFrame([{"jour": pd.Timestamp(target), "quantite": round(p)}]),
            ],
            ignore_index=True,
        )

    demande_horizon = float(np.sum(preds))
    sigma = float(data["quantite"].std() or 0.0)

    return {
        "demande_prevue": demande_horizon,
        "demande_jour_moyenne": demande_horizon / horizon,
        "mae": mae,
        "sigma": sigma,
        "predictions_journalieres": preds,
    }


def compute_safety_stock(sigma: float, lead_time: int, z: float | None = None) -> float:
    z_val = z if z is not None else settings.service_level_z
    return max(0.0, z_val * sigma * np.sqrt(lead_time))


def rupture_risk(stock: int, demande: float, ss: float) -> str:
    besoin = demande + ss
    if stock <= 0:
        return "critique"
    if stock < besoin * 0.5:
        return "eleve"
    if stock < besoin:
        return "moyen"
    return "faible"
