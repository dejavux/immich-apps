#!/usr/bin/env python3
"""Reconcile Immich Mac Photos (iCloud) album vs icloud-primary personal library."""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from immich_api_upload import (
    add_assets_to_album,
    api_json,
    find_album_id,
    photo_datetime,
    upload_asset_file,
)
from immich_audit_dates import immich_api_base, immich_api_key
from immich_import_to_icloud import personal_visible_checksums, search_assets
from photo_sync_lib import expand, load_config, log_dir, normalize_checksum, sha1_file
from tier_policy_lib import library_by_id, photos_library_path

try:
    import osxphotos
except ImportError as exc:
    raise SystemExit("osxphotos required") from exc

ICLOUD_ALBUM_NAME = "Mac Photos (iCloud)"


def album_assets(base: str, api_key: str, album_id: str) -> list[dict]:
    data = api_json(method="GET", url=f"{base}/albums/{album_id}", api_key=api_key)
    if not isinstance(data, dict):
        return []
    return [a for a in data.get("assets", []) if not a.get("isTrashed")]


def remove_assets_from_album(base: str, api_key: str, album_id: str, asset_ids: list[str]) -> None:
    for offset in range(0, len(asset_ids), 100):
        batch = asset_ids[offset : offset + 100]
        api_json(
            method="DELETE",
            url=f"{base}/albums/{album_id}/assets",
            api_key=api_key,
            body={"ids": batch},
        )


def bulk_upload_check_detail(base: str, api_key: str, checksums: list[str]) -> dict[str, dict]:
    by_checksum: dict[str, dict] = {}
    for offset in range(0, len(checksums), 200):
        chunk = checksums[offset : offset + 200]
        items = [{"id": cs, "checksum": cs} for cs in chunk]
        payload = api_json(
            method="POST",
            url=f"{base}/assets/bulk-upload-check",
            api_key=api_key,
            body={"assets": items},
        )
        if not isinstance(payload, dict):
            continue
        for row in payload.get("results", []):
            key = normalize_checksum(row.get("id"))
            if key:
                by_checksum[key] = row
    return by_checksum


def mac_personal_rows(photos_lib: Path) -> dict[str, dict]:
    db_path = photos_lib / "database" / "Photos.sqlite"
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

    db = osxphotos.PhotosDB(str(photos_lib))
    rows: dict[str, dict] = {}
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
        if not checksum:
            continue
        rows[checksum] = {
            "uuid": photo.uuid,
            "path": path,
            "filename": photo.original_filename or path.name,
            "date": photo_datetime(photo),
        }
    return rows


def restore_trashed_assets(base: str, api_key: str, asset_ids: list[str]) -> None:
    for offset in range(0, len(asset_ids), 100):
        api_json(
            method="POST",
            url=f"{base}/trash/restore/assets",
            api_key=api_key,
            body={"ids": asset_ids[offset : offset + 100]},
        )


def align_mac_only_immich(
    *,
    base: str,
    api_key: str,
    album_id: str,
    photos_lib: Path,
    lib_id: str,
    dry: bool,
) -> dict:
    active = immich_checksum_index(base, api_key)
    personal = mac_personal_rows(photos_lib)
    missing_cs = sorted(set(personal) - set(active))
    if not missing_cs:
        return {"missing_mac_only": 0, "restored": 0, "uploaded": 0, "added_to_album": 0}

    checks = bulk_upload_check_detail(base, api_key, missing_cs)
    restore_ids: list[str] = []
    upload_rows: list[tuple[Path, str, datetime | None]] = []
    unresolved: list[str] = []

    for cs in missing_cs:
        row = checks.get(cs, {})
        action = str(row.get("action", ""))
        if action == "reject" and row.get("isTrashed") and row.get("assetId"):
            restore_ids.append(str(row["assetId"]))
            continue
        if action == "accept":
            meta = personal[cs]
            upload_rows.append((meta["path"], cs, meta["date"]))
            continue
        unresolved.append(cs)

    plan = {
        "missing_mac_only": len(missing_cs),
        "to_restore_from_trash": len(restore_ids),
        "to_upload": len(upload_rows),
        "unresolved": len(unresolved),
        "dry_run": dry,
    }
    print(json.dumps(plan, indent=2, ensure_ascii=False))
    if dry:
        return plan

    if restore_ids:
        print(f"Restoring {len(restore_ids)} trashed Immich asset(s)…", flush=True)
        restore_trashed_assets(base, api_key, restore_ids)

    uploaded_ids: list[str] = []
    for path, checksum, capture_dt in upload_rows:
        created = capture_dt or datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        device_asset_id = f"{lib_id}:{path.stem}:{checksum[:12]}"
        asset = upload_asset_file(
            base=base,
            api_key=api_key,
            path=path,
            file_created_at=created,
            device_asset_id=device_asset_id,
        )
        asset_id = str(asset.get("id", "")) if isinstance(asset, dict) else ""
        if asset_id:
            uploaded_ids.append(asset_id)
        else:
            unresolved.append(checksum)

    add_ids = list(restore_ids) + uploaded_ids
    if add_ids:
        print(f"Adding {len(add_ids)} asset(s) to {ICLOUD_ALBUM_NAME}…", flush=True)
        for offset in range(0, len(add_ids), 100):
            add_assets_to_album(base, api_key, album_id, add_ids[offset : offset + 100])

    plan.update(
        {
            "restored": len(restore_ids),
            "uploaded": len(uploaded_ids),
            "added_to_album": len(add_ids),
            "unresolved": len(unresolved),
        },
    )
    return plan


def immich_checksum_index(base: str, api_key: str) -> dict[str, str]:
    by_checksum: dict[str, str] = {}
    for asset in search_assets(
        base,
        api_key,
        taken_after="1970-01-01T00:00:00.000Z",
        taken_before="2030-12-31T23:59:59.999Z",
    ):
        if asset.get("isTrashed"):
            continue
        checksum = normalize_checksum(asset.get("checksum"))
        asset_id = asset.get("id")
        if checksum and asset_id:
            by_checksum[checksum] = str(asset_id)
    return by_checksum


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        default=str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--remove-stale", action="store_true", help="B: drop album rows not on Mac")
    parser.add_argument("--add-missing", action="store_true", help="A: add Mac personal rows to album")
    parser.add_argument(
        "--align-mac-only",
        action="store_true",
        help="Restore trashed / upload Mac-only assets missing from active Immich",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.apply and args.dry_run:
        print("ERROR: use either --dry-run or --apply", file=sys.stderr)
        return 1
    album_only = args.remove_stale or args.add_missing
    if not album_only and not args.align_mac_only:
        args.remove_stale = True
        args.add_missing = True
        album_only = True

    config = load_config(expand(args.config))
    base = immich_api_base(config)
    api_key = immich_api_key()
    photos_lib = photos_library_path(library_by_id(config, "icloud-primary"))
    album_id = find_album_id(base, api_key, ICLOUD_ALBUM_NAME)
    if not album_id:
        print(f"ERROR: Immich album not found: {ICLOUD_ALBUM_NAME}", file=sys.stderr)
        return 1

    dry = args.dry_run or not args.apply
    if args.align_mac_only:
        align_report = align_mac_only_immich(
            base=base,
            api_key=api_key,
            album_id=album_id,
            photos_lib=photos_lib,
            lib_id="icloud-primary",
            dry=dry,
        )
        if not album_only:
            out = log_dir(config) / "recovery" / "immich-icloud-align-mac-only.json"
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(align_report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print(json.dumps({"report": str(out)}, indent=2))
            return 0

    mac_checksums = personal_visible_checksums(photos_lib)
    in_album = album_assets(base, api_key, album_id)
    album_by_cs: dict[str, dict] = {}
    for asset in in_album:
        cs = normalize_checksum(asset.get("checksum"))
        if cs:
            album_by_cs[cs] = asset

    stale_ids: list[str] = []
    for cs, asset in album_by_cs.items():
        if cs not in mac_checksums:
            stale_ids.append(str(asset["id"]))

    missing_cs = sorted(mac_checksums - set(album_by_cs))
    immich_index = immich_checksum_index(base, api_key) if missing_cs else {}
    add_ids: list[str] = []
    add_missing_immich: list[str] = []
    for cs in missing_cs:
        asset_id = immich_index.get(cs)
        if asset_id:
            add_ids.append(asset_id)
        else:
            add_missing_immich.append(cs)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "album": ICLOUD_ALBUM_NAME,
        "album_id": album_id,
        "mac_personal_checksums": len(mac_checksums),
        "album_assets_before": len(in_album),
        "stale_to_remove": len(stale_ids),
        "missing_on_mac_to_add": len(add_ids),
        "mac_not_in_immich_at_all": len(add_missing_immich),
        "dry_run": dry,
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))

    if dry:
        return 0

    if args.remove_stale and stale_ids:
        print(f"Removing {len(stale_ids)} stale assets from album…", flush=True)
        remove_assets_from_album(base, api_key, album_id, stale_ids)

    if args.add_missing and add_ids:
        print(f"Adding {len(add_ids)} Mac assets to album…", flush=True)
        for offset in range(0, len(add_ids), 100):
            add_assets_to_album(base, api_key, album_id, add_ids[offset : offset + 100])

    after = album_assets(base, api_key, album_id)
    report["album_assets_after"] = len(after)
    out = log_dir(config) / "recovery" / "immich-icloud-album-reconcile.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"album_assets_after": len(after), "report": str(out)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
