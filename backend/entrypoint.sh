#!/bin/sh
set -e

alembic upgrade head
# Detrás de Caddy: la IP real del cliente viene en X-Forwarded-For. Sin
# confiar en ese encabezado, slowapi ve la IP de Caddy para todos y los
# límites por IP se vuelven uno solo para toda la app. Caddy reemplaza el
# X-Forwarded-For que manda el cliente, y el puerto 8000 está publicado
# solo en 127.0.0.1 (docker-compose.yml), así que no se puede falsificar.
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 \
    --proxy-headers --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-*}"
