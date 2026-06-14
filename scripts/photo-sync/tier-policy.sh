#!/usr/bin/env bash
# Phase 3.5 M3: tier policy dry-run / execute (export → import, manual delete gate).
#
# Usage:
#   ./scripts/photo-sync/tier-policy.sh --dry-run
#   ./scripts/photo-sync/tier-policy.sh --execute --batch-size 10
#
# Requires: osxphotos, photoscript (execute only), Photos.app available for import.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
LOCK_FILE="/tmp/immich-tier-policy.lock"

export PATH="${HOME}/.local/bin:${PATH}"

DRY_RUN=""
EXECUTE=""
EXTRA=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) CONFIG="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --execute) EXECUTE=true; shift ;;
    -h|--help)
      cat <<EOF
Usage: $0 [--dry-run] [--execute] [--batch-size N] [--config PATH]

  --dry-run     Plan only (default when tier_policy.dry_run: true)
  --execute     Export (+ optional import; use --export-only to skip import)
  --export-only With --execute: staging only
  --import-staging DIR   Import existing batch (see tier-policy-import-staging.sh)
  --import-mode manual|auto
  --force       Allow execute when enabled: false
  --batch-size  Photos per batch (default: tier_policy.batch_size or 10)
  --no-pause    Skip manual-delete confirmation prompt

PoC scripts:
  tier-policy-poc.sh
  tier-policy-spotcheck.sh
  tier-policy-cross-library-poc.sh
EOF
      exit 0
      ;;
    *) EXTRA+=("$1"); shift ;;
  esac
done

if ! command -v osxphotos >/dev/null 2>&1; then
  echo "ERROR: osxphotos not found." >&2
  echo "  pip3 install --user osxphotos" >&2
  exit 1
fi

if [[ "$EXECUTE" == true ]]; then
  : # osxphotos import uses Photos.app; no extra Python deps
fi

if [[ ! -f "$CONFIG" ]]; then
  echo "ERROR: config not found: $CONFIG" >&2
  exit 1
fi

if [[ -f "$LOCK_FILE" ]]; then
  PID=$(cat "$LOCK_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    echo "Another tier-policy run in progress (PID $PID)"
    exit 0
  fi
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

ARGS=()
if [[ "$DRY_RUN" == true ]]; then
  ARGS+=(--dry-run)
fi
if [[ "$EXECUTE" == true ]]; then
  ARGS+=(--execute)
fi

exec python3 "$ROOT/scripts/photo-sync/tier_policy_runner.py" \
  --config "$CONFIG" \
  "${ARGS[@]}" \
  "${EXTRA[@]}"
