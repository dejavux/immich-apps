#!/usr/bin/env python3
"""Phase 3.5 PoC: estimate tier_policy eligible assets via osxphotos."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml


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


def originals_path(library: dict) -> Path:
    raw = expand(str(library["path"]))
    if raw.name == "originals":
        return raw
    return raw / "originals"


def du_gb(path: Path) -> float | None:
    if not path.is_dir():
        return None
    proc = subprocess.run(
        ["du", "-sk", str(path)],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        return None
    kb = int(proc.stdout.split()[0])
    return round(kb / (1024 * 1024), 2)


def osxphotos_count(photos_lib: Path, cutoff_date: str) -> int:
    if shutil.which("osxphotos") is None:
        raise SystemExit(
            "osxphotos not found. Install: pip3 install --user osxphotos "
            "(ensure ~/.local/bin on PATH)"
        )
    proc = subprocess.run(
        [
            "osxphotos",
            "query",
            "--library",
            str(photos_lib),
            "--to-date",
            cutoff_date,
            "--count",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        msg = proc.stderr.strip() or proc.stdout.strip() or "osxphotos query failed"
        raise SystemExit(msg)
    lines = [ln.strip() for ln in proc.stdout.splitlines() if ln.strip().isdigit()]
    if not lines:
        raise SystemExit(f"unexpected osxphotos output: {proc.stdout!r}")
    return int(lines[-1])


def osxphotos_info_summary(photos_lib: Path) -> dict[str, str]:
    proc = subprocess.run(
        ["osxphotos", "info", "--library", str(photos_lib)],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        return {"error": proc.stderr.strip() or "osxphotos info failed"}
    summary: dict[str, str] = {}
    for line in proc.stdout.splitlines():
        if "Photo App Totals" in line:
            summary["photo_app_totals_line"] = line.strip()
        if "not downloaded to this Mac" in line:
            summary["icloud_download_line"] = line.strip()
    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Estimate tier_policy eligible photo count (dry-run PoC)"
    )
    parser.add_argument(
        "--config",
        default=os.environ.get(
            "PHOTO_SYNC_CONFIG",
            str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
        ),
        help="photo-sync.config.yaml path",
    )
    parser.add_argument(
        "--cutoff-date",
        help="Override tier_policy.cutoff_date (YYYY-MM-DD); photos created before this date",
    )
    parser.add_argument(
        "--output",
        help="Write JSON report to this path (default: log_dir/tier/tier-poc-Timestamp.json)",
    )
    parser.add_argument(
        "--no-info",
        action="store_true",
        help="Skip osxphotos info (faster)",
    )
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
    cutoff = args.cutoff_date or tier.get("cutoff_date")
    max_size_gb = tier.get("max_size_gb")

    source_lib = library_by_id(config, source_id)
    target_lib = library_by_id(config, target_id)
    photos_lib = photos_library_path(source_lib)
    originals = originals_path(source_lib)

    size_gb = du_gb(originals)
    eligible_by_date: int | None = None
    if cutoff:
        eligible_by_date = osxphotos_count(photos_lib, cutoff)

    size_over = (
        size_gb is not None
        and max_size_gb is not None
        and size_gb > float(max_size_gb)
    )

    report: dict = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": True,
        "config": str(config_path),
        "tier_policy": {
            "enabled": tier.get("enabled", False),
            "source_library_id": source_id,
            "target_library_id": target_id,
            "cutoff_date": cutoff,
            "max_size_gb": max_size_gb,
        },
        "source": {
            "photos_library": str(photos_lib),
            "originals_path": str(originals),
            "originals_size_gb": size_gb,
        },
        "target": {
            "photos_library": str(photos_library_path(target_lib)),
        },
        "eligible": {
            "by_cutoff_date": eligible_by_date,
            "by_size_over_max": size_over,
            "note": (
                "PoC counts photos with date created BEFORE cutoff_date. "
                "Does not move files."
            ),
        },
    }

    if not args.no_info:
        report["osxphotos_info"] = osxphotos_info_summary(photos_lib)

    if args.output:
        out_path = expand(args.output)
    else:
        log_dir = expand(
            config.get("sync", {}).get("log_dir", "~/Library/Logs/immich-photo-sync")
        )
        tier_dir = log_dir / "tier"
        tier_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        out_path = tier_dir / f"tier-poc-{stamp}.json"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\nReport: {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
