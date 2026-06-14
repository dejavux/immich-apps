#!/usr/bin/env bash
# Audit icloud-primary videos: DB / disk / Immich overlap.
#
# Usage:
#   ./scripts/photo-sync/audit-icloud-videos.sh
#   ./scripts/photo-sync/audit-icloud-videos.sh --list-ismissing 20
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
export PATH="${HOME}/.local/bin:${PATH}"

# shellcheck disable=SC1091
source "$ROOT/scripts/photo-sync/ensure-immich-creds.sh"
load_immich_creds "$ROOT"

exec python3 "$ROOT/scripts/photo-sync/audit_icloud_videos.py" \
  --config "$CONFIG" \
  "$@"
