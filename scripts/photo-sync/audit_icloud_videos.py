#!/usr/bin/env python3
"""Audit icloud-primary videos: DB vs disk vs Immich SHA1 overlap."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import yaml

try:
    import osxphotos
except ImportError as exc:
    raise SystemExit("osxphotos not found. pip3 install --user osxphotos") from exc

VIDEO_EXT = {".mov", ".mp4", ".m4v", ".avi", ".mkv"}


def expand(path: str) -> Path:
    return Path(os.path.expanduser(path))


def sha1_file(path: Path, chunk: int = 1024 * 1024) -> str:
    digest = hashlib.sha1()
    with path.open("rb") as fh:
        while True:
            block = fh.read(chunk)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


def bulk_check(url: str, api_key: str, assets: list[dict], batch_size: int) -> tuple[int, int]:
    accept = 0
    reject = 0
    endpoint = f"{url.rstrip('/')}/api/assets/bulk-upload-check"
    for offset in range(0, len(assets), batch_size):
        chunk = assets[offset : offset + batch_size]
        body = json.dumps({"assets": chunk}).encode("utf-8")
        req = urllib.request.Request(
            endpoint,
            data=body,
            headers={"Content-Type": "application/json", "x-api-key": api_key},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            payload = json.loads(resp.read())
        for row in payload.get("results", []):
            if row.get("action") == "reject":
                reject += 1
            else:
                accept += 1
    return accept, reject


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit icloud-primary videos vs Immich")
    parser.add_argument(
        "--config",
        default=os.environ.get(
            "PHOTO_SYNC_CONFIG",
            str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
        ),
    )
    parser.add_argument(
        "--library-path",
        default="~/Pictures/Photos Library.photoslibrary",
        help="icloud-primary .photoslibrary path",
    )
    parser.add_argument(
        "--output",
        help="Write JSON report (default: log_dir/audit/audit-icloud-videos-Timestamp.json)",
    )
    parser.add_argument("--batch-size", type=int, default=100, help="Immich API batch size")
    parser.add_argument(
        "--list-ismissing",
        type=int,
        default=0,
        help="Include first N ismissing videos in report (0=none)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config_path = expand(args.config)
    with config_path.open(encoding="utf-8") as fh:
        config = yaml.safe_load(fh)

    url = os.environ.get("IMMICH_INSTANCE_URL") or config.get("immich", {}).get("instance_url", "")
    api_key = os.environ.get("IMMICH_API_KEY", "")
    if not api_key or not url:
        print("ERROR: IMMICH_API_KEY and IMMICH_INSTANCE_URL required", file=sys.stderr)
        return 1

    photos_lib = expand(args.library_path)
    db = osxphotos.PhotosDB(str(photos_lib))

    videos = []
    for photo in db.photos():
        filename = (photo.original_filename or photo.filename or "").lower()
        if Path(filename).suffix in VIDEO_EXT:
            videos.append(photo)

    local = [p for p in videos if p.path and expand(str(p.path)).is_file()]
    ismissing = [p for p in videos if p.ismissing]
    originals = photos_lib / "originals"
    disk_count = sum(1 for path in originals.rglob("*") if path.is_file() and path.suffix.lower() in VIDEO_EXT)

    assets: list[dict] = []
    hash_errors: list[str] = []
    for photo in local:
        try:
            assets.append({"id": photo.uuid, "checksum": sha1_file(expand(str(photo.path)))})
        except OSError as exc:
            hash_errors.append(f"{photo.uuid}: {exc}")

    not_in_immich = 0
    in_immich = 0
    if assets:
        not_in_immich, in_immich = bulk_check(url, api_key, assets, args.batch_size)

    ismissing_sample = []
    if args.list_ismissing > 0:
        for photo in ismissing[: args.list_ismissing]:
            ismissing_sample.append(
                {
                    "uuid": photo.uuid,
                    "filename": photo.original_filename or photo.filename,
                    "date": photo.date.strftime("%Y-%m-%d") if photo.date else None,
                }
            )

    immich_stats: dict = {}
    try:
        req = urllib.request.Request(
            f"{url.rstrip('/')}/api/server/statistics",
            headers={"x-api-key": api_key},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            immich_stats = json.loads(resp.read())
    except urllib.error.URLError:
        immich_stats = {"error": "could not fetch server statistics"}

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "library": str(photos_lib),
        "videos": {
            "db_by_extension": len(videos),
            "with_local_path": len(local),
            "ismissing_icloud_only": len(ismissing),
            "originals_disk_files": disk_count,
        },
        "immich": {
            "server_statistics": immich_stats,
            "local_path_hashed": len(assets),
            "hash_errors": hash_errors,
            "in_immich_duplicate": in_immich,
            "not_in_immich": not_in_immich,
            "overlap_pct": round(100 * in_immich / len(assets), 1) if assets else None,
        },
        "ismissing_sample": ismissing_sample,
        "notes": [
            "ismissing = iCloud-only; file not on Mac originals/ → immich-sync cannot upload.",
            "overlap uses SHA1 bulk-upload-check (binary exact match).",
        ],
    }

    if args.output:
        out_path = expand(args.output)
    else:
        log_dir = expand(config.get("sync", {}).get("log_dir", "~/Library/Logs/immich-photo-sync"))
        audit_dir = log_dir / "audit"
        audit_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        out_path = audit_dir / f"audit-icloud-videos-{stamp}.json"

    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\nReport: {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
