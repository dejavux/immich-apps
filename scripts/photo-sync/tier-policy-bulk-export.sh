#!/usr/bin/env bash
# Export all tier-policy candidates to staging (no Photos import).
#
# Usage:
#   ./scripts/photo-sync/tier-policy-bulk-export.sh --cutoff-one-year
#   ./scripts/photo-sync/tier-policy-bulk-export.sh --cutoff-date 2023-01-01 --batch-size 50
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"

BATCH_SIZE=50
EXTRA=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --batch-size) BATCH_SIZE="$2"; shift 2 ;;
    *) EXTRA+=("$1"); shift ;;
  esac
done

round=0
while true; do
  round=$((round + 1))
  echo "=== bulk export round $round (batch_size=$BATCH_SIZE) ==="
  out=$(mktemp)
  if ! "$ROOT/scripts/photo-sync/tier-policy.sh" \
    --execute --export-only --force \
    --batch-size "$BATCH_SIZE" \
    "${EXTRA[@]}" >"$out" 2>&1; then
    cat "$out"
    rm -f "$out"
    exit 1
  fi
  cat "$out"
  planned=$(python3 -c "import json,sys; d=json.load(open('$out'.replace(\"'\",''))) if False else None" 2>/dev/null || true)
  planned=$(grep -o '"planned": [0-9]*' "$out" | head -1 | awk '{print $2}')
  rm -f "$out"
  if [[ -z "$planned" || "$planned" -eq 0 ]]; then
    echo "bulk export complete after $((round - 1)) batch(es)"
    break
  fi
  sleep 1
done

echo "Staging: /tmp/immich-photo-sync/tier-staging/"
echo "Import:  ./scripts/photo-sync/tier-policy-import-staging.sh <batch-dir> --import-mode manual --force"
