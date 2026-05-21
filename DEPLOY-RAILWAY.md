# Déploiement Foyer_UTT sur Railway

Architecture : **PostgreSQL** + **API FastAPI** + **Frontend React** (3 services).

## Prérequis

- Compte [Railway](https://railway.com)
- Dépôt Git (GitHub / GitLab) avec ce projet
- Fichiers de données à la racine : `app_db.sql`, `Rapport vente.csv` (commités)

## 1. Créer le projet

1. [railway.com/new](https://railway.com/new) → **Deploy from GitHub repo**
2. Sélectionner le dépôt `Rich` (ou le nom de votre repo)

## 2. Service PostgreSQL

1. Dans le projet : **+ New** → **Database** → **PostgreSQL**
2. Attendre que le service soit **Active**
3. Onglet **Variables** : noter `DATABASE_URL` (référence `${{Postgres.DATABASE_URL}}`)

## 3. Service API (backend)

1. **+ New** → **GitHub Repo** → même repo (ou **Empty Service** puis connecter le repo)
2. **Settings** du service :
   - **Service name** : `api`
   - **Root Directory** : *(vide — racine du repo)*
   - **Config file** : `railway.toml` (à la racine)
3. **Variables** (onglet Variables → Raw Editor) :

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
APP_DB_SQL_PATH=/data/app_db.sql
CSV_PATH=/data/Rapport vente.csv
IMPORT_SOURCE=app_db
FORCE_REIMPORT=false
SEUIL_FOURNISSEUR=400
LEAD_TIME_DAYS=3
SERVICE_LEVEL_Z=1.65
FORECAST_HORIZON_DAYS=14
FRONTEND_URL=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
```

4. **Networking** → **Generate Domain** (ex. `foyer-utt-api-production.up.railway.app`)
5. Premier déploiement : l’import `app_db.sql` + ML prend **2 à 5 minutes**. Surveiller les logs.
6. Vérifier :
   - `https://VOTRE-API.up.railway.app/api/health/live` → `{"status":"alive"}` (healthcheck Railway)
   - puis `https://VOTRE-API.up.railway.app/api/health` → `"data_ready": true` (après import, 2–5 min)

## 4. Service Frontend (web)

1. **+ New** → même repo
2. **Settings** :
   - **Service name** : `frontend`
   - **Root Directory** : `frontend`
   - **Config file** : `railway.toml`
3. **Variables** → ajouter une variable de **build** :

```env
VITE_API_BASE_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}/api
```

(Remplacez `api` par le nom exact de votre service backend si différent.)

4. **Networking** → **Generate Domain**
5. Mettre à jour l’API : variable `FRONTEND_URL=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}` puis **Redeploy** l’API si CORS bloque le navigateur.

## 5. Ordre de déploiement recommandé

1. Postgres  
2. API (attendre `data_ready: true` dans `/api/health`)  
3. Frontend  

## 6. Réimport des données

```bash
curl -X POST https://VOTRE-API.up.railway.app/api/import/app-db
```

Ou temporairement `FORCE_REIMPORT=true` sur l’API puis redéployer.

## 7. CLI Railway (optionnel)

```bash
npm i -g @railway/cli
railway login
cd /chemin/vers/Rich
railway link
railway up --service api
```

## Dépannage

| Problème | Solution |
|----------|----------|
| Healthcheck failed / service unavailable | Vérifier `DATABASE_URL=${{Postgres.DATABASE_URL}}` ; redéployer après Postgres actif ; healthcheck = `/api/health/live` |
| `data_ready: false` longtemps | Consulter les logs API ; import en cours |
| `db_connected: false` dans `/api/health` | Lier le plugin Postgres au service API |
| Erreur CORS | Vérifier `FRONTEND_URL` sur l’API = URL exacte du frontend |
| Frontend « API indisponible » | Vérifier `VITE_API_BASE_URL` (rebuild frontend après changement) |
| `app_db.sql` introuvable | Root Directory API doit être la **racine** du repo, pas `backend/` |
| Base vide après deploy | `POST /api/import/app-db` ou `FORCE_REIMPORT=true` |

## Coût indicatif

- Postgres + 2 services web : environ 5–15 $/mois selon usage (crédit gratuit Railway au départ).
