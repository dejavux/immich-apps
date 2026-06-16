#!/usr/bin/env bash
# Fix Immich dates for icloud-primary batch (fix-source-dates-plan.json).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
PLAN="${PLAN:-$HOME/Library/Logs/immich-photo-sync/tier/fix-source-dates-plan.json}"
# shellcheck source=scripts/photo-sync/ensure-immich-creds.sh
source "$ROOT/scripts/photo-sync/ensure-immich-creds.sh"
load_immich_creds "$ROOT"
EXTRA=()
APPLY=()
if [[ "${1:-}" == "--dry-run" ]]; then
  EXTRA=(--dry-run)
else
  APPLY=(--apply --confirm)
fi
exec python3 "$ROOT/scripts/photo-sync/immich_fix_source_dates.py" \
  --config "$CONFIG" --plan "$PLAN" "${EXTRA[@]}" "${APPLY[@]}"
