#!/usr/bin/env bash
# Audit / fix Immich dates vs Mac Photos.app
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
EXTRA=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply|--confirm|--asset-id) EXTRA+=("$1"); [[ $# -gt 1 && "$1" == --asset-id ]] && EXTRA+=("$2") && shift; shift ;;
    --min-delta-days) EXTRA+=("$1" "$2"); shift 2 ;;
    *) EXTRA+=("$1"); shift ;;
  esac
done
# shellcheck source=scripts/photo-sync/ensure-immich-creds.sh
source "$ROOT/scripts/photo-sync/ensure-immich-creds.sh"
load_immich_creds "$ROOT"
exec python3 "$ROOT/scripts/photo-sync/immich_audit_dates.py" --config "$CONFIG" "${EXTRA[@]}"
