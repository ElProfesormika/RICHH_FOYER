FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Contexte de build = racine du dépôt (voir railway.toml)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

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

# Railway injecte PORT
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
