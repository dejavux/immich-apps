#!/usr/bin/env bash
# fswatch 監控所有 enabled libraries，debounce 後觸發 immich-sync.sh
#
# 用法:
#   eval "$(./scripts/dev/load-env-from-op.sh)"
#   ./scripts/photo-sync/immich-watch.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
SYNC_SCRIPT="$SCRIPT_DIR/immich-sync.sh"

if ! command -v fswatch >/dev/null 2>&1; then
  echo "ERROR: fswatch not found. brew install fswatch" >&2
  exit 1
fi

LOG_DIR=$(python3 -c "import yaml; from pathlib import Path; c=yaml.safe_load(open('$CONFIG')); print(Path(c.get('sync',{}).get('log_dir','~/Library/Logs/immich-photo-sync')).expanduser())")
DEBOUNCE=$(python3 -c "import yaml; c=yaml.safe_load(open('$CONFIG')); print(c.get('sync',{}).get('debounce_seconds', 30))")
LOG_FILE="$LOG_DIR/watch.log"
mkdir -p "$LOG_DIR"

mapfile -t WATCH_PATHS < <(python3 -c "
import yaml, os
with open('$CONFIG') as f:
    cfg = yaml.safe_load(f)
for lib in cfg.get('libraries', []):
    if lib.get('enabled', True):
        print(os.path.expanduser(lib['path']))
")

if [[ ${#WATCH_PATHS[@]} -eq 0 ]]; then
  echo "ERROR: no enabled libraries in $CONFIG" >&2
  exit 1
fi

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log "Starting fswatch on: ${WATCH_PATHS[*]}"

fswatch -o "${WATCH_PATHS[@]}" | while read -r _; do
  log "Change detected, debounce ${DEBOUNCE}s"
  sleep "$DEBOUNCE"
  log "Triggering sync"
  bash "$SYNC_SCRIPT" >> "$LOG_FILE" 2>&1 || log "Sync failed"
done
