#!/usr/bin/env bash
# 依 photo-sync.config.yaml 將一或多個 .photoslibrary/originals 同步到 Immich
#
# 用法:
#   eval "$(./scripts/dev/load-env-from-op.sh)"
#   ./scripts/photo-sync/immich-sync.sh
#   ./scripts/photo-sync/immich-sync.sh --library icloud-primary
#   ./scripts/photo-sync/immich-sync.sh --dry-run
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
LOCK_FILE="/tmp/immich-photo-sync.lock"
ONLY_LIBRARY=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) CONFIG="$2"; shift 2 ;;
    --library) ONLY_LIBRARY="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help)
      echo "Usage: $0 [--config PATH] [--library ID] [--dry-run]"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if ! command -v immich >/dev/null 2>&1; then
  echo "ERROR: immich CLI not found. npm install -g @immich/cli" >&2
  exit 1
fi

if [[ ! -f "$CONFIG" ]]; then
  echo "ERROR: config not found: $CONFIG" >&2
  echo "Copy: cp $ROOT/scripts/photo-sync/photo-sync.config.yaml.example $CONFIG" >&2
  exit 1
fi

if [[ -z "${IMMICH_API_KEY:-}" ]] || [[ "${IMMICH_API_KEY}" == "your-immich-api-key-here" ]] || [[ "${IMMICH_API_KEY}" == your-* ]]; then
  unset IMMICH_API_KEY
fi

# shellcheck source=scripts/photo-sync/ensure-immich-creds.sh
source "$ROOT/scripts/photo-sync/ensure-immich-creds.sh"
load_immich_creds "$ROOT"

if [ -f "$LOCK_FILE" ]; then
  PID=$(cat "$LOCK_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    echo "Another sync running (PID $PID)"
    exit 0
  fi
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

export CONFIG
LOG_FILE=$(python3 <<'PY'
import yaml, os
from pathlib import Path
cfg = yaml.safe_load(open(os.environ["CONFIG"], encoding="utf-8"))
log_dir = Path(os.path.expanduser(cfg.get("sync", {}).get("log_dir", "~/Library/Logs/immich-photo-sync")))
log_dir.mkdir(parents=True, exist_ok=True)
print(log_dir / "sync.log")
PY
)

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

python3 "$ROOT/scripts/photo-sync/immich_sync_runner.py" \
  "$CONFIG" "$ONLY_LIBRARY" "$DRY_RUN" "$LOG_FILE"
