#!/usr/bin/env bash
# Reconcile Immich Mac Photos (iCloud) album with icloud-primary personal library.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"
# shellcheck source=scripts/photo-sync/ensure-immich-creds.sh
source "$ROOT/scripts/photo-sync/ensure-immich-creds.sh"
load_immich_creds "$ROOT"
exec python3 "$ROOT/scripts/photo-sync/immich_icloud_album_reconcile.py" "$@"
