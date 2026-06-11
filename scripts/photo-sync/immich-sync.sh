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

python3 - "$CONFIG" "$ONLY_LIBRARY" "$DRY_RUN" "$LOG_FILE" <<'PY'
import os, subprocess, sys
from datetime import datetime
from pathlib import Path

import yaml

config_path, only_lib, dry_run, log_file = sys.argv[1:5]
dry = dry_run == "true"

def log(msg: str) -> None:
    line = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {msg}\n"
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(line)
    print(line, end="")

with open(config_path, encoding="utf-8") as f:
    cfg = yaml.safe_load(f)

immich_cfg = cfg.get("immich", {})
url = os.environ.get("IMMICH_INSTANCE_URL") or immich_cfg.get("instance_url", "")
api_key = os.environ.get("IMMICH_API_KEY", "")
if not api_key:
    log("ERROR: IMMICH_API_KEY not set")
    sys.exit(1)
if url:
    os.environ["IMMICH_INSTANCE_URL"] = url.rstrip("/")

sync_cfg = cfg.get("sync", {})
recursive = sync_cfg.get("recursive", True)
concurrency = sync_cfg.get("upload_concurrency", 4)
os.environ["IMMICH_UPLOAD_CONCURRENCY"] = str(concurrency)

for lib in cfg.get("libraries", []):
    if not lib.get("enabled", True):
        continue
    lib_id = lib.get("id", "")
    if only_lib and lib_id != only_lib:
        continue
    lib_path = Path(os.path.expanduser(lib.get("path", "")))
    album = lib.get("album", lib.get("name", lib_id))
    if not lib_path.is_dir():
        log(f"ERROR library={lib_id} path not found: {lib_path}")
        continue
    log(f"START library={lib_id} path={lib_path} album={album}")
    cmd = ["immich", "-u", os.environ["IMMICH_INSTANCE_URL"], "-k", api_key, "upload", str(lib_path)]
    if recursive:
        cmd.append("--recursive")
    cmd.extend(["-A", album])
    if dry:
        cmd.append("-n")
    result = subprocess.run(cmd, capture_output=False)
    if result.returncode == 0:
        log(f"DONE library={lib_id}")
    else:
        log(f"FAILED library={lib_id} exit={result.returncode}")

log("All libraries processed")
PY
