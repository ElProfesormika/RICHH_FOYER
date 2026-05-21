#!/usr/bin/env bash
# Relie rapidement Postgres au service API (à lancer après railway login)
set -euo pipefail
PG_SERVICE="${PG_SERVICE:-Postgres}"
API_SERVICE="${API_SERVICE:-api}"
WEB_SERVICE="${WEB_SERVICE:-frontend}"

railway whoami >/dev/null 2>&1 || { echo "Lancez : railway login"; exit 1; }

echo "▶ Liaison DATABASE_URL → service $API_SERVICE"
railway variables --service "$API_SERVICE" \
  --set "DATABASE_URL=\${{${PG_SERVICE}.DATABASE_URL}}" \
  --set "FRONTEND_URL=\${{${WEB_SERVICE}.RAILWAY_PUBLIC_DOMAIN}}"

echo "▶ Frontend → API"
railway variables --service "$WEB_SERVICE" \
  --set "VITE_API_BASE_URL=https://\${{${API_SERVICE}.RAILWAY_PUBLIC_DOMAIN}}/api"

echo "▶ Redéploiement API…"
railway link --service "$API_SERVICE" 2>/dev/null || true
railway redeploy -s "$API_SERVICE" -y 2>/dev/null || railway up --detach -s "$API_SERVICE"

echo "✓ Terminé. Test : railway run --service $API_SERVICE curl -s http://localhost:\${PORT:-8000}/api/health/live"
