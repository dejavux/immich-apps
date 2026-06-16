#!/usr/bin/env python3
"""Fix icloud-primary capture dates using local-archive matches (wrong import window)."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tier_policy_lib import (
    expand,
    library_by_id,
    load_config,
    photo_signature,
    photos_library_path,
    tier_log_dir,
)

try:
    import osxphotos
    import photoscript
    from photoscript.exceptions import AppleScriptError
except ImportError as exc:
    raise SystemExit("osxphotos/photoscript required") from exc


def in_wrong_window(dt: datetime, start: datetime, end: datetime) -> bool:
    local = dt.replace(tzinfo=None) if dt.tzinfo else dt
    return start <= local <= end


def build_target_indexes(target_db: osxphotos.PhotosDB) -> tuple[dict[str, Any], dict[str, list[Any]]]:
    by_sig: dict[str, Any] = {}
    by_filename: dict[str, list[Any]] = {}
    for photo in target_db.photos():
        sig = photo_signature(photo)
        name = (photo.original_filename or photo.filename or "").lower()
        if sig:
            by_sig[sig] = photo
        if name:
            by_filename.setdefault(name, []).append(photo)
    return by_sig, by_filename


def match_target_photo(
    photo,
    *,
    by_sig: dict[str, Any],
    by_filename: dict[str, list[Any]],
):
    sig = photo_signature(photo)
    if sig and sig in by_sig:
        return by_sig[sig]
    name = (photo.original_filename or photo.filename or "").lower()
    matches = by_filename.get(name, [])
    if len(matches) == 1:
        return matches[0]
    return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fix icloud-primary dates from local-archive SSOT")
    parser.add_argument(
        "--config",
        default=str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
    )
    parser.add_argument("--source-library-id", default="icloud-primary")
    parser.add_argument("--match-library-id", default="local-archive")
    parser.add_argument("--from-date", default="2026-06-14")
    parser.add_argument("--to-date", default="2026-06-17")
    parser.add_argument(
        "--import-batch-prefix",
        help="Only fix when wrong capture date ISO starts with this (e.g. 2026-06-15T09:2)",
    )
    parser.add_argument(
        "--min-delta-days",
        type=int,
        help="Fix all signature matches differing by at least N days from local-archive",
    )
    parser.add_argument("--require-local-match", action="store_true", default=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--write-plan", metavar="PATH")
    parser.add_argument("--apply", action="store_true", help="Apply via photoscript (Photos.app)")
    return parser.parse_args()


def ensure_photos_open(library: Path) -> None:
    subprocess.run(["open", "-a", "Photos", str(library)], check=False)
    time.sleep(6)


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


def main() -> int:
    args = parse_args()
    config = load_config(expand(args.config))
    source_lib = photos_library_path(library_by_id(config, args.source_library_id))
    match_lib = photos_library_path(library_by_id(config, args.match_library_id))

    source_db = osxphotos.PhotosDB(str(source_lib))
    target_db = osxphotos.PhotosDB(str(match_lib))
    by_sig, by_filename = build_target_indexes(target_db)

    wrong_start = datetime.strptime(args.from_date, "%Y-%m-%d")
    wrong_end = datetime.strptime(args.to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)

    plan: list[dict] = []
    skipped = 0
    for photo in source_db.photos():
        if not photo.date:
            continue
        wrong_iso = photo.date.replace(tzinfo=None).isoformat() if photo.date.tzinfo else photo.date.isoformat()
        current = photo.date.replace(tzinfo=None) if photo.date.tzinfo else photo.date

        if args.min_delta_days is not None:
            if photo.intrash:
                continue
            sig = photo_signature(photo)
            target = by_sig.get(sig) if sig else None
            if target is None or not target.date:
                skipped += 1
                continue
            expected = target.date.replace(tzinfo=None) if target.date.tzinfo else target.date
            if abs((current - expected).days) < args.min_delta_days:
                skipped += 1
                continue
        else:
            if not in_wrong_window(photo.date, wrong_start, wrong_end):
                continue
            if args.import_batch_prefix and not wrong_iso.startswith(args.import_batch_prefix):
                skipped += 1
                continue
            target = match_target_photo(photo, by_sig=by_sig, by_filename=by_filename)
            if target is None:
                if args.require_local_match:
                    skipped += 1
                continue
            if not target.date:
                skipped += 1
                continue
            expected = target.date.replace(tzinfo=None) if target.date.tzinfo else target.date
            if abs((current - expected).total_seconds()) < 60:
                skipped += 1
                continue

        plan.append(
            {
                "uuid": photo.uuid,
                "filename": photo.original_filename or photo.filename,
                "wrong_date": wrong_iso,
                "expected": expected.isoformat(),
                "date": expected.strftime("%Y-%m-%d"),
                "time": expected.strftime("%H:%M:%S"),
                "local_uuid": target.uuid,
            }
        )

    report = {
        "generated_at": datetime.now().astimezone().isoformat(),
        "source_library": str(source_lib),
        "match_library": str(match_lib),
        "to_fix": len(plan),
        "skipped": skipped,
        "items": plan,
    }
    out = tier_log_dir(config) / "fix-source-dates-report.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"to_fix": len(plan), "skipped": skipped, "sample": plan[:5]}, indent=2, ensure_ascii=False))

    if args.write_plan:
        Path(args.write_plan).write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
        print(f"Plan: {args.write_plan}", file=sys.stderr)

    if args.dry_run or not args.apply:
        print(f"Report: {out}", file=sys.stderr)
        return 0

    lib = photoscript.PhotosLibrary()
    lib.open(str(source_lib), delay=8)
    ensure_photos_open(source_lib)
    fixed = failed = 0
    for idx, item in enumerate(plan, start=1):
        print(f"[{idx}/{len(plan)}] {item['filename']} -> {item['expected']}", flush=True)
        try:
            apply_photo_date(item["uuid"], datetime.fromisoformat(item["expected"]))
            fixed += 1
        except (ValueError, OSError, AppleScriptError) as exc:
            failed += 1
            print(f"FAILED {item['uuid']}: {exc}", file=sys.stderr, flush=True)
    print(json.dumps({"fixed": fixed, "failed": failed}, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
