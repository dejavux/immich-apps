#!/usr/bin/env bash
# Bootstrap Family Planner Postgres + 1Password item (A4-2)
#
# 用法：
#   bash scripts/planner/bootstrap-family-planner-db.sh
#   PLANNER_PG_PASSWORD='...' bash scripts/planner/bootstrap-family-planner-db.sh --skip-db
#
set -euo pipefail

NAMESPACE="${PLANNER_PG_NAMESPACE:-immich}"
PG_DEPLOY="${PLANNER_PG_DEPLOY:-immich-postgres}"
PG_USER="${PLANNER_PG_USER:-family_planner}"
PG_DB="${PLANNER_PG_DATABASE:-family_planner}"
PG_HOST="${PLANNER_PG_HOST:-immich-postgres.${NAMESPACE}.svc.cluster.local}"
PG_PORT="${PLANNER_PG_PORT:-5432}"
SSLMODE="${PLANNER_PG_SSLMODE:-disable}"
VAULT="${PLANNER_OP_VAULT:-Infra-Platform}"
OP_TITLE="${PLANNER_OP_TITLE:-Family-Planner-DB}"
SKIP_DB=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-db) SKIP_DB=true; shift ;;
    -h|--help)
      echo "Usage: $0 [--skip-db]"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

urlencode() {
  python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
}

PASS="${PLANNER_PG_PASSWORD:-}"
if [[ -z "$PASS" ]]; then
  PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
fi

if [[ "$SKIP_DB" != true ]]; then
  echo "==> Creating Postgres role/database on ${PG_DEPLOY} (ns=${NAMESPACE})"
  ESC_PASS="$(printf '%s' "$PASS" | sed "s/'/''/g")"
  kubectl exec -n "$NAMESPACE" "deploy/${PG_DEPLOY}" -- psql -U immich -d postgres -v ON_ERROR_STOP=1 <<-EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${PG_USER}') THEN
    CREATE ROLE ${PG_USER} WITH LOGIN PASSWORD '${ESC_PASS}';
  ELSE
    ALTER ROLE ${PG_USER} WITH PASSWORD '${ESC_PASS}';
  END IF;
END
\$\$;
EOSQL
  if ! kubectl exec -n "$NAMESPACE" "deploy/${PG_DEPLOY}" -- \
      psql -U immich -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" | grep -q 1; then
    kubectl exec -n "$NAMESPACE" "deploy/${PG_DEPLOY}" -- \
      psql -U immich -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};"
  fi
  kubectl exec -n "$NAMESPACE" "deploy/${PG_DEPLOY}" -- \
    psql -U immich -d "$PG_DB" -v ON_ERROR_STOP=1 -c "GRANT ALL ON SCHEMA public TO ${PG_USER};"
  kubectl exec -n "$NAMESPACE" "deploy/${PG_DEPLOY}" -- \
    psql -U immich -d "$PG_DB" -v ON_ERROR_STOP=1 -c \
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${PG_USER};"
  echo "OK — Postgres ${PG_DB} @ ${PG_HOST}"
fi

if ! command -v op >/dev/null 2>&1; then
  echo "WARN — op CLI not found; create 1Password item manually (field database-url)" >&2
  exit 1
fi

if ! op whoami >/dev/null 2>&1; then
  echo "ERROR — 1Password CLI not signed in. Run: op signin" >&2
  echo "       Then re-run: bash scripts/planner/bootstrap-family-planner-db.sh --skip-db" >&2
  exit 1
fi

ENC_PASS="$(urlencode "$PASS")"
DATABASE_URL="postgresql://${PG_USER}:${ENC_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}?sslmode=${SSLMODE}"

EXISTING_ID="$(op item list --vault "$VAULT" --format json 2>/dev/null | python3 -c "
import json,sys
title=sys.argv[1]
for i in json.load(sys.stdin):
    if i.get('title')==title:
        print(i['id']); break
" "$OP_TITLE" 2>/dev/null || true)"

if [[ -n "${EXISTING_ID:-}" ]]; then
  echo "==> Updating ${OP_TITLE} (${EXISTING_ID})"
  op item edit "$EXISTING_ID" --vault "$VAULT" \
    "database-url=${DATABASE_URL}" \
    "username=${PG_USER}" \
    "password=${PASS}" \
    "hostname=${PG_HOST}" \
    "port=${PG_PORT}" \
    "database=${PG_DB}" \
    >/dev/null
else
  echo "==> Creating ${OP_TITLE} @ ${VAULT}"
  op item create --category database --title "$OP_TITLE" --vault "$VAULT" \
    "database-url=${DATABASE_URL}" \
    "username=${PG_USER}" \
    "password=${PASS}" \
    "hostname=${PG_HOST}" \
    "port=${PG_PORT}" \
    "database=${PG_DB}" \
    >/dev/null
fi

echo "OK — 1Password ${OP_TITLE} ready"
echo "==> Waiting for operator sync..."
for _ in $(seq 1 30); do
  if kubectl get onepassworditem family-planner-db -n "$NAMESPACE" -o jsonpath='{.status.conditions[0].status}' 2>/dev/null | grep -q True; then
    echo "OK — OnePasswordItem/family-planner-db Ready=True"
    kubectl rollout restart "deploy/family-planner" -n "$NAMESPACE"
    kubectl rollout status "deploy/family-planner" -n "$NAMESPACE" --timeout=120s
    exit 0
  fi
  sleep 2
done
echo "WARN — Operator not Ready yet; check: kubectl get onepassworditem family-planner-db -n ${NAMESPACE}" >&2
exit 1
