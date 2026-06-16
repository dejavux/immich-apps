#!/usr/bin/env bash
# Phase C: move visible icloud-primary items older than 1 year → local-archive.
# PAUSED until ghost rows (ZVISIBILITYSTATE=2) are purged from Photos.sqlite.
#
# Usage (Terminal.app):
#   ./scripts/photo-sync/tier-policy-bulk-export-phasec.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"

exec "$ROOT/scripts/photo-sync/tier-policy-bulk-export.sh" \
  --cutoff-one-year \
  --ignore-processed-state \
  "$@"
