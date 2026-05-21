#!/usr/bin/env bash
# Configuration complète Foyer_UTT sur Railway (Postgres + API + Frontend)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}▶${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*" >&2; }

# --- Noms des services (adapter si différents dans votre projet Railway) ---
PG_SERVICE="${PG_SERVICE:-Postgres}"
API_SERVICE="${API_SERVICE:-api}"
WEB_SERVICE="${WEB_SERVICE:-frontend}"

require_cli() {
  command -v railway >/dev/null 2>&1 || {
    error "Railway CLI absent. Installez : npm i -g @railway/cli"
    exit 1
  }
}

require_auth() {
  if ! railway whoami >/dev/null 2>&1; then
    error "Non connecté à Railway."
    echo ""
    echo "  Exécutez dans CE terminal :"
    echo "    railway login"
    echo ""
    echo "  Ou avec un token :"
    echo "    export RAILWAY_TOKEN=votre_token"
    echo "    railway whoami"
    echo ""
    exit 1
  fi
  info "Connecté : $(railway whoami 2>/dev/null || true)"
}

ensure_linked_project() {
  if railway status >/dev/null 2>&1; then
    info "Projet déjà lié :"
    railway status
    return
  fi
  warn "Aucun projet lié dans ce dossier."
  echo ""
  echo "  Projets disponibles :"
  railway list || true
  echo ""
  read -rp "ID du projet Railway existant (ou Entrée pour créer) : " PROJECT_ID
  if [[ -z "${PROJECT_ID:-}" ]]; then
    read -rp "Nom du nouveau projet [foyer-utt] : " PROJECT_NAME
    PROJECT_NAME="${PROJECT_NAME:-foyer-utt}"
    railway init --name "$PROJECT_NAME"
  else
    railway link --project "$PROJECT_ID"
  fi
}

add_postgres_if_needed() {
  info "Vérification PostgreSQL…"
  if railway variables --service "$PG_SERVICE" --json 2>/dev/null | grep -q DATABASE_URL; then
    info "Service $PG_SERVICE déjà présent."
    return
  fi
  warn "Ajout PostgreSQL (service: $PG_SERVICE)…"
  railway add --database postgres --service "$PG_SERVICE" || railway add --database postgres
}

add_services_if_needed() {
  REPO_URL="${REPO_URL:-ElProfesormika/RICHH_FOYER}"
  if ! railway service status 2>/dev/null | grep -qi "$API_SERVICE"; then
    info "Création service API…"
    railway add --service "$API_SERVICE" --repo "$REPO_URL" 2>/dev/null || \
      railway add --service "$API_SERVICE" 2>/dev/null || true
  fi
  if ! railway service status 2>/dev/null | grep -qi "$WEB_SERVICE"; then
    info "Création service Frontend…"
    railway add --service "$WEB_SERVICE" --repo "$REPO_URL" 2>/dev/null || \
      railway add --service "$WEB_SERVICE" 2>/dev/null || true
  fi
}

configure_api() {
  info "Variables service $API_SERVICE…"
  railway variables --service "$API_SERVICE" \
    --set "DATABASE_URL=\${{${PG_SERVICE}.DATABASE_URL}}" \
    --set "APP_DB_SQL_PATH=/data/app_db.sql" \
    --set "CSV_PATH=/data/rapport_vente.csv" \
    --set "IMPORT_SOURCE=app_db" \
    --set "FORCE_REIMPORT=false" \
    --set "SEUIL_FOURNISSEUR=400" \
    --set "LEAD_TIME_DAYS=3" \
    --set "SERVICE_LEVEL_Z=1.65" \
    --set "FORECAST_HORIZON_DAYS=14" \
    --set "FRONTEND_URL=\${{${WEB_SERVICE}.RAILWAY_PUBLIC_DOMAIN}}" \
    --skip-deploys

  info "Domaine public API (si absent)…"
  railway domain --service "$API_SERVICE" 2>/dev/null || true
}

configure_frontend() {
  info "Variables build service $WEB_SERVICE…"
  railway variables --service "$WEB_SERVICE" \
    --set "VITE_API_BASE_URL=https://\${{${API_SERVICE}.RAILWAY_PUBLIC_DOMAIN}}/api" \
    --skip-deploys

  info "Domaine public Frontend (si absent)…"
  railway domain --service "$WEB_SERVICE" 2>/dev/null || true
}

deploy_api() {
  info "Déploiement API depuis la racine du repo…"
  railway up --detach -s "$API_SERVICE" "$ROOT"
}

deploy_frontend() {
  info "Déploiement Frontend (dossier frontend/)…"
  railway up --detach -s "$WEB_SERVICE" --path-as-root "$ROOT/frontend"
}

print_summary() {
  echo ""
  echo "=============================================="
  info "Configuration terminée"
  echo "=============================================="
  railway service status 2>/dev/null || true
  echo ""
  info "URLs (après build) :"
  railway domain --service "$API_SERVICE" --json 2>/dev/null || \
    echo "  API : voir Railway → $API_SERVICE → Networking"
  railway domain --service "$WEB_SERVICE" --json 2>/dev/null || \
    echo "  Web : voir Railway → $WEB_SERVICE → Networking"
  echo ""
  info "Tests :"
  echo "  curl https://VOTRE-API.up.railway.app/api/health/live"
  echo "  curl https://VOTRE-API.up.railway.app/api/health"
  echo ""
  warn "Dashboard Railway — vérifiez manuellement :"
  echo "  • Service $API_SERVICE : Root Directory = (vide / racine)"
  echo "  • Service $WEB_SERVICE : Root Directory = frontend"
  echo "  • $PG_SERVICE lié à $API_SERVICE (variable DATABASE_URL)"
}

main() {
  echo ""
  echo "  Foyer_UTT — Setup Railway CLI"
  echo ""
  require_cli
  require_auth
  ensure_linked_project
  add_postgres_if_needed
  add_services_if_needed
  configure_api
  configure_frontend

  read -rp "Lancer les déploiements maintenant ? [o/N] " DEPLOY
  if [[ "${DEPLOY,,}" == "o" || "${DEPLOY,,}" == "oui" || "${DEPLOY,,}" == "y" ]]; then
    deploy_api
    deploy_frontend
  else
    warn "Déployez plus tard : ./setup-railway.sh (et répondez o) ou railway up par service"
  fi
  print_summary
}

main "$@"
