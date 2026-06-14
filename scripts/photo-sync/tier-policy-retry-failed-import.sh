#!/usr/bin/env bash
# Re-import staging batches that still have missing items in local-archive.
#
# Usage:
#   ./scripts/photo-sync/tier-policy-retry-failed-import.sh
#   IMPORT_MODE=auto ./scripts/photo-sync/tier-policy-retry-failed-import.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAGING="${TIER_STAGING_ROOT:-/tmp/immich-photo-sync/tier-staging}"
IMPORT_MODE="${IMPORT_MODE:-auto}"
LOG="${TIER_RETRY_IMPORT_LOG:-$HOME/Library/Logs/immich-photo-sync/tier/retry-import.log}"

VERIFY_JSON="$HOME/Library/Logs/immich-photo-sync/tier/tier-verify-staging.json"
if [[ ! -f "$VERIFY_JSON" ]]; then
  "$ROOT/scripts/photo-sync/tier-policy-verify-staging.sh" || true
fi

mapfile -t BATCHES < <(
python3 - <<PY
import json
from pathlib import Path
path = Path("$VERIFY_JSON")
if not path.is_file():
    raise SystemExit(0)
data = json.loads(path.read_text())
for row in data.get("missing_batches", []):
    print(row["batch"])
PY
)

if [[ ${#BATCHES[@]} -eq 0 ]]; then
  echo "No failed batches to retry."
  exit 0
fi

exec >>"$LOG" 2>&1
echo "=== retry import start $(date) mode=$IMPORT_MODE batches=${#BATCHES[@]} ==="

open -a Photos "$HOME/Pictures/LOCAL PHOTO LIBRARY.photoslibrary" || true
sleep 8

ok=0
fail=0
for batch_name in "${BATCHES[@]}"; do
  batch="$STAGING/$batch_name"
  echo "--- retry import $batch ---"
  if "$ROOT/scripts/photo-sync/tier-policy-import-staging.sh" \
    "$batch" --import-mode "$IMPORT_MODE" \
    --open-delay 25 --import-timeout 600 --verify-timeout 300 \
    --no-pause --force; then
    ok=$((ok + 1))
  else
    fail=$((fail + 1))
    echo "FAILED: $batch"
  fi
  sleep 5
done

echo "=== retry import done $(date) ok=$ok fail=$fail ==="
"$ROOT/scripts/photo-sync/tier-policy-verify-staging.sh" || true
exit $(( fail > 0 ? 1 : 0 ))
