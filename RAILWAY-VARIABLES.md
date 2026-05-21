# Variables Railway — Foyer_UTT

## Vous voyez du JSON dans le navigateur ?

C’est **normal** si vous ouvrez l’URL du service **API** (backend).  
Exemple : `https://xxx-api.up.railway.app/` → `{"app":"Foyer_UTT",...}`

**L’interface graphique** est sur l’URL du service **frontend** (autre domaine).

---

## Où trouver les URLs

Railway → votre projet → chaque service → **Settings → Networking → Public domain**

| Service | Rôle | Exemple d’URL |
|---------|------|----------------|
| **api** (backend) | API + docs | `https://richhfoyer-production.up.railway.app` |
| **frontend** (web) | **À ouvrir dans Chrome** | `https://richhfoyer-frontend.up.railway.app` |
| **Postgres** | Base (pas d’URL web) | — |

---

## Service API (backend) — Variables

| Variable | Valeur à mettre |
|----------|-----------------|
| **DATABASE_URL** | `postgresql://postgres:fiFkVwwyZwFPZuCfBKrfaWuebAKpadhq@kodama.proxy.rlwy.net:20266/railway` *(votre valeur Postgres — correcte)* |
| **APP_DB_SQL_PATH** | `/data/app_db.sql` |
| **CSV_PATH** | `/data/rapport_vente.csv` |
| **IMPORT_SOURCE** | `app_db` |
| **FORCE_REIMPORT** | `false` |
| **SEUIL_FOURNISSEUR** | `400` |
| **LEAD_TIME_DAYS** | `3` |
| **SERVICE_LEVEL_Z** | `1.65` |
| **FORECAST_HORIZON_DAYS** | `14` |
| **FRONTEND_URL** | **URL complète du frontend** avec `https://` |

### FRONTEND_URL — 2 options

**Option A** (si le service s’appelle exactement `frontend` sur Railway) :

```
https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
```

**Option B** (recommandée — copier-coller l’URL réelle) :

```
https://VOTRE-DOMAINE-FRONTEND.up.railway.app
```

*(Remplacez par le domaine affiché dans Networking du service frontend.)*

---

## Service Frontend (web) — Variables

| Variable | Valeur à mettre |
|----------|-----------------|
| **VITE_API_BASE_URL** ou **API_BASE_URL** | URL de l’API + `/api` |

**Option A** (référence Railway, service API nommé `api`) :

```
https://${{api.RAILWAY_PUBLIC_DOMAIN}}/api
```

**Option B** (recommandée — URL réelle de votre API) :

```
https://VOTRE-DOMAINE-API.up.railway.app/api
```

Exemple si l’API est `https://richhfoyer-production.up.railway.app` :

```
https://richhfoyer-production.up.railway.app/api
```

Après modification → **Redeploy** le service frontend.

---

## Ce qu’il ne faut PAS faire

| Erreur | Pourquoi |
|--------|----------|
| Ouvrir l’URL de l’API pour l’UI | Vous voyez seulement du JSON |
| Mettre `DATABASE_URL` sur le frontend | Inutile et dangereux |
| Laisser `*******` / vide sur les variables numériques | Mettre les valeurs du tableau |
| Oublier `https://` | CORS et appels API échouent |

---

## Vérifications

```bash
# API vivante
curl https://VOTRE-API.up.railway.app/api/health/live

# Données chargées (après 2–5 min)
curl https://VOTRE-API.up.railway.app/api/health

# Frontend : ouvrir dans le navigateur
https://VOTRE-FRONTEND.up.railway.app
```

---

## Noms de services Railway

Les références `${{api....}}` et `${{frontend....}}` ne marchent que si les services s’appellent **exactement** `api` et `frontend`.  
Sinon, utilisez toujours les **URLs complètes** (option B).
