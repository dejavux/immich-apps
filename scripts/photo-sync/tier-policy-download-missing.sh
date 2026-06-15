#!/usr/bin/env bash
# Phase B: force iCloud originals download via osxphotos (--download-missing).
#
# Apple does not offer "download all"; this triggers PhotoKit export per photo.
# Requires Photos.app (icloud-primary), "Download Originals to this Mac", free disk.
#
# Usage:
#   ./scripts/photo-sync/tier-policy-download-missing.sh --dry-run
#   ./scripts/photo-sync/tier-policy-download-missing.sh --cutoff-days 365
#   ./scripts/photo-sync/tier-policy-download-missing.sh --from-date 2022-01-01 --to-date 2022-12-31
#   MIN_FREE_GB=20 ./scripts/photo-sync/tier-policy-download-missing.sh --cutoff-days 365
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
LOG_DIR="${TIER_LOG_DIR:-$HOME/Library/Logs/immich-photo-sync/tier}"
LOG="${TIER_ICLOUD_PULL_LOG:-$LOG_DIR/icloud-pull.log}"
STAGING="${TIER_ICLOUD_PULL_STAGING:-/tmp/immich-icloud-pull}"
MIN_FREE_GB="${MIN_FREE_GB:-10}"
export PATH="${HOME}/.local/bin:${PATH}"

DRY_RUN=false
CUTOFF_ARGS=()
FROM_DATE=""
TO_DATE=""

usage() {
  sed -n '2,12p' "$0"
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --cutoff-days) CUTOFF_ARGS=(--cutoff-days "$2"); shift 2 ;;
    --cutoff-date) CUTOFF_ARGS=(--cutoff-date "$2"); shift 2 ;;
    --from-date) FROM_DATE="$2"; shift 2 ;;
    --to-date) TO_DATE="$2"; shift 2 ;;
    -h | --help) usage 0 ;;
    *) echo "Unknown option: $1" >&2; usage 1 ;;
  esac
done

CUTOFF_MONITOR=(--cutoff-days 365)
if [[ ${#CUTOFF_ARGS[@]} -gt 0 ]]; then
  CUTOFF_MONITOR=("${CUTOFF_ARGS[@]}")
fi

if ! command -v osxphotos >/dev/null 2>&1; then
  echo "ERROR: osxphotos not found. pip3 install --user osxphotos" >&2
  exit 1
fi

# shellcheck disable=SC1091
source "$ROOT/scripts/photo-sync/ensure-immich-creds.sh"

LIBRARY="$(
  python3 - <<'PY' "$CONFIG"
import sys, yaml
from pathlib import Path
cfg = yaml.safe_load(Path(sys.argv[1]).expanduser().read_text())
tier = cfg.get("tier_policy") or {}
for lib in cfg.get("libraries", []):
    if lib.get("id") == tier.get("source_library_id", "icloud-primary"):
        p = Path(lib["path"]).expanduser()
        print(p.parent if p.name == "originals" else p)
        break
PY
)"

if [[ -z "$FROM_DATE" || -z "$TO_DATE" ]]; then
  CUTOFF="$(
    python3 "$ROOT/scripts/photo-sync/tier_policy_monitor_ismissing.py" \
      --config "$CONFIG" "${CUTOFF_ARGS[@]}" --cutoff-days 365 2>/dev/null \
      | python3 -c "import json,sys; print(json.load(sys.stdin)['cutoff_date'])" \
      || date -v-365d +%Y-%m-%d 2>/dev/null \
      || date -d '365 days ago' +%Y-%m-%d
  )"
  FROM_DATE="${FROM_DATE:-1970-01-01}"
  TO_DATE="${TO_DATE:-$CUTOFF}"
fi

FREE_GB="$(
  df -g "$(dirname "$LIBRARY")" | awk 'NR==2 {print $4}'
)"
if [[ "$DRY_RUN" != true && "$FREE_GB" -lt "$MIN_FREE_GB" ]]; then
  echo "ERROR: free disk ${FREE_GB}GB < MIN_FREE_GB=${MIN_FREE_GB}GB" >&2
  echo "  Phase B eligible ismissing ≈ 71GB — free space or use --from-date/--to-date year batches." >&2
  exit 1
fi

mkdir -p "$LOG_DIR" "$STAGING"
BATCH_STAGING="$STAGING/${FROM_DATE}_to_${TO_DATE}"
mkdir -p "$BATCH_STAGING"

echo "=== tier-policy-download-missing ===" | tee -a "$LOG"
echo "library: $LIBRARY" | tee -a "$LOG"
echo "range: $FROM_DATE .. $TO_DATE (to-date exclusive per osxphotos)" | tee -a "$LOG"
echo "free_disk_gb: $FREE_GB" | tee -a "$LOG"
echo "staging: $BATCH_STAGING (export copies; originals land in .photoslibrary)" | tee -a "$LOG"

# Before snapshot
echo "--- before ---" | tee -a "$LOG"
"$ROOT/scripts/photo-sync/tier-policy-monitor-ismissing.sh" "${CUTOFF_MONITOR[@]}" 2>&1 | tee -a "$LOG"

OSX_ARGS=(
  export "$BATCH_STAGING"
  --library "$LIBRARY"
  --from-date "$FROM_DATE"
  --to-date "$TO_DATE"
  --download-missing
  --use-photokit
  --verbose
)
if [[ "$DRY_RUN" == true ]]; then
  OSX_ARGS+=(--dry-run)
  echo "DRY-RUN: osxphotos ${OSX_ARGS[*]}" | tee -a "$LOG"
fi

echo "Starting osxphotos (Photos.app must stay available)…" | tee -a "$LOG"
set +e
osxphotos "${OSX_ARGS[@]}" 2>&1 | tee -a "$LOG"
RC=${PIPESTATUS[0]}
set -e

echo "--- after (exit=$RC) ---" | tee -a "$LOG"
"$ROOT/scripts/photo-sync/tier-policy-monitor-ismissing.sh" "${CUTOFF_MONITOR[@]}" 2>&1 | tee -a "$LOG"

if [[ "$RC" -ne 0 ]]; then
  echo "WARN: osxphotos exit $RC — re-run same command; completed downloads are kept." | tee -a "$LOG"
  exit "$RC"
fi

echo "Done. Log: $LOG" | tee -a "$LOG"
echo "When eligible_ismissing=0 → tier-policy-bulk-export.sh --cutoff-days 365"
