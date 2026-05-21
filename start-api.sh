#!/usr/bin/env bash
set -e
ROOT="$(dirname "$0")"
cd "$ROOT/backend"
source .venv/bin/activate
export DATABASE_URL="${DATABASE_URL:-postgresql://foyer:foyer_secret@localhost:5432/foyer_stock}"
export CSV_PATH="${CSV_PATH:-$ROOT/Rapport vente.csv}"

if fuser 8000/tcp >/dev/null 2>&1; then
  echo "Arret de l'ancienne API sur le port 8000..."
  fuser -k 8000/tcp >/dev/null 2>&1 || true
  sleep 2
fi

echo "Demarrage API : http://127.0.0.1:8000"
echo "Documentation : http://127.0.0.1:8000/docs"
echo "Appuyez sur Ctrl+C pour arreter."
exec uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
