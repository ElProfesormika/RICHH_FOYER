import pandas as pd

from app.ml.vacances import is_vacances


FEATURE_COLUMNS = [
    "lag_1",
    "lag_7",
    "lag_14",
    "lag_28",
    "rolling_mean_7",
    "rolling_mean_30",
    "rolling_std_30",
    "dow",
    "month",
    "week",
    "is_weekend",
    "vacances",
]


def build_features(data: pd.DataFrame) -> pd.DataFrame:
    data = data.sort_values("jour").copy()
    data["jour"] = pd.to_datetime(data["jour"])

    data["lag_1"] = data["quantite"].shift(1)
    data["lag_7"] = data["quantite"].shift(7)
    data["lag_14"] = data["quantite"].shift(14)
    data["lag_28"] = data["quantite"].shift(28)

    shifted = data["quantite"].shift(1)
    data["rolling_mean_7"] = shifted.rolling(7, min_periods=1).mean()
    data["rolling_mean_30"] = shifted.rolling(30, min_periods=1).mean()
    data["rolling_std_30"] = shifted.rolling(30, min_periods=2).std().fillna(0)

    data["dow"] = data["jour"].dt.dayofweek
    data["month"] = data["jour"].dt.month
    data["week"] = data["jour"].dt.isocalendar().week.astype(int)
    data["is_weekend"] = (data["dow"] >= 5).astype(int)
    data["vacances"] = data["jour"].dt.date.map(lambda d: int(is_vacances(d)))

    return data
