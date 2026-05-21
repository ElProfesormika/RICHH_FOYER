from fastapi import APIRouter

from app.config import settings

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("/metier")
def get_config_metier():
    """Paramètres métier affichés dans l'interface."""
    return {
        "horizon_jours": settings.forecast_horizon_days,
        "z_service": settings.service_level_z,
        "lead_time_jours": settings.lead_time_days,
        "seuil_fournisseur_eur": settings.seuil_fournisseur,
        "prix_achat_ratio": 0.6,
        "stock_init_jours": settings.forecast_horizon_days,
        "stock_plancher": 5,
        "import_source": settings.import_source,
        "app_db_sql_path": settings.app_db_sql_path,
    }
