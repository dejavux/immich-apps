#!/usr/bin/env bash
# Immich CLI 煙霧測試：上傳單張照片（Phase 3 Step 0）
#
# 用法:
#   eval "$(./scripts/dev/load-env-from-op.sh)"
#   ./scripts/photo-sync/test-upload.sh
#   ./scripts/photo-sync/test-upload.sh ~/Pictures/Photos\ Library.photoslibrary/originals
#
set -euo pipefail

LIB_PATH="${1:-$HOME/Pictures/Photos Library.photoslibrary/originals}"

if ! command -v immich >/dev/null 2>&1; then
  echo "ERROR: immich CLI not found. npm install -g @immich/cli" >&2
  exit 1
fi

if [[ -z "${IMMICH_API_KEY:-}" ]]; then
  echo "ERROR: IMMICH_API_KEY not set" >&2
  exit 1
fi

export IMMICH_INSTANCE_URL="${IMMICH_INSTANCE_URL:-${IMMICH_BASE_URL:-https://immich.3q.fi}}"

SAMPLE=$(find "$LIB_PATH" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.heic' -o -iname '*.png' \) -print -quit 2>/dev/null || true)

if [[ -z "$SAMPLE" ]]; then
  echo "ERROR: no image found under $LIB_PATH" >&2
  exit 1
fi

echo "Uploading: $SAMPLE"
immich -u "$IMMICH_INSTANCE_URL" -k "$IMMICH_API_KEY" upload "$SAMPLE"
echo "OK: Immich CLI upload smoke test passed"
