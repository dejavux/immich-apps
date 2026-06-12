#!/usr/bin/env bash
# Phase 3.5 M2: count-only cross-library move feasibility (no file moves).
#
# Usage:
#   ./scripts/photo-sync/tier-policy-cross-library-poc.sh
#   ./scripts/photo-sync/tier-policy-cross-library-poc.sh --cutoff-date 2023-01-01
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"

if ! command -v osxphotos >/dev/null 2>&1; then
  echo "ERROR: osxphotos not found." >&2
  echo "  pip3 install --user osxphotos" >&2
  echo "  export PATH=\"\$HOME/.local/bin:\$PATH\"" >&2
  exit 1
fi

exec python3 "$ROOT/scripts/photo-sync/tier_policy_cross_library_poc.py" \
  --config "$CONFIG" \
  "$@"
