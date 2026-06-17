#!/usr/bin/env python3
"""Diagnose Immich asset mac_ref / Photos library state for reconcile debugging."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

try:
    import osxphotos
except ImportError:
    osxphotos = None  # type: ignore[assignment,misc]

sys.path.insert(0, str(Path(__file__).resolve().parent))

from immich_reconcile import api_request, immich_api_base, immich_api_key
from photo_sync_lib import (
    build_mac_refcount,
    expand,
    load_config,
    normalize_checksum,
    photos_db_tracked_uuids,
    photos_library_path,
    reconcile_settings,
)

MAC_UPLOAD_FILENAME_RE = re.compile(
    r"^([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})",
    re.IGNORECASE,
)


def parse_uuid_from_asset(asset: dict) -> str | None:
    name = asset.get("originalFileName") or ""
    match = MAC_UPLOAD_FILENAME_RE.match(name)
    if match:
        return match.group(1).upper()
    return None


def osxphotos_lookup(library_path: Path, uuid: str) -> dict | None:
    if osxphotos is None:
        return {"error": "osxphotos not installed"}
    db = osxphotos.PhotosDB(str(library_path))
    photo = db.get_photo(uuid)
    if photo is None:
        return None
    return {
        "uuid": photo.uuid,
        "original_filename": photo.original_filename or photo.filename,
        "date": photo.date.isoformat() if photo.date else None,
        "intrash": photo.intrash,
    }


def diagnose_asset(
    *,
    asset_id: str,
    config: dict,
    mac_refcount: dict[str, int],
    libraries_by_checksum: dict[str, list[str]],
    reconcile: dict,
) -> dict:
    base = immich_api_base(config)
    api_key = immich_api_key()
    asset = api_request(method="GET", url=f"{base}/assets/{asset_id}", api_key=api_key)
    if not isinstance(asset, dict):
        raise SystemExit(f"unexpected asset response for {asset_id}")

    checksum_hex = normalize_checksum(asset.get("checksum"))
    filename = asset.get("originalFileName") or ""
    uuid = parse_uuid_from_asset(asset)
    photos_db_libs = set(reconcile.get("photos_db_libraries") or [])

    mac_ref = mac_refcount.get(checksum_hex or "", 0) if checksum_hex else 0
    on_libraries = libraries_by_checksum.get(checksum_hex or "", [])

    photos_state: dict[str, object] = {}
    for lib in config.get("libraries", []):
        lib_id = lib.get("id")
        if not lib_id or not lib.get("enabled", True):
            continue
        lib_path = photos_library_path(lib)
        entry: dict[str, object] = {"photoslibrary": str(lib_path)}
        if uuid:
            lookup = osxphotos_lookup(lib_path, uuid)
            entry["osxphotos"] = lookup
            if lib_id in photos_db_libs:
                tracked = uuid.upper() in photos_db_tracked_uuids(lib_path)
                entry["photos_db_tracked"] = tracked
        photos_state[lib_id] = entry

    orphan_candidate = bool(checksum_hex) and mac_ref == 0
    return {
        "asset_id": asset_id,
        "originalFileName": filename,
        "fileCreatedAt": asset.get("fileCreatedAt"),
        "checksum_hex": checksum_hex,
        "photos_uuid": uuid,
        "mac_refcount": mac_ref,
        "mac_libraries": on_libraries,
        "orphan_candidate": orphan_candidate,
        "photos": photos_state,
        "reconcile_action": "would_trash" if orphan_candidate else "skip_still_on_mac",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Diagnose Immich asset reconcile / Mac state")
    parser.add_argument("asset_ids", nargs="+", help="Immich asset UUID(s)")
    parser.add_argument(
        "--config",
        default=os.environ.get(
            "PHOTO_SYNC_CONFIG",
            str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
        ),
    )
    parser.add_argument("--json", action="store_true", help="Print JSON only")
    args = parser.parse_args()

    config_path = expand(args.config)
    if not config_path.is_file():
        print(f"ERROR: config not found: {config_path}", file=sys.stderr)
        return 1

    config = load_config(config_path)
    reconcile = reconcile_settings(config)
    mac_refcount, libraries_by_checksum = build_mac_refcount(config, reconcile=reconcile)

    reports = []
    for asset_id in args.asset_ids:
        report = diagnose_asset(
            asset_id=asset_id,
            config=config,
            mac_refcount=mac_refcount,
            libraries_by_checksum=libraries_by_checksum,
            reconcile=reconcile,
        )
        reports.append(report)

    if args.json:
        print(json.dumps(reports if len(reports) > 1 else reports[0], indent=2, ensure_ascii=False))
        return 0

    for report in reports:
        print(f"=== Immich asset {report['asset_id']} ===")
        print(f"  file: {report['originalFileName']}")
        print(f"  created: {report['fileCreatedAt']}")
        print(f"  checksum: {report['checksum_hex']}")
        print(f"  photos_uuid: {report['photos_uuid']}")
        print(f"  mac_refcount: {report['mac_refcount']}  libraries: {report['mac_libraries']}")
        print(f"  reconcile: {report['reconcile_action']}")
        for lib_id, state in report["photos"].items():
            print(f"  [{lib_id}]")
            ox = state.get("osxphotos")
            if ox is None:
                print("    osxphotos: not found")
            elif isinstance(ox, dict) and ox.get("error"):
                print(f"    osxphotos: {ox['error']}")
            elif isinstance(ox, dict):
                print(f"    osxphotos: {ox.get('original_filename')} intrash={ox.get('intrash')} date={ox.get('date')}")
            if "photos_db_tracked" in state:
                print(f"    photos_db_tracked: {state['photos_db_tracked']}")
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
