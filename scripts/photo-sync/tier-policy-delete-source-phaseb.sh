#!/usr/bin/env bash
# Phase B delete-source retry: populate TierPolicy-Delete from 20260615 manifests only.
#
# Run in Terminal.app (not Cursor agent shell):
#   ./scripts/photo-sync/tier-policy-delete-source-phaseb.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="${HOME}/Library/Logs/immich-photo-sync/tier"
LOG="${LOG_DIR}/delete-source-phaseb-retry.log"
export PATH="${HOME}/.local/bin:${PATH}"

open -a Photos "${HOME}/Pictures/Photos Library.photoslibrary" || true
sleep 3

MANIFEST_ARGS=()
for f in "${LOG_DIR}"/tier-delete-manifest-20260615-*.json; do
  [[ -f "$f" ]] || continue
  MANIFEST_ARGS+=(--manifest "$f")
done

if [[ ${#MANIFEST_ARGS[@]} -eq 0 ]]; then
  echo "No Phase B manifests (tier-delete-manifest-20260615-*.json)" >&2
  exit 1
fi

echo "Phase B delete-source: ${#MANIFEST_ARGS[@]} manifest(s), --resume, log → ${LOG}"
exec >>"${LOG}" 2>&1

echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) delete-source phaseb retry ==="
python3 "${ROOT}/scripts/photo-sync/tier_policy_delete_source.py" \
  --manifests-only \
  "${MANIFEST_ARGS[@]}" \
  --yes \
  --skip-gui \
  --resume \
  --batch-size 25
