#!/usr/bin/env bash
# Import a tier-policy staging batch into local-archive (manual-friendly).
#
# Usage:
#   ./scripts/photo-sync/tier-policy-import-staging.sh /tmp/immich-photo-sync/tier-staging/batch-YYYYMMDD-HHMMSS
#   ./scripts/photo-sync/tier-policy-import-staging.sh /path/to/batch --import-mode manual
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
export PATH="${HOME}/.local/bin:${PATH}"

BATCH_DIR="${1:?staging batch directory required}"
shift || true

exec python3 "$ROOT/scripts/photo-sync/tier_policy_runner.py" \
  --config "$CONFIG" \
  --force \
  --import-staging "$BATCH_DIR" \
  "$@"
