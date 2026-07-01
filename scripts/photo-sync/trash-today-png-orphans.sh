#!/usr/bin/env bash
# Convenience wrapper: dry-run trash for today-png-orphans-20260630 preset.
#
# Usage:
#   ./scripts/photo-sync/trash-today-png-orphans.sh
#   ./scripts/photo-sync/trash-today-png-orphans.sh --apply --confirm
#
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec "$ROOT/scripts/photo-sync/immich-trash-allowlisted-assets.sh" \
  --preset today-png-orphans-20260630 \
  "$@"
