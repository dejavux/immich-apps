#!/usr/bin/env bash
# Import all tier-policy staging batches into local-archive.
#
# Usage:
#   ./scripts/photo-sync/tier-policy-bulk-import-staging.sh
#   IMPORT_MODE=manual ./scripts/photo-sync/tier-policy-bulk-import-staging.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAGING="${TIER_STAGING_ROOT:-/tmp/immich-photo-sync/tier-staging}"
IMPORT_MODE="${IMPORT_MODE:-auto}"
LOG="${TIER_BULK_IMPORT_LOG:-$HOME/Library/Logs/immich-photo-sync/tier/bulk-import.log}"

mapfile -t BATCHES < <(find "$STAGING" -maxdepth 1 -type d -name 'batch-*' | sort)

exec >>"$LOG" 2>&1
echo "=== bulk import start $(date) mode=$IMPORT_MODE batches=${#BATCHES[@]} ==="

open -a Photos "$HOME/Pictures/LOCAL PHOTO LIBRARY.photoslibrary" || true
sleep 5

ok=0
fail=0
skip=0
for batch in "${BATCHES[@]}"; do
  if [[ ! -f "$batch/batch-manifest.json" ]]; then
    skip=$((skip + 1))
    continue
  fi
  echo "--- import $batch ---"
  if "$ROOT/scripts/photo-sync/tier-policy-import-staging.sh" \
    "$batch" --import-mode "$IMPORT_MODE" \
    --open-delay 20 --import-timeout 300 --verify-timeout 180 \
    --no-pause --force; then
    ok=$((ok + 1))
  else
    fail=$((fail + 1))
    echo "FAILED: $batch"
  fi
  sleep 3
done

echo "=== bulk import done $(date) ok=$ok fail=$fail skip=$skip ==="
exit $(( fail > 0 ? 1 : 0 ))
