#!/bin/sh
#
# Migration smoke test: spin up a temp DB, apply all migrations,
# roll back to base, drop the temp DB. Catches broken Alembic
# revisions before they reach prod.
#
# Run from repo root with the docker-compose stack running:
#   ./backend/scripts/migration_smoke.sh
#
# Or against a local Postgres without docker by exporting:
#   PSQL_CMD="psql -U luz -h localhost"
#   PG_HOST=localhost
#
set -eu

DB_USER="${DB_USER:-luz}"
DB_HOST="${PG_HOST:-localhost}"
DB_NAME="luzalerts_migr_smoke_$$"

PSQL_CMD="${PSQL_CMD:-docker-compose exec -T db psql -U $DB_USER}"

cleanup() {
    echo "→ Dropping temp DB $DB_NAME"
    $PSQL_CMD -c "DROP DATABASE IF EXISTS $DB_NAME;" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "→ Creating temp DB $DB_NAME"
$PSQL_CMD -c "CREATE DATABASE $DB_NAME;"

cd "$(dirname "$0")/.."

export DATABASE_URL="postgresql+asyncpg://$DB_USER:luz@$DB_HOST:5432/$DB_NAME"

echo "→ alembic upgrade head"
alembic upgrade head

echo "→ alembic downgrade base"
alembic downgrade base

echo "✓ Migration smoke: OK"
