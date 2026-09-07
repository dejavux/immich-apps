#!/usr/bin/env python3
"""Upload poster trial JPGs to Immich and push preview URLs via LINE Messaging API."""

from __future__ import annotations

import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

CONTENT_STUDIO = Path("/Users/light0/DEV/content-studio/samples/labs/pipeline-showcase")

BATCHES = [
    {
        "title": "🏝 濟州島海報 · case 491（禁止過修／不加人）",
        "album": "Poster Trials · 濟州島",
        "files": [
            CONTENT_STUDIO / "jeju-panel-pilot/out/jeju-people-gc-minimal-zine-gpt2-case491.jpg",
        ],
    },
    {
        "title": "🗾 日本旅海報 · case 463（多放家庭照片）",
        "album": "Poster Trials · 日本",
        "files": [
            CONTENT_STUDIO / "japan-panel-pilot/out/japan-people-gc-minimal-zine-gpt2-case463.jpg",
        ],
    },
]


def api_base(url: str) -> str:
    base = url.rstrip("/")
    return base if base.endswith("/api") else f"{base}/api"


def encode_multipart(fields: dict[str, str], files: dict[str, tuple[str, bytes, str]]) -> tuple[bytes, str]:
    boundary = f"----PosterPush{uuid.uuid4().hex}"
    lines: list[bytes] = []
    for name, value in fields.items():
        lines.extend(
            [
                f"--{boundary}".encode(),
                f'Content-Disposition: form-data; name="{name}"'.encode(),
                b"",
                value.encode(),
            ]
        )
    for name, (filename, content, content_type) in files.items():
        lines.extend(
            [
                f"--{boundary}".encode(),
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"'.encode(),
                f"Content-Type: {content_type}".encode(),
                b"",
                content,
            ]
        )
    lines.extend([f"--{boundary}--".encode(), b""])
    return b"\r\n".join(lines), boundary


def upload_poster(base: str, api_key: str, path: Path) -> str:
    content = path.read_bytes()
    mime, _ = mimetypes.guess_type(path.name)
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    device_asset_id = f"poster-{path.stem}-{uuid.uuid4().hex[:8]}"
    body, boundary = encode_multipart(
        {
            "deviceId": "LINE-poster-push",
            "deviceAssetId": device_asset_id,
            "fileCreatedAt": now,
            "fileModifiedAt": now,
        },
        {"assetData": (path.name, content, mime or "image/jpeg")},
    )
    req = urllib.request.Request(
        f"{base}/assets",
        data=body,
        headers={
            "Accept": "application/json",
            "x-api-key": api_key,
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    asset_id = data.get("id")
    if not asset_id:
        raise RuntimeError(f"upload missing id: {data}")
    return str(asset_id)


def ensure_album(base: str, api_key: str, name: str) -> str:
    req = urllib.request.Request(
        f"{base}/albums",
        headers={"x-api-key": api_key, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        albums = json.loads(resp.read())
    for album in albums:
        if album.get("albumName") == name:
            return str(album["id"])
    create = urllib.request.Request(
        f"{base}/albums",
        data=json.dumps({"albumName": name}).encode(),
        headers={
            "x-api-key": api_key,
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(create, timeout=60) as resp:
        created = json.loads(resp.read())
    return str(created["id"])


def add_to_album(base: str, api_key: str, album_id: str, asset_ids: list[str]) -> None:
    req = urllib.request.Request(
        f"{base}/albums/{album_id}/assets",
        data=json.dumps({"ids": asset_ids}).encode(),
        headers={
            "x-api-key": api_key,
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        method="PUT",
    )
    with urllib.request.urlopen(req, timeout=60):
        return


def preview_url(public_bot: str, asset_id: str) -> str:
    return f"{public_bot.rstrip('/')}/media/assets/{asset_id}/preview.jpg"


def line_push(token: str, user_id: str, messages: list[dict]) -> None:
    req = urllib.request.Request(
        "https://api.line.me/v2/bot/message/push",
        data=json.dumps({"to": user_id, "messages": messages}).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            resp.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"LINE push HTTP {exc.code}: {detail[:500]}") from exc


def main() -> int:
    immich_url = os.environ.get("IMMICH_BASE_URL", "https://immich.3q.fi")
    api_key = os.environ.get("IMMICH_API_KEY", "").strip()
    line_token = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN", "").strip()
    public_bot = os.environ.get("LINE_BOT_PUBLIC_URL", "https://immich-bot.3q.fi")
    user_ids_raw = os.environ.get("ADMIN_LINE_USER_IDS", "").strip()

    if not api_key or not line_token:
        print("ERROR: need IMMICH_API_KEY and LINE_CHANNEL_ACCESS_TOKEN", file=sys.stderr)
        return 1
    if not user_ids_raw:
        print("ERROR: need ADMIN_LINE_USER_IDS", file=sys.stderr)
        return 1

    user_ids = [u.strip() for u in user_ids_raw.split(",") if u.strip()]
    base = api_base(immich_url)

    for batch in BATCHES:
        missing = [p for p in batch["files"] if not p.is_file()]
        if missing:
            print(f"ERROR: missing files in {batch['title']}:", file=sys.stderr)
            for p in missing:
                print(f"  - {p}", file=sys.stderr)
            return 1

    for batch in BATCHES:
        album_id = ensure_album(base, api_key, batch["album"])
        asset_ids: list[str] = []
        for path in batch["files"]:
            print(f"upload {path.name}...")
            asset_id = upload_poster(base, api_key, path)
            asset_ids.append(asset_id)
            print(f"  -> {asset_id}")
            time.sleep(1.5)
        add_to_album(base, api_key, album_id, asset_ids)

        messages: list[dict] = [{"type": "text", "text": batch["title"]}]
        for path, asset_id in zip(batch["files"], asset_ids, strict=True):
            url = preview_url(public_bot, asset_id)
            messages.append(
                {
                    "type": "image",
                    "originalContentUrl": url,
                    "previewImageUrl": url,
                }
            )
            print(f"preview {path.name}: {url}")

        for user_id in user_ids:
            print(f"LINE push -> {user_id[:8]}... ({len(messages)} messages)")
            line_push(line_token, user_id, messages)

    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
