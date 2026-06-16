#!/usr/bin/env bash
# Phase 3.6 M3: fswatch Mac library paths → debounced immich-reconcile (dry-run or auto-apply)
#
# 用法:
#   eval "$(./scripts/dev/load-env-from-op.sh)"
#   ./scripts/photo-sync/immich-reconcile-watch.sh
#
# Config: sync.reconcile.enabled=true, sync.reconcile.watch.enabled=true
#   watch.debounce_seconds (default 300)
#   auto_apply: true 僅在 sync.delete_policy=conservative 時會加 --apply --confirm
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
RECONCILE_SCRIPT="$SCRIPT_DIR/immich-reconcile.sh"
RUNNER="$SCRIPT_DIR/immich_reconcile.py"

if ! command -v fswatch >/dev/null 2>&1; then
  echo "ERROR: fswatch not found. brew install fswatch" >&2
  exit 1
fi

LOG_DIR=""
DEBOUNCE=300
AUTO_APPLY=false
WATCH_PATHS=()
while IFS= read -r line; do
  case "$line" in
    LOG_DIR=*) LOG_DIR="${line#LOG_DIR=}" ;;
    DEBOUNCE=*) DEBOUNCE="${line#DEBOUNCE=}" ;;
    AUTO_APPLY=*) AUTO_APPLY="${line#AUTO_APPLY=}" ;;
    *) [[ -n "$line" ]] && WATCH_PATHS+=("$line") ;;
  esac
done < <(python3 "$RUNNER" --watch-config "$CONFIG")

LOG_FILE="$LOG_DIR/watch.log"
mkdir -p "$LOG_DIR"

if [[ ${#WATCH_PATHS[@]} -eq 0 ]]; then
  echo "ERROR: no enabled libraries in $CONFIG" >&2
  exit 1
fi

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log "Starting reconcile fswatch on: ${WATCH_PATHS[*]} (debounce=${DEBOUNCE}s auto_apply=${AUTO_APPLY})"

fswatch -o "${WATCH_PATHS[@]}" | while read -r _; do
  log "Change detected, debounce ${DEBOUNCE}s"
  sleep "$DEBOUNCE"
  log "Triggering reconcile"
  if [[ "$AUTO_APPLY" == "true" ]]; then
    bash "$RECONCILE_SCRIPT" --config "$CONFIG" --apply --confirm >> "$LOG_FILE" 2>&1 \
      || log "Reconcile apply failed"
  else
    bash "$RECONCILE_SCRIPT" --config "$CONFIG" >> "$LOG_FILE" 2>&1 \
      || log "Reconcile dry-run failed"
  fi
done
