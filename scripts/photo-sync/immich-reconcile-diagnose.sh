#!/usr/bin/env bash
# Diagnose Immich asset mac_ref / Photos state (reconcile debugging).
#
# Usage:
#   eval "$(./scripts/dev/load-env-from-op.sh)"
#   ./scripts/photo-sync/immich-reconcile-diagnose.sh <immich-asset-id> [more-ids...]
#   ./scripts/photo-sync/immich-reconcile-diagnose.sh --json <asset-id>
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"

if [[ $# -lt 1 ]] || [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
  echo "Usage: $0 [--json] <immich-asset-id> [more-ids...]"
  exit 0
fi

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

exec python3 "$ROOT/scripts/photo-sync/immich_reconcile_diagnose.py" \
  --config "$CONFIG" \
  "$@"
