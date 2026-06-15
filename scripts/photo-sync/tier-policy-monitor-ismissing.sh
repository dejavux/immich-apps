#!/usr/bin/env bash
# Monitor icloud-primary ismissing / local-path counts for Phase B download progress.
#
# Usage:
#   ./scripts/photo-sync/tier-policy-monitor-ismissing.sh
#   ./scripts/photo-sync/tier-policy-monitor-ismissing.sh --cutoff-days 365
#   WATCH=1 INTERVAL=300 ./scripts/photo-sync/tier-policy-monitor-ismissing.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
LOG="${TIER_ISMISSING_LOG:-$HOME/Library/Logs/immich-photo-sync/tier/ismissing-monitor.log}"
INTERVAL="${INTERVAL:-300}"
export PATH="${HOME}/.local/bin:${PATH}"

snapshot() {
  local ts line
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  line="$(python3 "$ROOT/scripts/photo-sync/tier_policy_monitor_ismissing.py" \
    --config "$CONFIG" "$@")"
  echo "[$ts] $line" | tee -a "$LOG"
}

mkdir -p "$(dirname "$LOG")"
snapshot "$@"

if [[ "${WATCH:-0}" == "1" ]]; then
  echo "Watching every ${INTERVAL}s → $LOG"
  while true; do
    sleep "$INTERVAL"
    snapshot "$@"
  done
fi
