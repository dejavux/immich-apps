#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"
exec "$ROOT/scripts/photo-sync/run-with-op-env.sh" \
  python3 "$ROOT/scripts/photo-sync/immich_import_to_icloud.py" "$@"
