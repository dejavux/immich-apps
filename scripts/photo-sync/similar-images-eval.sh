#!/usr/bin/env bash
# Similar images / duplicate detection eval (read-only). See runbook SIMILAR_IMAGES_EVAL.md
#
# Usage:
#   eval "$(./scripts/dev/load-env-from-op.sh)"
#   ./scripts/photo-sync/similar-images-eval.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${SIMILAR_IMAGES_EVAL_OUT:-$HOME/Library/Logs/immich-photo-sync/similar-images-eval-$(date +%Y%m%d).json}"

if [[ -z "${IMMICH_API_KEY:-}" ]] || [[ "${IMMICH_API_KEY}" == your-* ]]; then
  # shellcheck source=scripts/photo-sync/ensure-immich-creds.sh
  source "$ROOT/scripts/photo-sync/ensure-immich-creds.sh"
  load_immich_creds "$ROOT"
fi

BASE="${IMMICH_INSTANCE_URL:-https://immich.3q.fi}"
BASE="${BASE%/}/api"

VERSION=$(curl -fsS -H "x-api-key: $IMMICH_API_KEY" "$BASE/server/version")
JOBS=$(curl -fsS -H "x-api-key: $IMMICH_API_KEY" "$BASE/jobs")
DUP_COUNT=$(curl -fsS -H "x-api-key: $IMMICH_API_KEY" "$BASE/duplicates" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
DUP_SAMPLE=$(curl -fsS -H "x-api-key: $IMMICH_API_KEY" "$BASE/duplicates" | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d[0] if d else {}))")

python3 - "$OUT" "$VERSION" "$JOBS" "$DUP_COUNT" "$DUP_SAMPLE" <<'PY'
import json
import sys
from datetime import datetime, timezone

out, version, jobs, dup_count, dup_sample = sys.argv[1:6]
jobs_data = json.loads(jobs)
dup_sample_data = json.loads(dup_sample)
ml_jobs = [j for j in jobs_data if isinstance(j, dict) and "duplicate" in str(j.get("name", "")).lower()]

report = {
    "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "immich_version": json.loads(version),
    "duplicate_group_count": int(dup_count),
    "duplicate_sample": dup_sample_data,
    "ml_jobs_duplicate_related": ml_jobs,
    "ground_truth": [],
    "recall": None,
    "precision_sample": None,
    "decision": "pending_ground_truth",
    "notes": "Run Step 2–3 in SIMILAR_IMAGES_EVAL.md for recall/precision; this script captures baseline API state.",
}
Path = __import__("pathlib").Path
Path(out).write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps({"out": out, "duplicate_group_count": int(dup_count)}, indent=2))
PY

echo "Report: $OUT"
