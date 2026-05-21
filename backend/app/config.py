import os

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://foyer:foyer_secret@localhost:5432/foyer_stock"
    app_db_sql_path: str = "/data/app_db.sql"
    csv_path: str = "/data/Rapport vente.csv"
    import_source: str = "app_db"  # app_db | csv
    force_reimport: bool = False
    seuil_fournisseur: float = 400.0
    lead_time_days: int = 3
    service_level_z: float = 1.65
    forecast_horizon_days: int = 14
    min_history_days: int = 60
    cors_origins: str = "*"
    frontend_url: str | None = None

    @field_validator("frontend_url", mode="before")
    @classmethod
    def normalize_frontend_url(cls, v: str | None) -> str | None:
        if v and str(v).strip() not in ("", "https://", "http://"):
            u = str(v).strip().rstrip("/")
            if not u.startswith("http"):
                u = f"https://{u}"
            return u
        domain = os.getenv("RAILWAY_PUBLIC_DOMAIN", "").strip()
        if domain:
            return f"https://{domain}"
        return None

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            origins: list[str] = ["*"]
        else:
            origins = [
                o.strip()
                for o in self.cors_origins.split(",")
                if o.strip()
            ]
        if self.frontend_url:
            url = self.frontend_url.rstrip("/")
            if url not in origins and "*" not in origins:
                origins.append(url)
        return origins or ["*"]


settings = Settings()
