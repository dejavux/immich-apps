#!/usr/bin/env bash
# Trash only explicitly allowlisted Immich assets (dry-run default).
#
# Usage:
#   eval "$(./scripts/dev/load-env-from-op.sh)"
#   ./scripts/photo-sync/immich-trash-allowlisted-assets.sh \
#     --preset today-png-orphans-20260630
#   ./scripts/photo-sync/immich-trash-allowlisted-assets.sh <asset-id> [more-ids...]
#   ./scripts/photo-sync/immich-trash-allowlisted-assets.sh \
#     --preset today-png-orphans-20260630 --apply --confirm
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
EXTRA_ARGS=()
ASSET_IDS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) CONFIG="$2"; shift 2 ;;
    --preset) EXTRA_ARGS+=(--preset "$2"); shift 2 ;;
    --output) EXTRA_ARGS+=(--output "$2"); shift 2 ;;
    --require-png|--no-require-png|--apply|--confirm|--json) EXTRA_ARGS+=("$1"); shift ;;
    -h|--help)
      echo "Usage: $0 [--config PATH] [--preset NAME] [--require-png|--no-require-png]"
      echo "       $0 [--preset today-png-orphans-20260630] [asset-id ...]"
      echo "       $0 --preset today-png-orphans-20260630 --apply --confirm"
      exit 0
      ;;
    --*) echo "Unknown option: $1" >&2; exit 1 ;;
    *) ASSET_IDS+=("$1"); shift ;;
  esac
done

if [[ ! -f "$CONFIG" ]]; then
  echo "ERROR: config not found: $CONFIG" >&2
  exit 1
fi

if [[ -z "${IMMICH_API_KEY:-}" ]] || [[ "${IMMICH_API_KEY}" == your-* ]]; then
  unset IMMICH_API_KEY
fi

# shellcheck source=scripts/photo-sync/ensure-immich-creds.sh
source "$ROOT/scripts/photo-sync/ensure-immich-creds.sh"
load_immich_creds "$ROOT"

exec python3 "$ROOT/scripts/photo-sync/immich_trash_allowlisted_assets.py" \
  --config "$CONFIG" \
  "${EXTRA_ARGS[@]}" \
  "${ASSET_IDS[@]}"
