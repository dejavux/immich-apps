#!/usr/bin/env bash
# Ops W2: rsync Mac Photos originals → delta NFS.
# Skips the Sunday 03:30–05:30 window (immich-data-backup CronJob ~04:00 Asia/Taipei).
set -euo pipefail

DELTA_HOST="${DELTA_HOST:-delta.3q.fi}"
DELTA_BASE="${DELTA_BASE:-/mnt/volume1/nfs-models/photos-backup/mac-studio}"
LOCAL_ARCHIVE="${LOCAL_ARCHIVE:-$HOME/Pictures/LOCAL PHOTO LIBRARY.photoslibrary/originals}"
ICLOUD_PRIMARY="${ICLOUD_PRIMARY:-$HOME/Pictures/Photos Library.photoslibrary/originals}"
LOG_DIR="${LOG_DIR:-$HOME/Library/Logs/immich-mac-backup}"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${LOG_DIR}/rsync-${STAMP}.log"

mkdir -p "$LOG_DIR"

# Asia/Taipei: refuse Sunday 03:30–05:30 (cluster immich-data-backup ~04:00)
if TZ=Asia/Taipei date +%u | grep -q '^7$'; then
  hour_min="$(TZ=Asia/Taipei date +%H:%M)"
  if [[ "$hour_min" > "03:29" && "$hour_min" < "05:31" ]]; then
    echo "Skip: Sunday 03:30–05:30 blocked for immich-data-backup window." | tee -a "$LOG_FILE"
    exit 0
  fi
fi

exec >>"$LOG_FILE" 2>&1
echo "=== Mac library → delta NFS rsync @ $(date -Iseconds) ==="
echo "DELTA: ${DELTA_HOST}:${DELTA_BASE}"

run_sync() {
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
  ssh "$DELTA_HOST" mkdir -p -- "${dst}"
  rsync -avh --delete --partial --info=progress2 \
    --no-perms --no-owner --no-group \
    --exclude='.DS_Store' \
    "${src}/" "${DELTA_HOST}:${dst}"
  echo "[done] ${label} $(date -Iseconds)"
}

# Smaller library first (faster feedback)
run_sync "icloud-primary" "$ICLOUD_PRIMARY"
run_sync "local-archive" "$LOCAL_ARCHIVE"

echo "=== complete @ $(date -Iseconds) ==="
