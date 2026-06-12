#!/usr/bin/env bash
# Phase 3.5 M2: spot-check eligible tier photos vs Immich hash overlap.
#
# Usage:
#   ./scripts/photo-sync/tier-policy-spotcheck.sh
#   ./scripts/photo-sync/tier-policy-spotcheck.sh --sample 50
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

# shellcheck disable=SC1091
source "$ROOT/scripts/photo-sync/ensure-immich-creds.sh"
load_immich_creds "$ROOT"

exec python3 "$ROOT/scripts/photo-sync/tier_policy_spotcheck.py" \
  --config "$CONFIG" \
  "$@"
