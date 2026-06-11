#!/usr/bin/env bash
# 將既有 LINE Bot 上傳照片加入 LINE Inbox 相簿（release 前已上傳的補登）
#
# 預設以 originalFileName 前綴 line- 搜尋（Bot 上傳命名規則），
# 不依賴 line-import tag（歷史上傳可能未成功打 tag）。
#
# 用法:
#   eval "$(./scripts/dev/load-env-from-op.sh)"
#   ./scripts/line-bot/backfill-line-inbox-album.sh --dry-run
#   ./scripts/line-bot/backfill-line-inbox-album.sh
#   ./scripts/line-bot/backfill-line-inbox-album.sh --since 2026-06-11
#   ./scripts/line-bot/backfill-line-inbox-album.sh --apply-tags
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ALBUM_NAME="${IMMICH_LINE_ALBUM_NAME:-LINE Inbox}"
TAG_NAME="${LINE_IMPORT_TAG:-line-import}"
FILENAME_PREFIX="${LINE_FILENAME_PREFIX:-line-}"
SOURCE="${LINE_BACKFILL_SOURCE:-filename}"
SINCE=""
DRY_RUN=false
APPLY_TAGS=false
PAGE_SIZE=250

while [[ $# -gt 0 ]]; do
  case "$1" in
    --album) ALBUM_NAME="$2"; shift 2 ;;
    --since) SINCE="$2"; shift 2 ;;
    --source) SOURCE="$2"; shift 2 ;;
    --apply-tags) APPLY_TAGS=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help)
      cat <<'EOF'
Usage: backfill-line-inbox-album.sh [options]

Options:
  --album NAME       Album name (default: LINE Inbox)
  --since YYYY-MM-DD Only assets uploaded on/after this UTC date
  --source MODE      filename (default) | tag
  --apply-tags       Also create/attach line-import tag on matched assets
  --dry-run          Print plan only
EOF
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

export ALBUM_NAME TAG_NAME FILENAME_PREFIX SOURCE SINCE DRY_RUN APPLY_TAGS PAGE_SIZE
export IMMICH_INSTANCE_URL IMMICH_API_KEY
python3 <<'PY'
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

BASE = os.environ["IMMICH_INSTANCE_URL"].rstrip("/")
if not BASE.endswith("/api"):
    BASE = f"{BASE}/api"
API_KEY = os.environ["IMMICH_API_KEY"]
ALBUM_NAME = os.environ["ALBUM_NAME"]
TAG_NAME = os.environ["TAG_NAME"]
FILENAME_PREFIX = os.environ["FILENAME_PREFIX"]
SOURCE = os.environ.get("SOURCE", "filename")
SINCE = os.environ.get("SINCE", "")
DRY_RUN = os.environ.get("DRY_RUN") == "true"
APPLY_TAGS = os.environ.get("APPLY_TAGS") == "true"
PAGE_SIZE = int(os.environ.get("PAGE_SIZE", "250"))


def api(method: str, path: str, body=None):
    url = f"{BASE}{path}"
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "x-api-key": API_KEY,
            "Accept": "application/json",
            **({"Content-Type": "application/json"} if body is not None else {}),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
            if not raw:
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        raise RuntimeError(f"{method} {path} -> {exc.code}: {detail}") from exc


def list_tags() -> list[dict]:
    tags = api("GET", "/tags")
    return tags if isinstance(tags, list) else []


def find_tag_id(name: str) -> str | None:
    for tag in list_tags():
        if tag.get("name") == name or tag.get("value") == name:
            return tag["id"]
    return None


def ensure_tag_id(name: str) -> str:
    existing = find_tag_id(name)
    if existing:
        return existing
    created = api("POST", "/tags", {"name": name})
    return created["id"]


def find_album_id(name: str) -> str | None:
    albums = api("GET", "/albums")
    for album in albums:
        if album.get("albumName") == name:
            return album["id"]
    return None


def search_assets(payload: dict) -> list[str]:
    ids: list[str] = []
    page = 1
    while True:
        body = {**payload, "size": PAGE_SIZE, "page": page}
        result = api("POST", "/search/metadata", body)
        items = (result or {}).get("assets", {}).get("items", [])
        if not items:
            break
        ids.extend(item["id"] for item in items if item.get("id"))
        total = (result or {}).get("assets", {}).get("total")
        if len(items) < PAGE_SIZE:
            break
        if total is not None and len(ids) >= total:
            break
        page += 1
    return ids


def collect_asset_ids() -> tuple[list[str], str]:
    if SOURCE == "tag":
        tag_id = find_tag_id(TAG_NAME)
        if not tag_id:
            raise RuntimeError(
                f"tag '{TAG_NAME}' not found. "
                f"Use default --source filename or create the tag first."
            )
        payload: dict = {"tagIds": [tag_id]}
        if SINCE:
            payload["createdAfter"] = f"{SINCE}T00:00:00.000Z"
        return search_assets(payload), f"tag:{TAG_NAME}"

    payload = {"originalFileName": FILENAME_PREFIX}
    if SINCE:
        payload["createdAfter"] = f"{SINCE}T00:00:00.000Z"
    return search_assets(payload), f"filename:{FILENAME_PREFIX}*"


def chunks(items: list[str], size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def main() -> int:
    try:
        asset_ids, mode = collect_asset_ids()
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(f"Search mode: {mode}")
    print(f"Found {len(asset_ids)} LINE Bot asset(s)", end="")
    if SINCE:
        print(f" since {SINCE}", end="")
    print()

    if not asset_ids:
        print("Nothing to backfill.")
        return 0

    album_id = find_album_id(ALBUM_NAME)
    if album_id:
        print(f"Album '{ALBUM_NAME}' exists: {album_id}")
    elif DRY_RUN:
        print(f"[dry-run] Would create album '{ALBUM_NAME}'")
        album_id = None
    else:
        created = api("POST", "/albums", {"albumName": ALBUM_NAME})
        album_id = created["id"]
        print(f"Created album '{ALBUM_NAME}': {album_id}")

    if APPLY_TAGS:
        tag_id = find_tag_id(TAG_NAME)
        if DRY_RUN:
            print(f"[dry-run] Would ensure tag '{TAG_NAME}' and attach to assets")
        else:
            tag_id = ensure_tag_id(TAG_NAME)
            for batch in chunks(asset_ids, 100):
                api("PUT", f"/tags/{tag_id}/assets", {"ids": batch})
            print(f"Tagged {len(asset_ids)} asset(s) with '{TAG_NAME}'")

    if DRY_RUN:
        preview = asset_ids[:5]
        print(f"[dry-run] Would add {len(asset_ids)} asset(s) to album '{ALBUM_NAME}'")
        for asset_id in preview:
            print(f"  - {asset_id}")
        if len(asset_ids) > len(preview):
            print(f"  … and {len(asset_ids) - len(preview)} more")
        return 0

    if not album_id:
        print("ERROR: album id missing", file=sys.stderr)
        return 1

    added = 0
    for batch in chunks(asset_ids, 100):
        api("PUT", f"/albums/{album_id}/assets", {"ids": batch})
        added += len(batch)
        print(f"Added to album: {added}/{len(asset_ids)}")

    print(f"Done at {datetime.now(timezone.utc).isoformat()}")
    return 0


sys.exit(main())
PY
