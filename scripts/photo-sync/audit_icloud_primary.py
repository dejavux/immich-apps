#!/usr/bin/env python3
"""Inventory + date audit for icloud-primary Photos library."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tier_policy_lib import (
    expand,
    library_by_id,
    load_config,
    photo_signature,
    photos_library_path,
    select_move_candidates,
    target_signatures,
    tier_log_dir,
    utc_now,
)

try:
    import osxphotos
except ImportError as exc:
    raise SystemExit("osxphotos required") from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit icloud-primary inventory and dates")
    parser.add_argument(
        "--config",
        default=str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
    )
    parser.add_argument("--cutoff-days", type=int, default=365)
    parser.add_argument("--min-delta-days", type=int, default=7)
    return parser.parse_args()


def run_immich_audit(config_path: Path, *, min_delta_days: int) -> dict:
    proc = subprocess.run(
        [
            sys.executable,
            str(Path(__file__).resolve().parent / "immich_audit_dates.py"),
            "--config",
            str(config_path),
            "--library-id",
            "icloud-primary",
            "--min-delta-days",
            str(min_delta_days),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        return {"error": (proc.stderr or proc.stdout or "immich audit failed")[:500]}
    try:
        return json.loads(proc.stdout.strip().split("\n")[0])
    except (json.JSONDecodeError, IndexError):
        return {"raw": proc.stdout[-500:]}


def main() -> int:
    args = parse_args()
    config = load_config(expand(args.config))
    tier = config.get("tier_policy") or {}
    source_lib = photos_library_path(library_by_id(config, "icloud-primary"))
    target_lib = photos_library_path(library_by_id(config, "local-archive"))
    source_db = osxphotos.PhotosDB(str(source_lib))
    target_db = osxphotos.PhotosDB(str(target_lib))
    target_sigs = target_signatures(target_db)
    by_sig = {}
    for target in target_db.photos():
        sig = photo_signature(target)
        if sig:
            by_sig[sig] = target

    photos = videos = intrash = 0
    for item in source_db.photos():
        if item.intrash:
            intrash += 1
            continue
        if item.ismovie:
            videos += 1
        else:
            photos += 1

    cutoff = (date.today() - timedelta(days=args.cutoff_days)).isoformat()
    move_candidates, move_counts = select_move_candidates(
        source_db,
        target_sigs,
        cutoff_date=cutoff,
        local_path_only=True,
        skip_shared_library=bool(tier.get("skip_shared_library")),
        skip_ismissing=True,
        processed_uuids=set(),
    )

    import_start = datetime(2026, 6, 14)
    import_end = datetime(2026, 6, 17, 23, 59, 59)
    sig_fixable = []
    import_window = []
    for item in source_db.photos():
        if item.intrash or not item.date:
            continue
        capture = item.date.replace(tzinfo=None) if item.date.tzinfo else item.date
        if import_start <= capture <= import_end:
            import_window.append(
                {
                    "uuid": item.uuid,
                    "filename": item.original_filename or item.filename,
                    "capture": capture.isoformat(),
                    "in_local": photo_signature(item) in target_sigs if photo_signature(item) else False,
                }
            )
        sig = photo_signature(item)
        if not sig or sig not in by_sig:
            continue
        target = by_sig[sig]
        if not target.date:
            continue
        expected = target.date.replace(tzinfo=None) if target.date.tzinfo else target.date
        if abs((capture - expected).days) >= args.min_delta_days:
            sig_fixable.append(
                {
                    "uuid": item.uuid,
                    "filename": item.original_filename or item.filename,
                    "icloud": capture.isoformat(),
                    "local": expected.isoformat(),
                }
            )

    immich = run_immich_audit(expand(args.config), min_delta_days=args.min_delta_days)

    report = {
        "generated_at": utc_now(),
        "library": str(source_lib),
        "inventory": {
            "photos": photos,
            "videos": videos,
            "total_active": photos + videos,
            "intrash": intrash,
        },
        "dates": {
            "sig_match_needing_fix": len(sig_fixable),
            "sig_fixable_sample": sig_fixable[:20],
            "import_window_jun2026": len(import_window),
            "import_window_items": import_window,
            "immich_audit": immich,
        },
        "tier_move": {
            "cutoff_date": cutoff,
            "eligible_not_in_local": len(move_candidates),
            "selection_counts": move_counts,
            "move_candidate_sample": [
                {
                    "uuid": p.uuid,
                    "filename": p.original_filename or p.filename,
                    "date": p.date.strftime("%Y-%m-%d") if p.date else None,
                    "is_video": p.ismovie,
                }
                for p in move_candidates[:20]
            ],
        },
    }

    out = tier_log_dir(config) / "audit-icloud-primary.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\nReport: {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
