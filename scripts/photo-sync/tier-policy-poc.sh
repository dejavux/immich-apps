#!/usr/bin/env bash
# Phase 3.5 PoC: estimate tier_policy eligible assets (dry-run only).
#
# Usage:
#   ./scripts/photo-sync/tier-policy-poc.sh
#   ./scripts/photo-sync/tier-policy-poc.sh --cutoff-date 2023-01-01
#   PHOTO_SYNC_CONFIG=~/.config/immich-apps/photo-sync.config.yaml \
#     ./scripts/photo-sync/tier-policy-poc.sh
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

exec python3 "$ROOT/scripts/photo-sync/tier_policy_poc.py" \
  --config "$CONFIG" \
  "$@"
