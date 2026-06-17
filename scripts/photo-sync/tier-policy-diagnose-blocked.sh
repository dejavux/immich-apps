#!/usr/bin/env bash
# Diagnose tier delete-source blocked UUIDs (Phase B manifests).
#
# Usage:
#   ./scripts/photo-sync/tier-policy-diagnose-blocked.sh
#   ./scripts/photo-sync/tier-policy-diagnose-blocked.sh --manifests-only
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"

exec python3 "$ROOT/scripts/photo-sync/tier_policy_diagnose_blocked.py" "$@"
