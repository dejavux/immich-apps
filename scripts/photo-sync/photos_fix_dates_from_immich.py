#!/usr/bin/env python3
"""Fix Mac Photos capture dates in a library using Immich localDateTime (checksum match)."""

from __future__ import annotations

import argparse
import json
import sqlite3
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))

from immich_audit_dates import (
    api_request,
    default_timezone,
    immich_api_base,
    immich_api_key,
    is_tier_import_window,
    load_immich_assets_by_checksum,
    parse_iso,
)
from photo_sync_lib import expand, load_config, log_dir, normalize_checksum, photos_library_path, sha1_file
from tier_policy_lib import library_by_id

try:
    import osxphotos
    import photoscript
    from photoscript.exceptions import AppleScriptError
except ImportError as exc:
    raise SystemExit("osxphotos/photoscript required") from exc

# Bulk wrong dates seen after tier import into local-archive.
SUSPICIOUS_PHOTOS_DATES = frozenset(
    {
        "2023-03-02",
        "2023-07-26",
        "2023-07-27",
        "2023-07-28",
    }
)

# Photos import batches stamped capture date to import day.
IMPORT_RECOVERY_DATES = frozenset(
    {
        "2026-06-14",
        "2026-06-15",
        "2026-06-16",
        "2026-06-17",
        "2026-06-18",
    }
)


def should_fix_photos_date(
    photos_dt: datetime,
    immich_dt: datetime,
    *,
    tz: ZoneInfo,
    mode: str,
) -> bool:
    photos_local = photos_dt.astimezone(tz)
    immich_local = immich_dt.astimezone(tz)
    if abs((photos_local - immich_local).total_seconds()) < 60:
        return False
    if mode == "import-mismatch":
        if is_tier_import_window(immich_local):
            return False
        return True
    if is_tier_import_window(photos_local) and not is_tier_import_window(immich_local):
        return True
    if photos_local.strftime("%Y-%m-%d") in SUSPICIOUS_PHOTOS_DATES:
        return True
    if photos_local.strftime("%Y-%m-%d") in IMPORT_RECOVERY_DATES:
        if photos_local.date() != immich_local.date():
            return True
    return False


def ensure_photos_open(target_lib: Path) -> None:
    subprocess.run(["open", "-a", "Photos", str(target_lib)], check=False)
    time.sleep(5)


def apply_photo_date(uuid: str, expected_naive: datetime, *, retries: int = 4) -> None:
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            ps_photo = photoscript.Photo(uuid)
            ps_photo.date = expected_naive
            return
        except (ValueError, OSError, AppleScriptError) as exc:
            last_exc = exc
            if attempt + 1 < retries:
                time.sleep(2 * (attempt + 1))
    if last_exc is not None:
        raise last_exc


def load_immich_search_index(
    config: dict,
    *,
    taken_after: str = "2025-05-31T00:00:00.000Z",
    taken_before: str = "2026-06-16T23:59:59.999Z",
) -> dict[str, dict]:
    base = immich_api_base(config)
    api_key = immich_api_key()
    by_checksum: dict[str, dict] = {}
    page = 1
    while True:
        body = {
            "takenAfter": taken_after,
            "takenBefore": taken_before,
            "size": 500,
            "page": page,
        }
        resp = api_request(method="POST", url=f"{base}/search/metadata", api_key=api_key, body=body)
        items = resp.get("assets", {}).get("items", []) if isinstance(resp, dict) else []
        if not items:
            break
        for asset in items:
            if asset.get("isTrashed"):
                continue
            checksum = normalize_checksum(asset.get("checksum"))
            if checksum:
                by_checksum[checksum] = asset
        if len(items) < 500:
            break
        page += 1
    return by_checksum


def immich_index_for_library(config: dict, library_id: str) -> dict[str, dict]:
    by_checksum = load_immich_assets_by_checksum(config)
    if library_id == "icloud-primary":
        by_checksum.update(load_immich_search_index(config))
    return by_checksum


def personal_uuids(photos_lib: Path) -> set[str]:
    db_path = photos_lib / "database" / "Photos.sqlite"
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    rows = conn.execute(
        """
        SELECT ZUUID FROM ZASSET
        WHERE ZTRASHEDSTATE=0 AND ZVISIBILITYSTATE=0 AND ZCOLLECTIONSHARE IS NULL
        """
    ).fetchall()
    conn.close()
    return {str(row[0]) for row in rows}


def collect_fixes(config: dict, *, library_id: str, mode: str) -> tuple[list[dict], int]:
    immich_by_checksum = immich_index_for_library(config, library_id)
    lib_cfg = library_by_id(config, library_id)
    photos_lib = photos_library_path(lib_cfg)
    db = osxphotos.PhotosDB(str(photos_lib))
    tz_name = default_timezone(config)
    tz = ZoneInfo(tz_name)
    personal_only = library_id == "icloud-primary"
    allowed = personal_uuids(photos_lib) if personal_only else None

    fixes: list[dict] = []
    checked = 0
    for photo in db.photos():
        if allowed is not None and photo.uuid not in allowed:
            continue
        path_str = photo.path
        if not path_str:
            continue
        path = expand(str(path_str))
        if not path.is_file():
            continue
        try:
            checksum = sha1_file(path)
        except OSError:
            continue
        asset = immich_by_checksum.get(checksum)
        if not asset:
            continue
        checked += 1
        photos_dt = photo.date
        immich_dt = parse_iso(asset.get("localDateTime") or asset.get("fileCreatedAt"))
        if not photos_dt or not immich_dt:
            continue
        if photos_dt.tzinfo is None:
            photos_dt = photos_dt.replace(tzinfo=tz)
        immich_local = immich_dt.astimezone(tz)
        if not should_fix_photos_date(photos_dt, immich_dt, tz=tz, mode=mode):
            continue
        fixes.append(
            {
                "uuid": photo.uuid,
                "filename": photo.original_filename or photo.filename,
                "was": photos_dt.isoformat(),
                "expected": immich_local.isoformat(),
                "asset_id": str(asset.get("id")),
            }
        )
    return fixes, checked


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        default=str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
    )
    parser.add_argument("--library-id", default="local-archive")
    parser.add_argument(
        "--mode",
        choices=("suspicious", "import-mismatch"),
        default="suspicious",
        help="suspicious=local tier dates; import-mismatch=any Immich delta>=1d (icloud recovery)",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.apply and args.dry_run:
        print("ERROR: use either --dry-run or --apply", file=sys.stderr)
        return 1

    config = load_config(expand(args.config))
    lib_cfg = library_by_id(config, args.library_id)
    target_lib = photos_library_path(lib_cfg)

    fixes, checked = collect_fixes(config, library_id=args.library_id, mode=args.mode)
    print(json.dumps({"checked": checked, "to_fix": len(fixes)}, indent=2))
    for row in fixes[:20]:
        print(f"- {row['filename']}  {row['was'][:10]} → {row['expected'][:10]}")

    if args.dry_run or not args.apply:
        return 0

    ensure_photos_open(target_lib)
    fixed = failed = 0
    for row in fixes:
        expected = datetime.fromisoformat(row["expected"])
        expected_naive = expected.replace(tzinfo=None) if expected.tzinfo else expected
        try:
            apply_photo_date(row["uuid"], expected_naive)
            fixed += 1
        except (ValueError, OSError, AppleScriptError) as exc:
            failed += 1
            print(f"FAIL {row['uuid']}: {exc}", file=sys.stderr)

    report = {
        "library_id": args.library_id,
        "checked": checked,
        "to_fix": len(fixes),
        "fixed": fixed,
        "failed": failed,
        "sample": fixes[:30],
    }
    out = log_dir(config) / f"fix-dates-from-immich-{args.library_id}.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"fixed": fixed, "failed": failed, "report": str(out)}, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
