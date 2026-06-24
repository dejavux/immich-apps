#!/usr/bin/env bash
# Ops W2 prep: dry-run rsync Mac Photos originals → delta NFS (no writes).
# Full automation scheduled Q3; run manually after Phase 4 + one backup cycle.
set -euo pipefail

DELTA_HOST="${DELTA_HOST:-delta.3q.fi}"
DELTA_BASE="${DELTA_BASE:-/home/nfs-storage/photos-backup/mac-studio}"
LOCAL_ARCHIVE="${LOCAL_ARCHIVE:-$HOME/Pictures/LOCAL PHOTO LIBRARY.photoslibrary/originals}"
ICLOUD_PRIMARY="${ICLOUD_PRIMARY:-$HOME/Pictures/Photos Library.photoslibrary/originals}"

echo "=== Mac library → delta NFS (dry-run) ==="
echo "DELTA: ${DELTA_HOST}:${DELTA_BASE}"
echo ""

run_dry() {
  local label="$1"
  local src="$2"
  local dst="${DELTA_BASE}/${label}/"
  if [[ ! -d "$src" ]]; then
    echo "[skip] ${label}: source not found: ${src}"
    return 0
  fi
  echo "--- ${label} ---"
  echo "  src: ${src}"
  echo "  dst: ${DELTA_HOST}:${dst}"
  rsync -avhn --delete --partial \
    --exclude='.DS_Store' \
    "${src}/" "${DELTA_HOST}:${dst}" | tail -20
  echo ""
}

run_dry "local-archive" "$LOCAL_ARCHIVE"
run_dry "icloud-primary" "$ICLOUD_PRIMARY"

echo "Done (dry-run only). Adjust LOCAL_ARCHIVE / ICLOUD_PRIMARY / DELTA_* if paths differ."
