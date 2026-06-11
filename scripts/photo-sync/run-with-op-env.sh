#!/usr/bin/env bash
# Launchd / cron wrapper：從 1Password 載入 Immich 憑證後執行子命令
#
# 用法:
#   ./scripts/photo-sync/run-with-op-env.sh ./scripts/photo-sync/immich-watch.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <command> [args...]" >&2
  exit 1
fi

if [[ -z "${IMMICH_API_KEY:-}" ]]; then
  if command -v op >/dev/null 2>&1; then
    eval "$("$ROOT/scripts/dev/load-env-from-op.sh")"
  else
    echo "ERROR: IMMICH_API_KEY unset and op CLI not found" >&2
    exit 1
  fi
fi

export IMMICH_INSTANCE_URL="${IMMICH_INSTANCE_URL:-${IMMICH_BASE_URL:-https://immich.3q.fi}}"

exec "$@"
