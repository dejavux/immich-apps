#!/usr/bin/env python3
"""Fix LOCAL Photos capture dates after tier import (manifest + source library SSOT)."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from photo_sync_lib import expand, load_config, normalize_checksum
from tier_policy_lib import (
    library_by_id,
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fix tier import dates in local-archive")
    parser.add_argument(
        "--config",
        default=str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
    )
    parser.add_argument(
        "--staging",
        default="/tmp/immich-photo-sync/tier-staging",
        help="Tier staging root with batch-manifest.json files",
    )
    parser.add_argument(
        "--wrong-only",
        action="store_true",
        default=True,
        help="Only fix photos with capture date in import window (default)",
    )
    parser.add_argument(
        "--all-tier",
        action="store_true",
        help="Fix any local photo matching tier manifest/source signature",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--write-plan",
        metavar="PATH",
        help="Write JSON list of pending date fixes (for timewarp batch)",
    )
    parser.add_argument(
        "--target-library-id",
        help="Photos library id to fix (default: tier_policy.target_library_id)",
    )
    parser.add_argument("--from-date", default="2026-06-14")
    parser.add_argument("--to-date", default="2026-06-17")
    return parser.parse_args()


def load_manifest_index(
    staging: Path,
) -> tuple[dict[str, str], dict[str, list[str]], dict[str, datetime], dict[tuple[str, int], datetime]]:
    """checksum -> ISO date; filename.lower -> [checksum]; signature -> date; (fn,size) -> date."""
    by_checksum: dict[str, str] = {}
    by_filename: dict[str, list[str]] = defaultdict(list)
    by_signature: dict[str, datetime] = {}
    by_size: dict[tuple[str, int], datetime] = {}
    size_candidates: dict[tuple[str, int], list[str]] = defaultdict(list)
    for manifest_path in sorted(staging.glob("batch-*/batch-manifest.json")):
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        for item in data.get("items", []):
            checksum = normalize_checksum(item.get("checksum"))
            date_str = item.get("date")
            filename = (item.get("filename") or "").lower()
            if not date_str:
                continue
            capture = parse_date_only(date_str)
            if checksum:
                by_checksum[checksum] = date_str
                if filename:
                    by_filename[filename].append(checksum)
                    by_signature[f"{filename}:{checksum}"] = capture
            elif filename:
                by_filename[filename].append("")
            for staging_file in item.get("staging_files", []):
                path = Path(staging_file)
                if not path.is_file():
                    continue
                key = (filename or path.name.lower(), path.stat().st_size)
                size_candidates[key].append(date_str)
    for key, dates in size_candidates.items():
        unique_dates = sorted(set(dates))
        if len(unique_dates) == 1:
            by_size[key] = parse_date_only(unique_dates[0])
    return by_checksum, by_filename, by_signature, by_size


def build_source_date_index(source_db: osxphotos.PhotosDB, exported_uuids: set[str]) -> dict[str, datetime]:
    """Photo signature -> capture datetime from icloud-primary (slow; prefer manifest index)."""
    index: dict[str, datetime] = {}
    for uuid in exported_uuids:
        photo = source_db.get_photo(uuid)
        if photo is None or not photo.date:
            continue
        sig = photo_signature(photo)
        if sig:
            index[sig] = photo.date
    return index


def in_wrong_window(dt: datetime, start: datetime, end: datetime) -> bool:
    local = dt.replace(tzinfo=None) if dt.tzinfo else dt
    return start <= local <= end


def parse_date_only(date_str: str) -> datetime:
    return datetime.strptime(date_str, "%Y-%m-%d")


def expected_date_for_photo(
    photo,
    *,
    by_checksum: dict[str, str],
    by_filename: dict[str, list[str]],
    source_by_sig: dict[str, datetime],
    by_size: dict[tuple[str, int], datetime],
) -> datetime | None:
    sig = photo_signature(photo)
    if sig and sig in source_by_sig:
        return source_by_sig[sig]
    if sig and sig in by_checksum:
        ref = source_by_sig.get(sig)
        return _merge_date_and_time(parse_date_only(by_checksum[sig]), ref)
    filename = (photo.original_filename or photo.filename or "").lower()
    checksums = by_filename.get(filename, [])
    if len(checksums) == 1 and checksums[0] and checksums[0] in by_checksum:
        ref = source_by_sig.get(checksums[0])
        return _merge_date_and_time(parse_date_only(by_checksum[checksums[0]]), ref)
    path = photo.path
    if path and Path(path).is_file():
        size_key = (filename, Path(path).stat().st_size)
        if size_key in by_size:
            return by_size[size_key]
    return None


def _merge_date_and_time(date_only: datetime, ref: datetime | None) -> datetime:
    if ref is None:
        return date_only
    ref_naive = ref.replace(tzinfo=None) if ref.tzinfo else ref
    return date_only.replace(hour=ref_naive.hour, minute=ref_naive.minute, second=ref_naive.second)


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


def main() -> int:
    args = parse_args()
    config = load_config(expand(args.config))
    staging = expand(args.staging)

    tier = config.get("tier_policy", {})
    lib_id = args.target_library_id or tier.get("target_library_id", "local-archive")
    target_cfg = library_by_id(config, lib_id)
    target_lib = photos_library_path(target_cfg)

    by_checksum, by_filename, manifest_by_sig, by_size = load_manifest_index(staging)
    target_db = osxphotos.PhotosDB(str(target_lib))
    source_by_sig = manifest_by_sig

    wrong_start = datetime.strptime(args.from_date, "%Y-%m-%d")
    wrong_end = datetime.strptime(args.to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    all_tier = args.all_tier

    ensure_photos_open(target_lib)

    fixed = skipped = failed = 0
    report_path = tier_log_dir(config) / f"fix-import-dates-report-{lib_id}.json"
    changes: list[dict] = []

    if all_tier:
        candidates = list(target_db.photos())
    else:
        candidates = [
            photo for photo in target_db.photos() if photo.date and in_wrong_window(photo.date, wrong_start, wrong_end)
        ]
    total = len(candidates)
    print(f"candidates={total} mode={'all-tier' if all_tier else 'wrong-only'}", file=sys.stderr)

    for idx, photo in enumerate(candidates, start=1):
        if idx % 50 == 0 or idx == total:
            print(
                f"progress {idx}/{total} fixed={fixed} skipped={skipped} failed={failed}",
                file=sys.stderr,
                flush=True,
            )
        if not photo.date:
            continue
        expected = expected_date_for_photo(
            photo,
            by_checksum=by_checksum,
            by_filename=by_filename,
            source_by_sig=source_by_sig,
            by_size=by_size,
        )
        if expected is None:
            skipped += 1
            continue

        current = photo.date
        if not all_tier and not in_wrong_window(current, wrong_start, wrong_end):
            skipped += 1
            continue

        current_naive = current.replace(tzinfo=None) if current.tzinfo else current
        expected_naive = expected.replace(tzinfo=None) if expected.tzinfo else expected
        if abs((current_naive - expected_naive).total_seconds()) < 60:
            skipped += 1
            continue

        entry = {
            "uuid": photo.uuid,
            "filename": photo.original_filename or photo.filename,
            "was": current.isoformat(),
            "expected": expected.isoformat(),
        }
        if args.dry_run:
            changes.append({**entry, "action": "dry-run"})
            fixed += 1
            continue

        try:
            apply_photo_date(photo.uuid, expected_naive)
            changes.append({**entry, "action": "fixed"})
            fixed += 1
        except (ValueError, OSError, AppleScriptError) as exc:
            changes.append({**entry, "action": "failed", "error": str(exc)})
            failed += 1

    report = {
        "generated_at": datetime.now().astimezone().isoformat(),
        "target_library": str(target_lib),
        "mode": "all-tier" if all_tier else "wrong-only",
        "fixed": fixed,
        "skipped": skipped,
        "failed": failed,
        "sample": changes[:50],
        "total_changes": len(changes),
    }
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if args.write_plan:
        plan = [
            {
                "uuid": c["uuid"],
                "filename": c["filename"],
                "date": c["expected"][:10],
                "time": c["expected"][11:19] if len(c["expected"]) > 10 else "00:00:00",
            }
            for c in changes
            if c.get("action") in ("dry-run", "fixed")
        ]
        Path(args.write_plan).write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
        print(f"Plan: {args.write_plan} ({len(plan)} items)", file=sys.stderr)
    print(json.dumps({k: report[k] for k in ("mode", "fixed", "skipped", "failed", "total_changes")}, indent=2))
    print(f"Report: {report_path}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
