#!/usr/bin/env bash
# 觀察 Immich 背景 job 成果：metadata / EXIF / 人臉 / tags（P3 CLIP 觀察入口）
#
# 用法:
#   eval "$(./scripts/dev/load-env-from-op.sh)"
#   ./scripts/photo-sync/observe-asset-intelligence.sh
#   ./scripts/photo-sync/observe-asset-intelligence.sh --tag line-import --limit 5
#   ./scripts/photo-sync/observe-asset-intelligence.sh --smart "beach sunset"
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TAG="line-import"
LIMIT=10
SMART_QUERY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TAG="$2"; shift 2 ;;
    --limit) LIMIT="$2"; shift 2 ;;
    --smart) SMART_QUERY="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--tag NAME] [--limit N] [--smart QUERY]"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "${IMMICH_API_KEY:-}" ]] || [[ "${IMMICH_API_KEY}" == your-* ]]; then
  unset IMMICH_API_KEY
fi

# shellcheck source=scripts/photo-sync/ensure-immich-creds.sh
source "$ROOT/scripts/photo-sync/ensure-immich-creds.sh"
load_immich_creds "$ROOT"

BASE="${IMMICH_INSTANCE_URL%/}"
if [[ "$BASE" != */api ]]; then
  BASE="${BASE}/api"
fi
API_KEY="$IMMICH_API_KEY"

auth_header() {
  curl -fsS -H "x-api-key: $API_KEY" -H "Accept: application/json" "$@"
}

if [[ -n "$SMART_QUERY" ]]; then
  echo "=== Smart Search: $SMART_QUERY ==="
  auth_header -X POST "$BASE/search/smart" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json,sys; print(json.dumps({'query': sys.argv[1]}))" "$SMART_QUERY")" \
    | python3 -m json.tool | head -80
  echo
fi

echo "=== Metadata search: tag=$TAG (limit=$LIMIT) ==="
TAG_ID="$(auth_header "$BASE/tags" | python3 -c "
import json, sys
name = sys.argv[1]
for t in json.load(sys.stdin):
    if t.get('name') == name:
        print(t['id'])
        break
" "$TAG")"

if [[ -z "$TAG_ID" ]]; then
  echo "Tag not found: $TAG"
else
  METADATA_RESPONSE="$(auth_header -X POST "$BASE/search/metadata" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json,sys; print(json.dumps({'tagIds': [sys.argv[1]], 'size': int(sys.argv[2])}))" "$TAG_ID" "$LIMIT")")"
  python3 - "$METADATA_RESPONSE" <<'PY'
import json, sys
data = json.loads(sys.argv[1])
assets = data.get("assets", {}).get("items", [])
if not assets:
    print("(no assets)")
    sys.exit(0)
for a in assets:
    exif = a.get("exifInfo") or {}
    people = a.get("people") or []
    tags = [t.get("name") for t in (a.get("tags") or []) if t.get("name")]
    camera = " ".join(x for x in [exif.get("make"), exif.get("model")] if x)
    print(f"- {a.get('id')}  {a.get('originalFileName')}")
    print(f"  hasMetadata={a.get('hasMetadata')}  localDateTime={a.get('localDateTime')}")
    if camera:
        print(f"  camera={camera}")
    print(f"  people={len(people)}  tags={', '.join(tags[:8])}")
PY
fi

echo
echo "=== Job queue (thumbnail / metadata / smart search) ==="
auth_header "$BASE/jobs" | python3 -m json.tool 2>/dev/null | head -40 || echo "(jobs endpoint unavailable)"
