# --- Build interface React (même URL que l'API en production) ---
FROM node:20-alpine AS frontend-build
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ .
# API relative : même domaine Railway (foyer-utt-production.up.railway.app/api)
ENV VITE_API_BASE_URL=/api
RUN npm run build
RUN printf '%s\n' 'window.__FOYER_API_BASE__="/api";' > dist/config.js

# --- API Python + fichiers statiques ---
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-build /fe/dist /app/static

COPY app_db.sql /tmp/app_db.sql
COPY Rapport* /tmp/
RUN mkdir -p /data \
    && mv /tmp/app_db.sql /data/app_db.sql \
    && mv /tmp/Rapport* /data/rapport_vente.csv

ENV APP_DB_SQL_PATH=/data/app_db.sql
ENV CSV_PATH=/data/rapport_vente.csv
ENV IMPORT_SOURCE=app_db
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
