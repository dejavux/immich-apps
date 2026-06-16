#!/usr/bin/env bash
# Fix icloud-primary wrong import dates using local-archive SSOT (Terminal.app).
#
# Usage:
#   ./scripts/photo-sync/tier-policy-fix-source-dates.sh --dry-run
#   ./scripts/photo-sync/tier-policy-fix-source-dates.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
PLAN="${PLAN:-$HOME/Library/Logs/immich-photo-sync/tier/fix-source-dates-plan.json}"
LOG="${FIX_SOURCE_DATES_LOG:-$HOME/Library/Logs/immich-photo-sync/tier/fix-source-dates-timewarp.log}"
ICLOUD_LIB="${ICLOUD_PHOTOS_LIBRARY:-$HOME/Pictures/Photos Library.photoslibrary}"
BATCH_PREFIX="${IMPORT_BATCH_PREFIX:-2026-06-15T09:2}"

mkdir -p "$(dirname "$LOG")" "$(dirname "$PLAN")"

DRY=()
[[ "${1:-}" == "--dry-run" ]] && DRY=(--dry-run)

python3 "$ROOT/scripts/photo-sync/tier_policy_fix_source_dates.py" \
  --config "$CONFIG" \
  --import-batch-prefix "$BATCH_PREFIX" \
  "${DRY[@]}" \
  --write-plan "$PLAN"

[[ "${1:-}" == "--dry-run" ]] && exit 0

open -a Photos "$ICLOUD_LIB"
sleep 8

exec >>"$LOG" 2>&1
echo "=== fix icloud source dates $(date -u +%Y-%m-%dT%H:%M:%SZ) plan=$PLAN (photoscript) ==="

python3 "$ROOT/scripts/photo-sync/tier_policy_fix_source_dates.py" \
  --config "$CONFIG" \
  --import-batch-prefix "$BATCH_PREFIX" \
  --apply
