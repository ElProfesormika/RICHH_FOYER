# Railway — une seule URL : foyer-utt-production.up.railway.app

L’**interface** et l’**API** sont sur le **même service** :
- `https://foyer-utt-production.up.railway.app/` → tableau de bord React
- `https://foyer-utt-production.up.railway.app/api/...` → API
- `https://foyer-utt-production.up.railway.app/docs` → documentation API

---

## Variables du service (API unique)

| Variable | Valeur |
|----------|--------|
| **DATABASE_URL** | `postgresql://postgres:...@kodama.proxy.rlwy.net:20266/railway` *(votre URL Postgres)* |
| **FRONTEND_URL** | `https://foyer-utt-production.up.railway.app` |
| **APP_DB_SQL_PATH** | `/data/app_db.sql` |
| **CSV_PATH** | `/data/rapport_vente.csv` |
| **IMPORT_SOURCE** | `app_db` |
| **FORCE_REIMPORT** | `false` |
| **SEUIL_FOURNISSEUR** | `400` |
| **LEAD_TIME_DAYS** | `3` |
| **SERVICE_LEVEL_Z** | `1.65` |
| **FORECAST_HORIZON_DAYS** | `14` |

**À supprimer / ne pas utiliser** (ancien déploiement 2 services) :
- `VITE_API_BASE_URL` — inutile : le frontend utilise `/api` sur le même domaine
- `https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}` — remplacé par l’URL réelle ci-dessus

`FRONTEND_URL` peut aussi être laissé vide : Railway remplit via `RAILWAY_PUBLIC_DOMAIN` automatiquement.

---

## Après modification

1. **Commit + push** le code (Dockerfile avec frontend intégré)
2. **Redeploy** sur Railway
3. Ouvrir : **https://foyer-utt-production.up.railway.app**

---

## Vérifications

```bash
curl https://foyer-utt-production.up.railway.app/api/health/live
curl https://foyer-utt-production.up.railway.app/api/health
```

Dans le navigateur : la page doit afficher **Foyer_UTT** (sidebar, KPI), pas du JSON.
