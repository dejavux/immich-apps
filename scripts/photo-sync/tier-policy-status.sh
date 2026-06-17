#!/usr/bin/env bash
# Single-page tier / reconcile / sync status for Phase 3.5 ops.
#
# Usage:
#   ./scripts/photo-sync/tier-policy-status.sh
#   ./scripts/photo-sync/tier-policy-status.sh --cutoff-days 365
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${PHOTO_SYNC_CONFIG:-$HOME/.config/immich-apps/photo-sync.config.yaml}"
TIER_LOG="${HOME}/Library/Logs/immich-photo-sync/tier"
RECONCILE_LOG="${HOME}/Library/Logs/immich-photo-sync/reconcile"
export PATH="${HOME}/.local/bin:${PATH}"

echo "=== Immich Photo Sync — Tier Status ==="
echo "config: ${CONFIG}"
echo "time:   $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo ""

echo "## Phase B download (icloud ismissing)"
python3 "$ROOT/scripts/photo-sync/tier_policy_monitor_ismissing.py" \
  --config "$CONFIG" "$@" 2>/dev/null || echo "  (ismissing monitor failed)"
echo ""

if [[ -f "${TIER_LOG}/state.json" ]]; then
  echo "## tier state.json"
  python3 - <<'PY'
import json
from pathlib import Path
s = json.loads(Path.home().joinpath(
    "Library/Logs/immich-photo-sync/tier/state.json"
).read_text())
for key in ("exported_uuids", "imported_uuids", "deleted_uuids"):
    val = s.get(key, [])
    print(f"  {key}: {len(val) if isinstance(val, list) else val}")
PY
  echo ""
fi

if [[ -f "${TIER_LOG}/tier-verify-staging.json" ]]; then
  echo "## staging verify"
  python3 -m json.tool "${TIER_LOG}/tier-verify-staging.json" | sed 's/^/  /'
  echo ""
fi

icloud_lib="${HOME}/Pictures/Photos Library.photoslibrary"
if [[ -f "${icloud_lib}/database/Photos.sqlite" ]]; then
  trashed="$(sqlite3 "${icloud_lib}/database/Photos.sqlite" \
    "SELECT COUNT(*) FROM ZASSET WHERE ZTRASHEDSTATE=1" 2>/dev/null || echo "?")"
  echo "## icloud Recently Deleted (sqlite ZTRASHEDSTATE=1): ${trashed}"
  echo ""
fi

latest_reconcile=""
while IFS= read -r -d '' f; do
  if [[ -z "$latest_reconcile" || "$f" -nt "$latest_reconcile" ]]; then
    latest_reconcile="$f"
  fi
done < <(find "${RECONCILE_LOG}" -maxdepth 1 -name 'reconcile-*.json' -type f -print0 2>/dev/null || true)
if [[ -n "$latest_reconcile" ]]; then
  echo "## latest reconcile dry-run"
  echo "  file: ${latest_reconcile}"
  python3 - <<PY
import json
from pathlib import Path
data = json.loads(Path("$latest_reconcile").read_text())
summary = data.get("summary") or data
keys = (
    "orphan_candidates", "orphan_ready_for_apply", "skipped_still_on_mac",
    "skipped_tier_local_retains", "applied",
)
for k in keys:
    if k in summary:
        print(f"  {k}: {summary[k]}")
PY
  echo ""
fi

if [[ -f "${TIER_LOG}/tier-delete-source-report.json" ]]; then
  echo "## last delete-source report"
  python3 - <<'PY'
import json
from pathlib import Path
r = json.loads(Path.home().joinpath(
    "Library/Logs/immich-photo-sync/tier/tier-delete-source-report.json"
).read_text())
for k in ("ready_to_delete", "album_verified_in_album", "in_trash", "remaining_in_source", "skipped_blocked"):
    if k in r:
        print(f"  {k}: {r[k]}")
PY
  echo ""
fi

echo "## suggested next"
if [[ -f "${TIER_LOG}/tier-verify-staging.json" ]]; then
  staging="$(python3 -c "import json; print(json.load(open('${TIER_LOG}/tier-verify-staging.json')).get('staging_items',0))")"
  if [[ "$staging" != "0" ]]; then
    echo "  → tier-policy-verify-staging.sh / retry-failed-import"
  fi
fi
if [[ "${trashed:-0}" != "0" && "${trashed:-?}" != "?" ]]; then
  echo "  → photos_gui_ops.py purge-recently-deleted"
fi
echo "  → tier-policy-delete-source-phaseb.sh (Terminal.app; Photos GUI)"
echo "  → immich-reconcile.sh  then  --apply --confirm  after purge"
echo "  → immich-sync.sh --dry-run"
