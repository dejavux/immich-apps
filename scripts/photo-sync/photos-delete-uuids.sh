#!/usr/bin/env bash
# Delete specific Photos UUIDs from icloud-primary (→ Recently Deleted).
#
# Usage:
#   ./scripts/photo-sync/photos-delete-uuids.sh <uuid> [more-uuids...]
#   ./scripts/photo-sync/photos-delete-uuids.sh --dry-run <uuid>
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
EXTRA=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) CONFIG="$2"; shift 2 ;;
    --dry-run) EXTRA+=(--dry-run); shift ;;
    -h|--help)
      echo "Usage: $0 [--dry-run] <photos-uuid> [more...]"
      exit 0
      ;;
    -*) echo "Unknown option: $1" >&2; exit 1 ;;
    *) break ;;
  esac
done

if [[ $# -lt 1 ]]; then
  echo "ERROR: at least one UUID required" >&2
  exit 1
fi

exec python3 "$ROOT/scripts/photo-sync/photos_gui_ops.py" \
  --config "$CONFIG" \
  delete-uuids \
  "${EXTRA[@]}" \
  "$@"
