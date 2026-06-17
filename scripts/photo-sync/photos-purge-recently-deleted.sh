#!/usr/bin/env bash
# Permanently purge Photos Recently Deleted (icloud-primary).
#
# Usage:
#   ./scripts/photo-sync/photos-purge-recently-deleted.sh --dry-run
#   ./scripts/photo-sync/photos-purge-recently-deleted.sh --confirm
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIRM=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --confirm) CONFIRM=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help)
      echo "Usage: $0 [--dry-run] | --confirm"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ "$DRY_RUN" == false ]] && [[ "$CONFIRM" == false ]]; then
  echo "ERROR: pass --confirm to purge Recently Deleted (irreversible)" >&2
  exit 1
fi

ARGS=(purge-recently-deleted)
if [[ "$DRY_RUN" == true ]]; then
  ARGS+=(--dry-run)
fi

exec python3 "$ROOT/scripts/photo-sync/photos_gui_ops.py" "${ARGS[@]}"
