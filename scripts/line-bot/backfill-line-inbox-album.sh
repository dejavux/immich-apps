#!/usr/bin/env bash
# 將既有 line-import 照片加入 LINE Inbox 相簿（release 前已上傳的補登）
#
# 用法:
#   eval "$(./scripts/dev/load-env-from-op.sh)"
#   ./scripts/line-bot/backfill-line-inbox-album.sh --dry-run
#   ./scripts/line-bot/backfill-line-inbox-album.sh
#   ./scripts/line-bot/backfill-line-inbox-album.sh --since 2026-06-11
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ALBUM_NAME="${IMMICH_LINE_ALBUM_NAME:-LINE Inbox}"
TAG_NAME="${LINE_IMPORT_TAG:-line-import}"
SINCE=""
DRY_RUN=false
PAGE_SIZE=250

while [[ $# -gt 0 ]]; do
  case "$1" in
    --album) ALBUM_NAME="$2"; shift 2 ;;
    --since) SINCE="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help)
      echo "Usage: $0 [--album NAME] [--since YYYY-MM-DD] [--dry-run]"
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

export ALBUM_NAME TAG_NAME SINCE DRY_RUN PAGE_SIZE IMMICH_INSTANCE_URL IMMICH_API_KEY
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
SINCE = os.environ.get("SINCE", "")
DRY_RUN = os.environ.get("DRY_RUN") == "true"
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


def find_tag_id(name: str) -> str | None:
    tags = api("GET", "/tags")
    for tag in tags:
        if tag.get("name") == name:
            return tag["id"]
    return None


def find_album_id(name: str) -> str | None:
    albums = api("GET", "/albums")
    for album in albums:
        if album.get("albumName") == name:
            return album["id"]
    return None


def search_line_import_assets(tag_id: str) -> list[str]:
    ids: list[str] = []
    page = 1
    while True:
        payload: dict = {"tagIds": [tag_id], "size": PAGE_SIZE, "page": page}
        if SINCE:
            payload["createdAfter"] = f"{SINCE}T00:00:00.000Z"
        result = api("POST", "/search/metadata", payload)
        items = (result or {}).get("assets", {}).get("items", [])
        if not items:
            break
        ids.extend(item["id"] for item in items if item.get("id"))
        if len(items) < PAGE_SIZE:
            break
        page += 1
    return ids


def chunks(items: list[str], size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def main() -> int:
    tag_id = find_tag_id(TAG_NAME)
    if not tag_id:
        print(f"ERROR: tag '{TAG_NAME}' not found — no LINE uploads?", file=sys.stderr)
        return 1

    asset_ids = search_line_import_assets(tag_id)
    print(f"Found {len(asset_ids)} asset(s) with tag '{TAG_NAME}'", end="")
    if SINCE:
        print(f" since {SINCE}", end="")
    print()

    if not asset_ids:
        return 0

    album_id = find_album_id(ALBUM_NAME)
    if album_id:
        print(f"Album '{ALBUM_NAME}' exists: {album_id}")
    elif DRY_RUN:
        print(f"[dry-run] Would create album '{ALBUM_NAME}'")
        album_id = "(new)"
    else:
        created = api("POST", "/albums", {"albumName": ALBUM_NAME})
        album_id = created["id"]
        print(f"Created album '{ALBUM_NAME}': {album_id}")

    if DRY_RUN:
        preview = asset_ids[:5]
        print(f"[dry-run] Would add {len(asset_ids)} asset(s) to album")
        for asset_id in preview:
            print(f"  - {asset_id}")
        if len(asset_ids) > len(preview):
            print(f"  … and {len(asset_ids) - len(preview)} more")
        return 0

    added = 0
    for batch in chunks(asset_ids, 100):
        api("PUT", f"/albums/{album_id}/assets", {"ids": batch})
        added += len(batch)
        print(f"Added {added}/{len(asset_ids)}")

    print(f"Done at {datetime.now(timezone.utc).isoformat()}")
    return 0


sys.exit(main())
PY
