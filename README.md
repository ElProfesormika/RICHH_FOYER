# Foyer — Gestion stocks & commandes intelligentes

Application d'aide à la décision : prévision XGBoost, stocks temps réel, commande fournisseur (seuil 400 EUR).

## Données

| Fichier | Rôle |
|---------|------|
| **`app_db.sql`** | **Source principale** — tables MySQL (`stock`, `historique_vente`, `tpe_code_article`, `limites`, `factures`, `logs`) importées dans PostgreSQL |
| `Rapport vente.csv` | Prix TTC par produit (complément à l'import) |
| `factures_metro_analyse_prix (1).xlsx` | Factures Metro (référence) |

À l'import, les **stocks Metro réels** (`stock.quantite`) sont appliqués aux produits reliés par code article (~33 articles sur 181). L'historique des ventes vient de `historique_vente` (57 058 lignes).

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

## Paramètres métier

| Paramètre | Valeur | Variable d'environnement |
|-----------|--------|--------------------------|
| Horizon prévision **D** | **14 jours** | `FORECAST_HORIZON_DAYS=14` |
| Niveau de service **z** | 1,65 (95 %) | `SERVICE_LEVEL_Z=1.65` |
| Délai fournisseur **L** | 3 jours | `LEAD_TIME_DAYS=3` |
| Seuil commande | 400 EUR | `SEUIL_FOURNISSEUR=400` |
| Prix d'achat | 60 % du TTC | (import) |
| Stock initial | max(5, moy_jour × 14) | aligné sur l'horizon |

### Formules

- **Stock de sécurité** : SS = z × σ × √L
- **Quantité à commander** : Q = max(0, ⌈D + SS − S⌉)
- **Seuil fournisseur** : si montant &lt; 400 €, les quantités sont multipliées par R_min = 400 / montant

Après modification de l'horizon ou réimport des données : `POST /api/ml/run`.

## API

| Route | Description |
|-------|-------------|
| GET `/api/health` | État de l'API |
| POST `/api/import/app-db` | Réimporte `app_db.sql` + recalcul ML |
| GET `/api/config/metier` | Paramètres affichés dans l'UI |
| GET `/api/dashboard/kpi` | Indicateurs |
| GET `/api/dashboard/stocks-overview` | Stocks + prévisions |
| POST `/api/ventes` | Enregistrer une vente |
| GET `/api/ml/commande` | Commande suggérée |
| POST `/api/ml/run` | Recalculer prévisions |
