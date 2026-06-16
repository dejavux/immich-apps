#!/usr/bin/env bash
# Apply tier import date fixes via osxphotos timewarp (run in Terminal.app, not Cursor).
#
# Usage:
#   ./scripts/photo-sync/tier-policy-fix-import-dates-timewarp.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
PLAN="${PLAN:-$HOME/Library/Logs/immich-photo-sync/tier/fix-import-dates-plan.json}"
LOG="${TIER_FIX_DATE_WARP_LOG:-$HOME/Library/Logs/immich-photo-sync/tier/fix-import-dates-timewarp.log}"
LOCAL_LIB="${LOCAL_PHOTOS_LIBRARY:-$HOME/Pictures/LOCAL PHOTO LIBRARY.photoslibrary}"

mkdir -p "$(dirname "$LOG")" "$(dirname "$PLAN")"

if [[ ! -f "$PLAN" ]]; then
  echo "Generating plan (dry-run)..."
  python3 "$ROOT/scripts/photo-sync/tier_policy_fix_import_dates.py" \
    --config "$CONFIG" --dry-run --write-plan "$PLAN"
fi

open -a Photos "$LOCAL_LIB"
echo "Waiting for Photos (accept any automation / library prompts)..."
sleep 8
osascript -e 'tell application "Photos" to activate' || true
sleep 2

exec >>"$LOG" 2>&1
echo "=== timewarp batch start $(date) plan=$PLAN ==="

PYTHONUNBUFFERED=1 python3 - "$PLAN" "$LOCAL_LIB" <<'PY'
import json
import subprocess
import sys
import time
from pathlib import Path

plan_path = Path(sys.argv[1])
local_lib = sys.argv[2]
plan = json.loads(plan_path.read_text())
ok = fail = 0
total = len(plan)
for idx, item in enumerate(plan, start=1):
    uuid = item["uuid"]
    date = item["date"]
    time_str = item.get("time") or "00:00:00"
    name = item.get("filename", uuid)
    print(f"[{idx}/{total}] {name} -> {date} {time_str}", flush=True)
    proc = subprocess.run(
        [
            "osxphotos", "timewarp",
            "--uuid", uuid,
            "--date", date,
            "--time", time_str,
            "--library", local_lib,
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode == 0:
        ok += 1
    else:
        fail += 1
        err = (proc.stderr or proc.stdout or "").strip()
        print(f"FAILED {uuid}: {err}", flush=True)
    time.sleep(0.5)
print(f"=== done ok={ok} fail={fail} total={total} ===", flush=True)
sys.exit(1 if fail else 0)
PY
