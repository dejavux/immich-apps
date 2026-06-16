#!/usr/bin/env bash
# Fix capture dates on local-archive after tier bulk import.
#
# Usage:
#   ./scripts/photo-sync/tier-policy-fix-import-dates.sh              # wrong-date window
#   ./scripts/photo-sync/tier-policy-fix-import-dates.sh --all-tier   # all tier matches
#   ./scripts/photo-sync/tier-policy-fix-import-dates.sh --dry-run
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
LOG="${TIER_FIX_DATES_LOG:-$HOME/Library/Logs/immich-photo-sync/tier/fix-import-dates.log}"

mkdir -p "$(dirname "$LOG")"
LOCAL_LIB="${LOCAL_PHOTOS_LIBRARY:-$HOME/Pictures/LOCAL PHOTO LIBRARY.photoslibrary}"
open -a Photos "$LOCAL_LIB" || true
sleep 5

{
  echo "=== fix-import-dates $(date) ==="
  python3 "$ROOT/scripts/photo-sync/tier_policy_fix_import_dates.py" --config "$CONFIG" "$@"
  echo "=== done $(date) ==="
} 2>&1 | tee -a "$LOG"
