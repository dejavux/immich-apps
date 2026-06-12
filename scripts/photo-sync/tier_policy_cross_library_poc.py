#!/usr/bin/env python3
"""Phase 3.5 M2: count-only PoC for icloud → local-archive move feasibility."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

try:
    import osxphotos
except ImportError as exc:
    raise SystemExit(
        "osxphotos not found. Install: pip3 install --user osxphotos"
    ) from exc


def expand(path: str) -> Path:
    return Path(os.path.expanduser(path))


def load_config(config_path: Path) -> dict:
    with config_path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def library_by_id(config: dict, library_id: str) -> dict:
    for lib in config.get("libraries", []):
        if lib.get("id") == library_id:
            return lib
    raise SystemExit(f"library id not found in config: {library_id}")


def photos_library_path(library: dict) -> Path:
    raw = expand(str(library["path"]))
    if raw.name == "originals":
        return raw.parent
    if raw.suffix == ".photoslibrary":
        return raw
    raise SystemExit(f"cannot derive .photoslibrary from path: {raw}")


def photo_signature(photo) -> str | None:
    if not photo.fingerprint:
        return None
    filename = (photo.original_filename or photo.filename or "").lower()
    return f"{filename}:{photo.fingerprint}"


def eligible_photos(db: osxphotos.PhotosDB, cutoff_date: str) -> list:
    return [
        photo
        for photo in db.photos()
        if photo.date and photo.date.strftime("%Y-%m-%d") < cutoff_date
    ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Count-only cross-library move feasibility (no file moves)"
    )
    parser.add_argument(
        "--config",
        default=os.environ.get(
            "PHOTO_SYNC_CONFIG",
            str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
        ),
    )
    parser.add_argument("--cutoff-date", help="Override tier_policy.cutoff_date")
    parser.add_argument("--output", help="Write JSON report path")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config_path = expand(args.config)
    if not config_path.is_file():
        print(f"ERROR: config not found: {config_path}", file=sys.stderr)
        return 1

    config = load_config(config_path)
    tier = config.get("tier_policy") or {}
    source_id = tier.get("source_library_id", "icloud-primary")
    target_id = tier.get("target_library_id", "local-archive")
    cutoff = args.cutoff_date or tier.get("cutoff_date", "2023-01-01")

    source_lib_cfg = library_by_id(config, source_id)
    target_lib_cfg = library_by_id(config, target_id)
    source_lib = photos_library_path(source_lib_cfg)
    target_lib = photos_library_path(target_lib_cfg)

    source_db = osxphotos.PhotosDB(str(source_lib))
    target_db = osxphotos.PhotosDB(str(target_lib))

    target_sigs: set[str] = set()
    for photo in target_db.photos():
        sig = photo_signature(photo)
        if sig:
            target_sigs.add(sig)

    eligible = eligible_photos(source_db, cutoff)
    buckets = {
        "ready_local_path": 0,
        "needs_icloud_download": 0,
        "already_in_target_library": 0,
        "live_photo": 0,
        "burst": 0,
        "shared_library": 0,
        "not_in_target_not_local": 0,
    }

    for photo in eligible:
        sig = photo_signature(photo)
        in_target = bool(sig and sig in target_sigs)
        has_path = bool(photo.path and expand(str(photo.path)).is_file())

        if in_target:
            buckets["already_in_target_library"] += 1
        if photo.ismissing:
            buckets["needs_icloud_download"] += 1
        elif has_path:
            buckets["ready_local_path"] += 1
        elif not in_target:
            buckets["not_in_target_not_local"] += 1

        if photo.live_photo:
            buckets["live_photo"] += 1
        if photo.burst:
            buckets["burst"] += 1
        if getattr(photo, "shared_library", False):
            buckets["shared_library"] += 1

    move_candidates = len(eligible) - buckets["already_in_target_library"]
    needs_download_first = buckets["needs_icloud_download"]

    report: dict = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": True,
        "no_files_moved": True,
        "config": str(config_path),
        "tier_policy": {
            "source_library_id": source_id,
            "target_library_id": target_id,
            "cutoff_date": cutoff,
        },
        "libraries": {
            "source": str(source_lib),
            "target": str(target_lib),
            "target_photo_count": len(target_sigs),
        },
        "eligible": {
            "total": len(eligible),
            **buckets,
            "move_candidates_excluding_already_in_target": move_candidates,
        },
        "feasibility": {
            "can_hash_or_export_now": buckets["ready_local_path"],
            "must_download_from_icloud_first": needs_download_first,
            "recommended_pipeline": [
                "1. Ensure Immich has asset (spotcheck / immich-sync dry-run)",
                "2. osxphotos export OR read local originals for items with path",
                "3. photoscript.PhotosLibrary.open(target) + import_photos",
                "4. Remove from source library (AppleScript / Photos UI — no osxphotos delete CLI)",
            ],
            "blockers": [
                "osxphotos import targets last-opened library unless photoscript.open(path)",
                f"{needs_download_first} eligible are iCloud-only (ismissing) — export needs download",
                "No safe osxphotos CLI to delete from source after import",
                "Live Photos / bursts need paired MOV + HEIC export flags",
            ],
        },
    }

    if args.output:
        out_path = expand(args.output)
    else:
        log_dir = expand(
            config.get("sync", {}).get("log_dir", "~/Library/Logs/immich-photo-sync")
        )
        tier_dir = log_dir / "tier"
        tier_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        out_path = tier_dir / f"tier-cross-library-poc-{stamp}.json"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\nReport: {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
