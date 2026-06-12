#!/usr/bin/env python3
"""Audit Mac Photos local library for hash duplicates and timestamp anomalies."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

MEDIA_EXT = {
    ".jpg",
    ".jpeg",
    ".heic",
    ".heif",
    ".png",
    ".gif",
    ".tif",
    ".tiff",
    ".webp",
    ".mov",
    ".mp4",
    ".m4v",
    ".avi",
    ".mkv",
}


def sha1_file(path: Path, chunk: int = 1024 * 1024) -> str:
    h = hashlib.sha1()
    with path.open("rb") as f:
        while True:
            block = f.read(chunk)
            if not block:
                break
            h.update(block)
    return h.hexdigest()


def exif_datetime_original(path: Path) -> str | None:
    try:
        out = subprocess.run(
            [
                "exiftool",
                "-DateTimeOriginal",
                "-CreateDate",
                "-FileModifyDate",
                "-json",
                str(path),
            ],
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
        if out.returncode != 0 or not out.stdout.strip():
            return None
        data = json.loads(out.stdout)[0]
        return (
            data.get("DateTimeOriginal")
            or data.get("CreateDate")
            or data.get("FileModifyDate")
        )
    except (subprocess.SubprocessError, json.JSONDecodeError, IndexError, OSError):
        return None


def parse_exif_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value[:19], fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def mtime_ts(path: Path) -> datetime:
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)


def scan_library(root: Path) -> list[dict]:
    rows: list[dict] = []
    for dirpath, _, filenames in os.walk(root):
        for name in filenames:
            p = Path(dirpath) / name
            if p.suffix.lower() not in MEDIA_EXT:
                continue
            try:
                checksum = sha1_file(p)
            except OSError as exc:
                print(f"skip {p}: {exc}", file=sys.stderr)
                continue
            exif_raw = exif_datetime_original(p)
            exif_dt = parse_exif_ts(exif_raw)
            mtime = mtime_ts(p)
            rows.append(
                {
                    "path": str(p),
                    "checksum": checksum,
                    "size": p.stat().st_size,
                    "exif_raw": exif_raw,
                    "exif_dt": exif_dt.isoformat() if exif_dt else None,
                    "mtime": mtime.isoformat(),
                    "mtime_delta_days": (
                        abs((mtime - exif_dt).days) if exif_dt else None
                    ),
                }
            )
    return rows


def summarize(rows: list[dict], label: str) -> dict:
    by_hash: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_hash[row["checksum"]].append(row)

    hash_dup_groups = {
        h: items for h, items in by_hash.items() if len(items) > 1
    }
    ts_anomalies = [
        r
        for r in rows
        if r.get("mtime_delta_days") is not None and r["mtime_delta_days"] >= 30
    ]
    no_exif = [r for r in rows if not r.get("exif_dt")]

    return {
        "library": label,
        "files": len(rows),
        "unique_hashes": len(by_hash),
        "hash_duplicate_groups": len(hash_dup_groups),
        "hash_duplicate_extra_files": sum(len(v) - 1 for v in hash_dup_groups.values()),
        "timestamp_anomalies_30d_plus": len(ts_anomalies),
        "missing_exif_datetime": len(no_exif),
        "top_hash_duplicate_groups": [
            {
                "checksum": h,
                "count": len(items),
                "paths": [i["path"] for i in items[:5]],
                "exif_samples": sorted(
                    {i.get("exif_raw") or "none" for i in items}
                )[:5],
            }
            for h, items in sorted(
                hash_dup_groups.items(), key=lambda kv: len(kv[1]), reverse=True
            )[:20]
        ],
        "top_timestamp_anomalies": sorted(
            ts_anomalies,
            key=lambda r: r.get("mtime_delta_days") or 0,
            reverse=True,
        )[:20],
    }


def cross_library_overlap(local_rows: list[dict], icloud_rows: list[dict]) -> dict:
    local_hashes = {r["checksum"] for r in local_rows}
    icloud_hashes = {r["checksum"] for r in icloud_rows}
    overlap = local_hashes & icloud_hashes
    local_only = local_hashes - icloud_hashes
    icloud_only = icloud_hashes - local_hashes
    return {
        "local_unique_hashes": len(local_hashes),
        "icloud_unique_hashes": len(icloud_hashes),
        "shared_hashes": len(overlap),
        "local_only_hashes": len(local_only),
        "icloud_only_hashes": len(icloud_only),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--local",
        default=os.path.expanduser(
            "~/Pictures/LOCAL PHOTO LIBRARY.photoslibrary/originals"
        ),
    )
    parser.add_argument(
        "--icloud",
        default=os.path.expanduser("~/Pictures/Photos Library.photoslibrary/originals"),
    )
    parser.add_argument(
        "--output",
        default=os.path.expanduser(
            "~/Library/Logs/immich-photo-sync/audit-local-duplicates.json"
        ),
    )
    parser.add_argument("--skip-icloud", action="store_true")
    args = parser.parse_args()

    local_root = Path(args.local).expanduser()
    if not local_root.is_dir():
        print(f"ERROR: local path missing: {local_root}", file=sys.stderr)
        return 1

    print(f"Scanning local library: {local_root}", flush=True)
    local_rows = scan_library(local_root)
    report: dict = {"local": summarize(local_rows, "local-archive")}

    if not args.skip_icloud:
        icloud_root = Path(args.icloud).expanduser()
        if icloud_root.is_dir():
            print(f"Scanning icloud library: {icloud_root}", flush=True)
            icloud_rows = scan_library(icloud_root)
            report["icloud"] = summarize(icloud_rows, "icloud-primary")
            report["cross_library"] = cross_library_overlap(local_rows, icloud_rows)
        else:
            report["icloud"] = {"error": f"missing {icloud_root}"}

    out = Path(args.output).expanduser()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    loc = report["local"]
    print(json.dumps(loc, indent=2, ensure_ascii=False))
    if "cross_library" in report:
        print("\nCross-library:")
        print(json.dumps(report["cross_library"], indent=2))
    print(f"\nFull report: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
