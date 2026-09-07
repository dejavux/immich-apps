#!/usr/bin/env bash
# Bootstrap Family Planner Postgres + 1Password item (A4-2)
#
# 用法：
#   bash scripts/planner/bootstrap-family-planner-db.sh
#   PLANNER_USE_CONNECT=1 bash scripts/planner/bootstrap-family-planner-db.sh --skip-db
#   bash scripts/planner/bootstrap-family-planner-db.sh --via-connect --skip-db
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
    --via-connect) PLANNER_USE_CONNECT=1; shift ;;
    -h|--help)
      echo "Usage: $0 [--skip-db] [--via-connect]"
      echo "  --via-connect  Upsert Family-Planner-DB via fuqi Connect (no op signin)"
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

if ! command -v op >/dev/null 2>&1 && [[ "${PLANNER_USE_CONNECT:-}" != "1" ]]; then
  echo "WARN — op CLI not found; use PLANNER_USE_CONNECT=1 or --via-connect" >&2
  exit 1
fi

if [[ "${PLANNER_USE_CONNECT:-}" == "1" ]]; then
  echo "==> Upserting ${OP_TITLE} via 1Password Connect (fuqi-asset-manager)"
  CONNECT_NS="${PLANNER_CONNECT_NS:-fuqi-asset-manager}"
  CONNECT_SVC="${PLANNER_CONNECT_SVC:-onepassword-connect}"
  CONNECT_PORT="${PLANNER_CONNECT_PORT:-8080}"
  TOKEN_NS="${PLANNER_CONNECT_TOKEN_NS:-immich}"
  TOKEN_SECRET="${PLANNER_CONNECT_TOKEN_SECRET:-op-connect-token}"
  TOKEN_KEY="${PLANNER_CONNECT_TOKEN_KEY:-token}"
  VAULT_ID="${PLANNER_OP_VAULT_ID:-h2sdrjfhbliqzytrhr7ezmublm}"
  LOCAL_PF_PORT="${PLANNER_CONNECT_PF_PORT:-18081}"

  ENC_PASS="$(urlencode "$PASS")"
  DATABASE_URL="postgresql://${PG_USER}:${ENC_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}?sslmode=${SSLMODE}"

  if [[ -z "${PLANNER_DATABASE_URL:-}" ]]; then
    if kubectl get secret family-planner-db -n "$NAMESPACE" >/dev/null 2>&1; then
      PLANNER_DATABASE_URL="$(kubectl get secret family-planner-db -n "$NAMESPACE" -o "jsonpath={.data.database-url}" | base64 -d)"
      echo "   using existing K8s secret family-planner-db"
    else
      PLANNER_DATABASE_URL="$DATABASE_URL"
    fi
  fi

  python3 - "$OP_TITLE" "$VAULT_ID" "$LOCAL_PF_PORT" "$CONNECT_NS" "$CONNECT_SVC" "$CONNECT_PORT" "$TOKEN_NS" "$TOKEN_SECRET" "$TOKEN_KEY" "$PLANNER_DATABASE_URL" <<'PY'
import base64, json, subprocess, sys, time, urllib.parse, urllib.request

title, vault_id, pf_port, conn_ns, conn_svc, conn_port, token_ns, token_secret, token_key, database_url = sys.argv[1:]
parsed = urllib.parse.urlparse(database_url)
user = parsed.username or "family_planner"
password = urllib.parse.unquote(parsed.password or "")
host = parsed.hostname or ""
port = str(parsed.port or 5432)
db = (parsed.path or "/family_planner").lstrip("/").split("?")[0]

token = base64.b64decode(subprocess.check_output([
    "kubectl", "get", "secret", token_secret, "-n", token_ns,
    "-o", f"jsonpath={{.data.{token_key}}}",
])).decode()

pf = subprocess.Popen([
    "kubectl", "port-forward", "-n", conn_ns, f"svc/{conn_svc}", f"{pf_port}:{conn_port}",
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(2)
base = f"http://127.0.0.1:{pf_port}"
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
try:
    req = urllib.request.Request(f"{base}/v1/vaults/{vault_id}/items", headers=headers)
    with urllib.request.urlopen(req) as resp:
        items = json.load(resp)
    existing = next((i for i in items if i.get("title") == title), None)
    body = {
        "title": title,
        "category": "DATABASE",
        "vault": {"id": vault_id},
        "fields": [
            {"label": "database-url", "value": database_url, "type": "CONCEALED"},
            {"label": "username", "value": user, "type": "STRING"},
            {"label": "password", "value": password, "type": "CONCEALED"},
            {"label": "hostname", "value": host, "type": "STRING"},
            {"label": "port", "value": port, "type": "STRING"},
            {"label": "database", "value": db, "type": "STRING"},
        ],
    }
    if existing:
        item_id = existing["id"]
        req = urllib.request.Request(
            f"{base}/v1/vaults/{vault_id}/items/{item_id}",
            data=json.dumps(body).encode(),
            headers=headers,
            method="PUT",
        )
        with urllib.request.urlopen(req) as resp:
            json.load(resp)
        print(f"OK — updated Connect item {title} ({item_id})")
    else:
        req = urllib.request.Request(
            f"{base}/v1/vaults/{vault_id}/items",
            data=json.dumps(body).encode(),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            created = json.load(resp)
        print(f"OK — created Connect item {title} ({created.get('id')})")
finally:
    pf.terminate()
    pf.wait(timeout=5)
PY

  kubectl annotate onepassworditem family-planner-db -n "$NAMESPACE" \
    operator.1password.io/reconcile="$(date +%s)" --overwrite >/dev/null || true
elif ! op whoami >/dev/null 2>&1; then
  echo "ERROR — 1Password CLI not signed in. Use: op signin" >&2
  echo "       Or: PLANNER_USE_CONNECT=1 bash $0 --skip-db" >&2
  exit 1
else
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
