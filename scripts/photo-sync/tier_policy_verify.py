#!/usr/bin/env python3
"""Verify tier-policy batch items in source and target Photos libraries."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tier_policy_lib import (
    expand,
    library_by_id,
    load_config,
    photo_signature,
    photos_library_path,
)

try:
    import osxphotos
except ImportError as exc:
    raise SystemExit("osxphotos not found") from exc


def verify_uuid(
    *,
    source_db: osxphotos.PhotosDB,
    _target_db: osxphotos.PhotosDB,
    target_sigs: set[str],
    uuid: str,
) -> dict:
    photo = source_db.get_photo(uuid)
    if photo is None:
        return {
            "uuid": uuid,
            "error": "not found in source library",
        }

    sig = photo_signature(photo)
    in_target = bool(sig and sig in target_sigs)
    return {
        "uuid": uuid,
        "filename": photo.original_filename or photo.filename,
        "date": photo.date.strftime("%Y-%m-%d") if photo.date else None,
        "signature": sig,
        "source_present": True,
        "target_present": in_target,
        "path": photo.path,
        "ismissing": photo.ismissing,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify tier-policy source/target state")
    parser.add_argument("--config", default=str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"))
    parser.add_argument("--uuid", action="append", dest="uuids", help="Photo UUID (repeatable)")
    parser.add_argument("--report", help="tier-run-*.json or tier-plan-*.json with batch items")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config_path = expand(args.config)
    config = load_config(config_path)
    tier = config.get("tier_policy") or {}
    source_cfg = library_by_id(config, tier.get("source_library_id", "icloud-primary"))
    target_cfg = library_by_id(config, tier.get("target_library_id", "local-archive"))
    source_db = osxphotos.PhotosDB(str(photos_library_path(source_cfg)))
    target_db = osxphotos.PhotosDB(str(photos_library_path(target_cfg)))
    target_sigs = {sig for photo in target_db.photos() if (sig := photo_signature(photo))}

    uuids: list[str] = []
    seen: set[str] = set()
    for raw in args.uuids or []:
        if raw not in seen:
            seen.add(raw)
            uuids.append(raw)
    if args.report:
        report = json.loads(expand(args.report).read_text(encoding="utf-8"))
        for item in report.get("batch", {}).get("items", []):
            uid = item["uuid"]
            if uid not in seen:
                seen.add(uid)
                uuids.append(uid)

    if not uuids:
        print("ERROR: pass --uuid and/or --report", file=sys.stderr)
        return 1

    results = [
        verify_uuid(
            source_db=source_db,
            _target_db=target_db,
            target_sigs=target_sigs,
            uuid=uuid,
        )
        for uuid in uuids
    ]
    summary = {
        "source_library": str(photos_library_path(source_cfg)),
        "target_library": str(photos_library_path(target_cfg)),
        "target_photo_count": len(list(target_db.photos())),
        "checked": len(results),
        "in_target": sum(1 for row in results if row.get("target_present")),
        "source_only": sum(1 for row in results if row.get("source_present") and not row.get("target_present")),
        "items": results,
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
