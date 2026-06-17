#!/usr/bin/env bash
# Restore hidden icloud-primary photos (ZVISIBILITYSTATE=2) after tier delete-source.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec python3 "$ROOT/scripts/photo-sync/icloud_recovery_unhide.py" "$@"
