#!/usr/bin/env bash
# Demarre l'API en arriere-plan puis le frontend
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q .; then
  if ! ss -tln 2>/dev/null | grep -q ':5432'; then
    echo "PostgreSQL non detecte. Demarrage du conteneur..."
    docker run -d --name foyer-db -p 5432:5432 \
      -e POSTGRES_USER=foyer \
      -e POSTGRES_PASSWORD=foyer_secret \
      -e POSTGRES_DB=foyer_stock \
      postgres:16-alpine 2>/dev/null || docker start foyer-db 2>/dev/null || true
    sleep 3
  fi
fi

fuser -k 8000/tcp >/dev/null 2>&1 || true
sleep 1

cd "$ROOT/backend"
source .venv/bin/activate
export DATABASE_URL="${DATABASE_URL:-postgresql://foyer:foyer_secret@localhost:5432/foyer_stock}"
export CSV_PATH="${CSV_PATH:-$ROOT/Rapport vente.csv}"

nohup uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 > "$ROOT/api.log" 2>&1 &
echo $! > "$ROOT/.api.pid"

for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    echo "API OK : http://127.0.0.1:8000"
    break
  fi
  sleep 1
  if [ "$i" -eq 10 ]; then
    echo "Echec demarrage API. Voir $ROOT/api.log"
    tail -20 "$ROOT/api.log"
    exit 1
  fi
done

cd "$ROOT/frontend"
echo "Frontend : http://localhost:5173 (ou port suivant si occupe)"
exec npm run dev
