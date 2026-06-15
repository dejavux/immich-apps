#!/usr/bin/env bash
# Phase 3.6: conservative Immich orphan reconcile
#
# 用法:
#   eval "$(./scripts/dev/load-env-from-op.sh)"
#   ./scripts/photo-sync/immich-reconcile.sh                    # dry-run
#   ./scripts/photo-sync/immich-reconcile.sh --apply --confirm  # 需 delete_policy=conservative
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) CONFIG="$2"; shift 2 ;;
    --library) EXTRA_ARGS+=(--library "$2"); shift 2 ;;
    --output) EXTRA_ARGS+=(--output "$2"); shift 2 ;;
    --apply|--confirm) EXTRA_ARGS+=("$1"); shift ;;
    -h|--help)
      echo "Usage: $0 [--config PATH] [--library ID] [--output PATH]"
      echo "       $0 --apply --confirm   # trash orphans (sync.delete_policy=conservative)"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
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

exec python3 "$ROOT/scripts/photo-sync/immich_reconcile.py" \
  --config "$CONFIG" \
  "${EXTRA_ARGS[@]}"
