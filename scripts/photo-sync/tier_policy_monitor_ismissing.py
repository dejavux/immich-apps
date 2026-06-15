#!/usr/bin/env python3
"""Snapshot icloud-primary ismissing / export-ready counts for Phase B monitoring."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tier_policy_lib import (
    expand,
    library_by_id,
    load_config,
    load_state,
    photos_library_path,
    select_move_candidates,
    target_signatures,
)

try:
    import osxphotos
except ImportError as exc:
    raise SystemExit("osxphotos not found") from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Monitor tier-policy ismissing progress")
    parser.add_argument(
        "--config",
        default=str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
    )
    parser.add_argument("--cutoff-date", help="Override tier_policy.cutoff_date")
    parser.add_argument("--cutoff-days", type=int, help="Today minus N days")
    parser.add_argument("--cutoff-one-year", action="store_true")
    return parser.parse_args()


def resolve_cutoff(args: argparse.Namespace, tier: dict) -> str:
    if args.cutoff_date:
        return args.cutoff_date
    if args.cutoff_days is not None:
        return (date.today() - timedelta(days=args.cutoff_days)).isoformat()
    if args.cutoff_one_year:
        return (date.today() - timedelta(days=365)).isoformat()
    return tier.get("cutoff_date", "2023-01-01")


def main() -> int:
    args = parse_args()
    config = load_config(expand(args.config))
    tier = config.get("tier_policy") or {}
    source_cfg = library_by_id(config, tier.get("source_library_id", "icloud-primary"))
    target_cfg = library_by_id(config, tier.get("target_library_id", "local-archive"))
    source_lib = photos_library_path(source_cfg)
    target_lib = photos_library_path(target_cfg)
    cutoff = resolve_cutoff(args, tier)
    state = load_state(config)

    db = osxphotos.PhotosDB(str(source_lib))
    target_db = osxphotos.PhotosDB(str(target_lib))
    target_sigs = target_signatures(target_db)
    photos = list(db.photos())
    ismissing = sum(1 for p in photos if p.ismissing and not p.intrash)
    local = sum(1 for p in photos if p.path and not p.ismissing and not p.intrash)
    intrash = sum(1 for p in photos if p.intrash)

    exported = set(state.get("exported_uuids", []))
    imported = set(state.get("imported_uuids", []))
    processed = exported | imported

    candidates, _counts = select_move_candidates(
        db,
        target_sigs,
        cutoff_date=cutoff,
        local_path_only=True,
        skip_shared_library=bool(tier.get("skip_shared_library")),
        skip_ismissing=True,
        processed_uuids=processed,
    )
    eligible_all = [p for p in photos if p.date and p.date.strftime("%Y-%m-%d") < cutoff and not p.intrash]
    eligible_ismissing = [p for p in eligible_all if p.ismissing]

    report = {
        "library": str(source_lib),
        "cutoff_date": cutoff,
        "total_active": len(photos) - intrash,
        "intrash": intrash,
        "local_path": local,
        "ismissing": ismissing,
        "eligible_before_cutoff": len(eligible_all),
        "eligible_ismissing": len(eligible_ismissing),
        "export_ready_now": len(candidates),
        "state_exported": len(exported),
        "state_imported": len(imported),
    }
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
