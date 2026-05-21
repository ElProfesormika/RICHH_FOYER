# Foyer — Gestion stocks & commandes intelligentes

Application d'aide à la décision : prévision XGBoost, stocks temps réel, commande fournisseur (seuil 400 EUR).

## Données conservées

- `Rapport vente.csv` — historique des ventes
- `app_db.sql` — export MySQL (référence)
- `factures_metro_analyse_prix (1).xlsx` — factures Metro

## Démarrage

### Terminal 1 — PostgreSQL

```bash
docker run -d -p 5432:5432 \
  -e POSTGRES_USER=foyer \
  -e POSTGRES_PASSWORD=foyer_secret \
  -e POSTGRES_DB=foyer_stock \
  postgres:16-alpine
```

### Terminal 2 — API

```bash
cd /home/el-professor/Bureau/Rich
./start-api.sh
```

### Terminal 3 — Interface React

```bash
cd /home/el-professor/Bureau/Rich
./start-frontend.sh
```

Ouvrir l'URL affichée par Vite (souvent http://localhost:5173).

## Fonctionnalités

- Tableau de bord : KPI, ventes, alertes stock, graphiques
- Mode jour / mode nuit (préférence sauvegardée)
- Enregistrement des ventes → stock mis à jour automatiquement
- Commande suggérée (XGBoost + seuil 400 EUR)
- Export CSV des lignes de commande

## API

| Route | Description |
|-------|-------------|
| GET `/api/health` | État de l'API |
| GET `/api/dashboard/kpi` | Indicateurs |
| GET `/api/dashboard/stocks-overview` | Stocks + prévisions |
| POST `/api/ventes` | Enregistrer une vente |
| GET `/api/ml/commande` | Commande suggérée |
| POST `/api/ml/run` | Recalculer prévisions |
