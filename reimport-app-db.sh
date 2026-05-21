#!/usr/bin/env bash
set -e
echo "Réimport app_db.sql + ML…"
curl -s -X POST http://127.0.0.1:8000/api/import/app-db | python3 -m json.tool
