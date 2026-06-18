#!/usr/bin/env python3
"""Download Immich assets in a date range and import into icloud-primary Photos library."""

from __future__ import annotations

import argparse
import json
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from immich_audit_dates import immich_api_base, immich_api_key
from photo_sync_lib import expand, load_config, normalize_checksum, photos_library_path, sha1_file
from tier_policy_lib import library_by_id

try:
    import osxphotos
except ImportError as exc:
    raise SystemExit("osxphotos required: pip3 install --user osxphotos") from exc

RECOVERY_ROOT = expand("~/Library/Logs/immich-photo-sync/recovery")


def api_request(*, method: str, url: str, api_key: str, body: dict | None = None, timeout: int = 180):
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


def search_assets(base: str, api_key: str, *, taken_after: str, taken_before: str) -> list[dict]:
    page = 1
    items: list[dict] = []
    while True:
        body = {
            "takenAfter": taken_after,
            "takenBefore": taken_before,
            "size": 500,
            "page": page,
        }
        resp = api_request(method="POST", url=f"{base}/search/metadata", api_key=api_key, body=body)
        batch = resp.get("assets", {}).get("items", []) if isinstance(resp, dict) else []
        if not batch:
            break
        items.extend(batch)
        if len(batch) < 500:
            break
        page += 1
    return items


def dest_filename(asset: dict) -> str:
    """Immich UUID.jpg assets are often videos; use type/mime for a valid extension."""
    asset_id = str(asset.get("id") or "asset")
    raw_name = asset.get("originalFileName") or asset_id
    stem = Path(raw_name).stem or asset_id
    ext = Path(raw_name).suffix.lower()
    asset_type = str(asset.get("type") or "").upper()
    mime = str(asset.get("originalMimeType") or "").lower()

    if asset_type == "VIDEO" or mime.startswith("video/"):
        if ext in {"", ".jpg", ".jpeg", ".heic", ".png"}:
            if "mp4" in mime or ext == ".mp4":
                ext = ".mp4"
            else:
                ext = ".mov"
    elif not ext:
        if mime.endswith("heic") or "heif" in mime:
            ext = ".heic"
        elif mime.endswith("png"):
            ext = ".png"
        else:
            ext = ".jpg"
    return f"{stem}{ext}"


def download_original(base: str, api_key: str, asset: dict, dest_dir: Path) -> Path | None:
    asset_id = asset.get("id")
    if not asset_id:
        return None
    safe_name = dest_filename(asset)
    dest = dest_dir / safe_name
    if dest.is_file() and dest.stat().st_size > 0:
        return dest
    url = f"{base}/assets/{asset_id}/original"
    req = urllib.request.Request(url, headers={"x-api-key": api_key})
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = resp.read()
    except urllib.error.HTTPError as exc:
        print(f"SKIP download {asset_id}: HTTP {exc.code}", file=sys.stderr)
        return None
    if not data:
        return None
    # avoid collisions
    if dest.is_file():
        stem = dest.stem
        suffix = dest.suffix
        dest = dest_dir / f"{stem}-{asset_id[:8]}{suffix}"
    dest.write_bytes(data)
    return dest


def personal_visible_checksums(photos_library: Path) -> set[str]:
    """SHA1 checksums for icloud-primary personal visible assets (not shared album)."""
    db_path = photos_library / "database" / "Photos.sqlite"
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    uuids = [
        row[0]
        for row in conn.execute(
            """
            SELECT ZUUID FROM ZASSET
            WHERE ZTRASHEDSTATE=0 AND ZVISIBILITYSTATE=0 AND ZCOLLECTIONSHARE IS NULL
            """
        )
    ]
    conn.close()

    db = osxphotos.PhotosDB(str(photos_library))
    checksums: set[str] = set()
    for uuid in uuids:
        photo = db.get_photo(uuid)
        if photo is None or not photo.path:
            continue
        path = expand(str(photo.path))
        if not path.is_file():
            continue
        try:
            checksum = normalize_checksum(sha1_file(path))
        except OSError:
            continue
        if checksum:
            checksums.add(checksum)
    return checksums


def build_icloud_checksum_index(photos_library: Path) -> set[str]:
    originals = photos_library / "originals"
    checksums: set[str] = set()
    if not originals.is_dir():
        return checksums
    for path in originals.rglob("*"):
        if not path.is_file():
            continue
        if path.name.startswith("."):
            continue
        try:
            checksums.add(sha1_file(path))
        except OSError:
            continue
    return checksums


def quit_photos() -> None:
    subprocess.run(
        ["osascript", "-e", 'tell application "Photos" to quit saving no'],
        capture_output=True,
        check=False,
    )
    for _ in range(15):
        proc = subprocess.run(["pgrep", "-x", "Photos"], capture_output=True, check=False)
        if proc.returncode != 0:
            return
        time.sleep(1)
    subprocess.run(["killall", "Photos"], capture_output=True, check=False)
    time.sleep(2)


def open_icloud_library(photos_library: Path) -> None:
    subprocess.run(["open", "-a", "Photos", str(photos_library)], check=False)
    time.sleep(6)


def import_staging(staging: Path, photos_library: Path, *, resume: bool, skip_dups: bool) -> int:
    args = [
        "osxphotos",
        "import",
        str(staging),
        "--library",
        str(photos_library),
        "--walk",
        "--exiftool",
        "--verbose",
        "--report",
        str(staging / "import-report.csv"),
    ]
    if skip_dups:
        args.append("--skip-dups")
    if resume:
        args.append("--resume")
    proc = subprocess.run(args, capture_output=True, text=True, check=False)
    if proc.stdout:
        print(proc.stdout[-3000:])
    if proc.stderr:
        print(proc.stderr[-2000:], file=sys.stderr)
    return proc.returncode


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        default=str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
    )
    parser.add_argument("--library-id", default="icloud-primary")
    parser.add_argument("--from-date", default="2025-06-01")
    parser.add_argument(
        "--to-date",
        default="",
        help="Inclusive end date YYYY-MM-DD (default: today UTC; use 2026-06-16 for recovery window)",
    )
    parser.add_argument(
        "--missing-only",
        action="store_true",
        help="Only download/import Immich assets not in icloud personal library (ignore originals/ skip)",
    )
    parser.add_argument(
        "--staging",
        default=str(RECOVERY_ROOT / "immich-to-icloud-staging"),
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--download-only", action="store_true")
    parser.add_argument("--import-only", action="store_true")
    parser.add_argument("--resume-import", action="store_true")
    parser.add_argument("--skip-dups", action="store_true", help="Skip if already in Photos library")
    parser.add_argument("--limit", type=int, default=0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = load_config(expand(args.config))
    base = immich_api_base(config)
    api_key = immich_api_key()
    photos_lib = photos_library_path(library_by_id(config, args.library_id))

    if args.missing_only and args.from_date == "2025-06-01":
        args.from_date = "2025-05-31"
    if args.missing_only and not args.to_date:
        args.to_date = "2026-06-16"
    if args.missing_only and args.staging == str(RECOVERY_ROOT / "immich-to-icloud-staging"):
        args.staging = str(RECOVERY_ROOT / "immich-missing-staging")

    taken_after = f"{args.from_date}T00:00:00.000Z"
    if args.to_date:
        taken_before = f"{args.to_date}T23:59:59.999Z"
    else:
        taken_before = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    staging = expand(args.staging)
    staging.mkdir(parents=True, exist_ok=True)
    manifest_path = staging / "manifest.json"

    if not args.import_only:
        assets = search_assets(base, api_key, taken_after=taken_after, taken_before=taken_before)
        assets = [a for a in assets if not a.get("isTrashed")]
        if args.limit:
            assets = assets[: args.limit]
        print(f"Immich assets {args.from_date}..{args.to_date or 'now'}: {len(assets)} (non-trashed)", flush=True)

        if args.missing_only:
            existing = personal_visible_checksums(photos_lib)
            print(f"icloud personal checksums: {len(existing)}", flush=True)
        else:
            existing = {normalize_checksum(c) for c in build_icloud_checksum_index(photos_lib)}

        plan: list[dict] = []
        for asset in assets:
            checksum = normalize_checksum(asset.get("checksum"))
            if args.missing_only:
                if checksum and checksum in existing:
                    continue
            elif checksum and checksum in existing:
                continue
            plan.append(asset)
        skip_label = "not in icloud personal" if args.missing_only else "skip existing checksum in icloud originals"
        print(f"to_download ({skip_label}): {len(plan)}", flush=True)

        if args.dry_run:
            for row in plan[:15]:
                print(f"  {row.get('originalFileName')}  {str(row.get('localDateTime', ''))[:10]}  {row.get('type')}")
            return 0

        downloaded: list[dict] = []
        for idx, asset in enumerate(plan, start=1):
            if idx % 25 == 0 or idx == len(plan):
                print(f"download {idx}/{len(plan)}", flush=True)
            path = download_original(base, api_key, asset, staging)
            if path is None:
                continue
            downloaded.append(
                {
                    "id": asset.get("id"),
                    "filename": asset.get("originalFileName"),
                    "localDateTime": asset.get("localDateTime"),
                    "checksum": normalize_checksum(asset.get("checksum")),
                    "type": asset.get("type"),
                    "path": str(path),
                }
            )
        manifest = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": "missing-only" if args.missing_only else "range",
            "from_date": args.from_date,
            "to_date": args.to_date or "now",
            "downloaded": downloaded,
        }
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Downloaded {len(downloaded)} → {staging}", flush=True)
        if args.download_only:
            return 0

    if args.dry_run:
        return 0

    if not any(p for p in staging.iterdir() if not p.name.startswith(".")):
        print("ERROR: staging empty; run download first", file=sys.stderr)
        return 1

    open_icloud_library(photos_lib)
    rc = import_staging(staging, photos_lib, resume=args.resume_import, skip_dups=args.skip_dups)
    print(f"osxphotos import exit={rc}")

    if args.missing_only and rc == 0:
        after = personal_visible_checksums(photos_lib)
        print(f"icloud personal checksums after import: {len(after)}", flush=True)
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
