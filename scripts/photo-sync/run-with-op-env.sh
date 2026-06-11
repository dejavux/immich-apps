#!/usr/bin/env bash
# Launchd / cron wrapper：載入 Immich 憑證後執行子命令
#
# 用法:
#   ./scripts/photo-sync/run-with-op-env.sh ./scripts/photo-sync/immich-watch.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ -d "${HOME}/.pyenv/shims" ]]; then
  export PATH="${HOME}/.pyenv/shims:${PATH}"
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <command> [args...]" >&2
  exit 1
fi

if [[ -z "${IMMICH_API_KEY:-}" || "${IMMICH_API_KEY}" == "your-immich-api-key-here" || "${IMMICH_API_KEY}" == your-* ]]; then
  unset IMMICH_API_KEY
fi

# shellcheck source=scripts/photo-sync/ensure-immich-creds.sh
source "$ROOT/scripts/photo-sync/ensure-immich-creds.sh"
load_immich_creds "$ROOT"

exec "$@"
