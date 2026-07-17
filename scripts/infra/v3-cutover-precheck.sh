#!/usr/bin/env bash
# Pre-maintenance checks for Immich v3.0.0 cutover (Track C).
# Safe to run against production v2.7.5 — does NOT upgrade server.
#
# Usage:
#   eval "$(./scripts/dev/load-env-from-op.sh)"
#   bash scripts/infra/v3-cutover-precheck.sh
#   bash scripts/infra/v3-cutover-precheck.sh --skip-smoke
#   bash scripts/infra/v3-cutover-precheck.sh --skip-pg-dump
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${NAMESPACE:-immich}"
IMMICH_BASE="${IMMICH_BASE:-https://immich.3q.fi}"
SKIP_SMOKE=0
SKIP_PG_DUMP=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-smoke) SKIP_SMOKE=1; shift ;;
    --skip-pg-dump) SKIP_PG_DUMP=1; shift ;;
    -h|--help)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

fail=0
pass() { echo "  ✅ $1"; }
warn() { echo "  ⚠️  $1"; }
err() { echo "  ❌ $1"; fail=1; }

echo "== Immich v3 cutover pre-check =="
echo "  immich=${IMMICH_BASE} namespace=${NAMESPACE}"
echo ""

echo "== 1) Production pin (expect v2.7.5 until window) =="
VER_JSON="$(curl -fsS "${IMMICH_BASE}/api/server/version" 2>/dev/null || true)"
if [[ -z "$VER_JSON" ]]; then
  err "GET /api/server/version failed"
else
  MAJOR="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('major','?'))" "$VER_JSON")"
  MINOR="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('minor','?'))" "$VER_JSON")"
  PATCH="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('patch','?'))" "$VER_JSON")"
  echo "  version=${MAJOR}.${MINOR}.${PATCH}"
  if [[ "$MAJOR" == "2" && "$MINOR" == "7" && "$PATCH" == "5" ]]; then
    pass "production still pinned v2.7.5 (anti-drift OK)"
  elif [[ "$MAJOR" == "3" ]]; then
    warn "production already on v3 — pre-window pin check N/A"
  else
    err "unexpected version ${MAJOR}.${MINOR}.${PATCH} (expected 2.7.5 pre-window)"
  fi
fi

if kubectl get deploy immich-server -n "$NAMESPACE" &>/dev/null; then
  SERVER_IMG="$(kubectl get deploy immich-server -n "$NAMESPACE" \
    -o jsonpath='{.spec.template.spec.containers[0].image}')"
  ML_IMG="$(kubectl get deploy immich-machine-learning -n "$NAMESPACE" \
    -o jsonpath='{.spec.template.spec.containers[0].image}')"
  echo "  server=${SERVER_IMG}"
  echo "  ml=${ML_IMG}"
  if [[ "$SERVER_IMG" == *":v2.7.5" && "$ML_IMG" == *":v2.7.5" ]]; then
    pass "deploy images pinned v2.7.5"
  else
    err "server/ML images not v2.7.5"
  fi
else
  warn "kubectl deploy immich-server unavailable — skip image pin check"
fi

echo ""
echo "== 2) immich-apps repo (v3 OpenAPI alignment) =="
SPEC="$ROOT/open-api/immich-openapi-specs.json"
if [[ -f "$SPEC" ]]; then
  SPEC_BYTES="$(wc -c <"$SPEC" | tr -d ' ')"
  SPEC_VER="$(python3 -c "import json; d=json.load(open('$SPEC')); print(d.get('info',{}).get('version','?'))")"
  echo "  openapi_spec=${SPEC_VER} (${SPEC_BYTES} bytes)"
  if [[ "$SPEC_VER" == "3.0.0" && "$SPEC_BYTES" -gt 700000 ]]; then
    pass "OpenAPI spec v3.0.0 committed"
  else
    err "OpenAPI spec not v3.0.0 (run IMMICH_OPENAPI_VERSION=3.0.0 npm run openapi:sync)"
  fi
else
  err "missing open-api/immich-openapi-specs.json"
fi

if grep -rq 'deviceId\|deviceAssetId' "$ROOT/src/shared/immich-client.ts" \
  "$ROOT/src/line-bot/handlers/line-webhook.ts" 2>/dev/null; then
  pass "device upload fields present (required on Immich v2.7.5)"
else
  err "deviceId/deviceAssetId missing — LINE upload 400 on v2.7.5 until v3 cutover"
fi

echo ""
echo "== 3) Local tests =="
if (cd "$ROOT" && npm test >/dev/null 2>&1); then
  pass "npm test"
else
  err "npm test failed"
fi
if (cd "$ROOT" && npm run type-check >/dev/null 2>&1); then
  pass "type-check"
else
  err "type-check failed"
fi

echo ""
echo "== 4) VectorChord =="
if kubectl get deploy immich-postgres -n "$NAMESPACE" &>/dev/null; then
  PG_USER="$(kubectl get secret immich-postgresql-credentials -n "$NAMESPACE" \
    -o jsonpath='{.data.username}' | base64 -d)"
  VCHORD="$(kubectl exec -n "$NAMESPACE" deploy/immich-postgres -- \
    psql -U "$PG_USER" -d immich -tAc "SHOW shared_preload_libraries;" 2>/dev/null | tr -d ' ' || true)"
  echo "  shared_preload_libraries=${VCHORD:-<unknown>}"
  if [[ "$VCHORD" == *"vchord.so"* ]]; then
    pass "VectorChord preload OK"
  else
    err "expected vchord.so in shared_preload_libraries"
  fi
else
  warn "postgres deploy unavailable — skip VectorChord check"
fi

echo ""
echo "== 5) pg_dump pre-check =="
if [[ "$SKIP_PG_DUMP" == "1" ]]; then
  warn "skipped (--skip-pg-dump)"
elif bash "$ROOT/scripts/infra/pg-dump-precheck.sh"; then
  pass "pg_dump pre-check"
else
  err "pg_dump pre-check failed"
fi

echo ""
echo "== 6) LINE smoke (v2.7.5 baseline pre-window) =="
if [[ "$SKIP_SMOKE" == "1" ]]; then
  warn "skipped (--skip-smoke)"
elif [[ -z "${IMMICH_API_KEY:-}" ]]; then
  warn "IMMICH_API_KEY unset — run: eval \"\$(./scripts/dev/load-env-from-op.sh)\""
elif bash "$ROOT/scripts/line-bot/smoke-photo-search-e2e.sh" --person 小蕊; then
  pass "smoke-photo-search-e2e.sh (v2.7.5 baseline)"
else
  err "smoke-photo-search-e2e.sh failed"
fi

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "✅ v3 cutover pre-check passed"
  echo ""
  echo "Remaining before window (see IMMICH_v3_CUTOVER_RUNBOOK.md):"
  echo "  - Staging or window-first v3 server validation"
  echo "  - smoke-photo-search-e2e.sh against v3.0.0 server"
  echo "  - LINE manual upload/search/carousel on v3"
  echo "  - photo-sync --dry-run on v3"
  exit 0
fi

echo "❌ v3 cutover pre-check failed — fix items above before scheduling window"
exit 1
