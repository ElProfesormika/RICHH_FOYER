from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://foyer:foyer_secret@localhost:5432/foyer_stock"
    app_db_sql_path: str = "/home/el-professor/Bureau/Rich/app_db.sql"
    csv_path: str = "/home/el-professor/Bureau/Rich/Rapport vente.csv"
    import_source: str = "app_db"  # app_db | csv
    force_reimport: bool = False
    seuil_fournisseur: float = 400.0
    lead_time_days: int = 3
    service_level_z: float = 1.65
    forecast_horizon_days: int = 14
    min_history_days: int = 60

    class Config:
        env_file = ".env"


settings = Settings()
