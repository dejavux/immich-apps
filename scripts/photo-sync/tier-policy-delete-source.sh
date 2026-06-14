#!/usr/bin/env bash
# Delete tier-policy verified items from icloud-primary (album + Photos GUI).
#
# Usage:
#   ./scripts/photo-sync/tier-policy-delete-source.sh --dry-run
#   ./scripts/photo-sync/tier-policy-delete-source.sh --yes
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"

exec python3 "$ROOT/scripts/photo-sync/tier_policy_delete_source.py" "$@"
