#!/usr/bin/env python3
"""Upload Mac Photos originals to Immich via API with Photos.app capture dates."""

from __future__ import annotations

import json
import mimetypes
import os
import re
import sys
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from photo_sync_lib import MEDIA_EXT, normalize_checksum, sha1_file

try:
    import osxphotos
except ImportError as exc:
    raise SystemExit("osxphotos not found. Install: pip3 install --user osxphotos") from exc

UUID_STEM = re.compile(
    r"^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$",
)


def photos_library_path(originals: Path) -> Path:
    if originals.name == "originals":
        return originals.parent
    if originals.suffix == ".photoslibrary":
        return originals
    raise ValueError(f"cannot derive photoslibrary from {originals}")


def api_base(url: str) -> str:
    base = url.rstrip("/")
    if not base.endswith("/api"):
        base = f"{base}/api"
    return base


def api_json(
    *,
    method: str,
    url: str,
    api_key: str,
    body: dict | None = None,
    timeout: int = 180,
) -> dict | list | None:
    data = None
    headers = {"Accept": "application/json", "x-api-key": api_key}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {detail[:400]}") from exc
    if not raw:
        return None
    return json.loads(raw)


def encode_multipart(fields: dict[str, str], files: dict[str, tuple[str, bytes, str]]) -> tuple[bytes, str]:
    boundary = f"----MacPhotoSync{uuid.uuid4().hex}"
    lines: list[bytes] = []

    for name, value in fields.items():
        lines.append(f"--{boundary}".encode())
        lines.append(f'Content-Disposition: form-data; name="{name}"'.encode())
        lines.append(b"")
        lines.append(value.encode())

    for name, (filename, content, content_type) in files.items():
        lines.append(f"--{boundary}".encode())
        lines.append(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"'.encode(),
        )
        lines.append(f"Content-Type: {content_type}".encode())
        lines.append(b"")
        lines.append(content)

    lines.append(f"--{boundary}--".encode())
    lines.append(b"")
    body = b"\r\n".join(lines)
    return body, boundary


def upload_asset_file(
    *,
    base: str,
    api_key: str,
    path: Path,
    file_created_at: datetime,
    device_asset_id: str,
) -> dict:
    content = path.read_bytes()
    mime, _ = mimetypes.guess_type(path.name)
    content_type = mime or "application/octet-stream"
    if file_created_at.tzinfo is None:
        file_created_at = file_created_at.replace(tzinfo=timezone.utc)
    created_iso = file_created_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    fields = {
        "deviceId": "mac-photo-sync",
        "deviceAssetId": device_asset_id,
        "fileCreatedAt": created_iso,
        "fileModifiedAt": created_iso,
    }
    body, boundary = encode_multipart(
        fields,
        {"assetData": (path.name, content, content_type)},
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
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"upload HTTP {exc.code}: {detail[:400]}") from exc


def find_album_id(base: str, api_key: str, album_name: str) -> str | None:
    albums = api_json(method="GET", url=f"{base}/albums", api_key=api_key)
    if not isinstance(albums, list):
        return None
    for album in albums:
        if album.get("albumName") == album_name:
            return str(album.get("id"))
    return None


def ensure_album(base: str, api_key: str, album_name: str) -> str:
    album_id = find_album_id(base, api_key, album_name)
    if album_id:
        return album_id
    created = api_json(
        method="POST",
        url=f"{base}/albums",
        api_key=api_key,
        body={"albumName": album_name},
    )
    if isinstance(created, dict) and created.get("id"):
        return str(created["id"])
    raise RuntimeError(f"failed to create album: {album_name}")


def add_assets_to_album(base: str, api_key: str, album_id: str, asset_ids: list[str]) -> None:
    if not asset_ids:
        return
    api_json(
        method="PUT",
        url=f"{base}/albums/{album_id}/assets",
        api_key=api_key,
        body={"ids": asset_ids},
    )


def bulk_upload_check(base: str, api_key: str, items: list[dict[str, str]]) -> dict[str, str]:
    """Return checksum hex -> action (accept|reject|duplicate)."""
    payload = api_json(
        method="POST",
        url=f"{base}/assets/bulk-upload-check",
        api_key=api_key,
        body={"assets": items},
    )
    results: dict[str, str] = {}
    if not isinstance(payload, dict):
        return results
    for row in payload.get("results", []):
        key = normalize_checksum(row.get("id")) or normalize_checksum(row.get("checksum"))
        if key:
            results[key] = str(row.get("action", ""))
    return results


def scan_media_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for dirpath, _, filenames in os.walk(root):
        for name in filenames:
            path = Path(dirpath) / name
            if path.suffix.lower() in MEDIA_EXT and not name.startswith("."):
                files.append(path)
    return sorted(files)


def photo_datetime(photo) -> datetime | None:
    if not photo.date:
        return None
    dt = photo.date
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def build_photo_indexes(db: osxphotos.PhotosDB) -> tuple[dict[str, object], dict[str, object]]:
    by_uuid: dict[str, object] = {}
    by_resolved_path: dict[str, object] = {}
    for photo in db.photos():
        by_uuid[photo.uuid.upper()] = photo
        if photo.path:
            by_resolved_path[str(Path(photo.path).expanduser().resolve())] = photo
    return by_uuid, by_resolved_path


def resolve_photo(
    path: Path,
    *,
    by_uuid: dict[str, object],
    by_resolved_path: dict[str, object],
) -> object | None:
    resolved = str(path.resolve())
    hit = by_resolved_path.get(resolved)
    if hit:
        return hit
    stem = path.stem.upper()
    if UUID_STEM.match(stem):
        return by_uuid.get(stem)
    return None


def sync_library_api(
    *,
    url: str,
    api_key: str,
    lib_id: str,
    originals: Path,
    album_name: str,
    concurrency: int,
    dry: bool,
    log,
) -> dict:
    stats = {
        "new_files": 0,
        "duplicates": 0,
        "new_assets": 0,
        "failed_assets": 0,
        "upload_mode": "api",
    }
    base = api_base(url)
    files = scan_media_files(originals)
    if not files:
        return stats

    photos_lib = photos_library_path(originals)
    db = osxphotos.PhotosDB(str(photos_lib))
    by_uuid, by_resolved_path = build_photo_indexes(db)

    pending: list[tuple[Path, str, datetime | None]] = []
    checksum_map: dict[str, Path] = {}
    for path in files:
        try:
            checksum = sha1_file(path)
        except OSError as exc:
            log(f"SKIP hash failed {path}: {exc}")
            stats["failed_assets"] += 1
            continue
        checksum_map[checksum] = path
        photo = resolve_photo(path, by_uuid=by_uuid, by_resolved_path=by_resolved_path)
        capture_dt = photo_datetime(photo) if photo else None
        pending.append((path, checksum, capture_dt))

    to_upload: list[tuple[Path, str, datetime | None]] = []
    batch_size = 200
    for offset in range(0, len(pending), batch_size):
        chunk = pending[offset : offset + batch_size]
        check_items = [{"id": item[1], "checksum": item[1]} for item in chunk]
        actions = bulk_upload_check(base, api_key, check_items)
        for path, checksum, capture_dt in chunk:
            action = actions.get(checksum, "accept")
            if action in {"reject", "duplicate"}:
                stats["duplicates"] += 1
                continue
            stats["new_files"] += 1
            to_upload.append((path, checksum, capture_dt))

    if dry:
        stats["new_assets"] = stats["new_files"]
        stats["dry_run_planned"] = True
        log(f"API dry-run library={lib_id} would upload {stats['new_files']} new file(s)")
        return stats

    album_id = ensure_album(base, api_key, album_name)
    uploaded_ids: list[str] = []

    def _upload(item: tuple[Path, str, datetime | None]) -> tuple[str | None, str | None]:
        path, checksum, capture_dt = item
        device_asset_id = f"{lib_id}:{path.stem}:{checksum[:12]}"
        created = capture_dt or datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        try:
            asset = upload_asset_file(
                base=base,
                api_key=api_key,
                path=path,
                file_created_at=created,
                device_asset_id=device_asset_id,
            )
            asset_id = str(asset.get("id", "")) if isinstance(asset, dict) else ""
            return asset_id or None, None
        except RuntimeError as exc:
            return None, str(exc)

    with ThreadPoolExecutor(max_workers=max(1, concurrency)) as pool:
        futures = {pool.submit(_upload, item): item for item in to_upload}
        for future in as_completed(futures):
            asset_id, err = future.result()
            if asset_id:
                stats["new_assets"] += 1
                uploaded_ids.append(asset_id)
            else:
                stats["failed_assets"] += 1
                path = futures[future][0]
                log(f"UPLOAD FAIL {path}: {err}")

    for offset in range(0, len(uploaded_ids), 100):
        add_assets_to_album(base, api_key, album_id, uploaded_ids[offset : offset + 100])

    log(
        f"API upload library={lib_id} new={stats['new_assets']} "
        f"duplicates={stats['duplicates']} failed={stats['failed_assets']}",
    )
    return stats
