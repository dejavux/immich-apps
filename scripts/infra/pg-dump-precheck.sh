#!/usr/bin/env bash
# Postgres dump pre-check for Immich maintenance windows (v2.7.5 → v3.0.0).
# Runs pg_dump to a temp file, validates header/size, then removes it unless OUT is set.
#
# Usage:
#   bash scripts/infra/pg-dump-precheck.sh
#   OUT=immich-pg-backup-$(date +%Y%m%d).sql bash scripts/infra/pg-dump-precheck.sh
#
set -euo pipefail

NAMESPACE="${NAMESPACE:-immich}"
OUT="${OUT:-}"
TMP="$(mktemp /tmp/immich-pg-precheck.XXXXXX.sql)"

cleanup() {
  if [[ -z "$OUT" && -f "$TMP" ]]; then
    rm -f "$TMP"
  fi
}
trap cleanup EXIT

echo "== Immich pg_dump pre-check (namespace=${NAMESPACE}) =="

if ! kubectl get deploy immich-postgres -n "$NAMESPACE" &>/dev/null; then
  echo "❌ deploy/immich-postgres not found in namespace ${NAMESPACE}" >&2
  exit 1
fi

PG_USER="$(kubectl get secret immich-postgresql-credentials -n "$NAMESPACE" \
  -o jsonpath='{.data.username}' | base64 -d)"
PG_DB="$(kubectl get secret immich-postgresql-credentials -n "$NAMESPACE" \
  -o jsonpath='{.data.database}' | base64 -d)"

echo "  user=${PG_USER} db=${PG_DB}"
echo "  dumping to ${OUT:-$TMP} ..."

if [[ -n "$OUT" ]]; then
  kubectl exec -n "$NAMESPACE" deploy/immich-postgres -- \
    pg_dump -U "$PG_USER" "$PG_DB" >"$OUT"
  TARGET="$OUT"
else
  kubectl exec -n "$NAMESPACE" deploy/immich-postgres -- \
    pg_dump -U "$PG_USER" "$PG_DB" >"$TMP"
  TARGET="$TMP"
fi

SIZE="$(wc -c <"$TARGET" | tr -d ' ')"
echo "  size_bytes=${SIZE}"

if [[ "$SIZE" -lt 1000000 ]]; then
  echo "❌ dump too small (< 1 MB) — likely failed" >&2
  exit 1
fi

if ! head -20 "$TARGET" | grep -q 'PostgreSQL database dump'; then
  echo "❌ missing PostgreSQL dump header" >&2
  exit 1
fi

if ! grep -q 'CREATE TABLE' "$TARGET"; then
  echo "❌ no CREATE TABLE found in dump" >&2
  exit 1
fi

echo "  header: $(head -1 "$TARGET")"
echo "  tables: $(grep -c 'CREATE TABLE' "$TARGET" || true)"
echo "✅ pg_dump pre-check passed"
if [[ -n "$OUT" ]]; then
  echo "  saved: $OUT"
fi
