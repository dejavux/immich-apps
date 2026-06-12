#!/usr/bin/env python3
"""Phase 3.5 M2: spot-check eligible tier photos vs Immich (hash overlap)."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
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


def sha1_file(path: Path, chunk: int = 1024 * 1024) -> str:
    digest = hashlib.sha1()
    with path.open("rb") as fh:
        while True:
            block = fh.read(chunk)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


def eligible_photos(db: osxphotos.PhotosDB, cutoff_date: str) -> list:
    return [
        photo
        for photo in db.photos()
        if photo.date and photo.date.strftime("%Y-%m-%d") < cutoff_date
    ]


def immich_bulk_check(
    url: str,
    api_key: str,
    assets: list[dict[str, str]],
    batch_size: int,
) -> tuple[int, int, list[str]]:
    accept = 0
    reject = 0
    errors: list[str] = []
    endpoint = f"{url.rstrip('/')}/api/assets/bulk-upload-check"

    for offset in range(0, len(assets), batch_size):
        chunk = assets[offset : offset + batch_size]
        body = json.dumps({"assets": chunk}).encode("utf-8")
        req = urllib.request.Request(
            endpoint,
            data=body,
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                payload = json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            errors.append(f"HTTP {exc.code}: {detail[:200]}")
            continue
        except urllib.error.URLError as exc:
            errors.append(str(exc.reason))
            continue

        for row in payload.get("results", []):
            if row.get("action") == "reject":
                reject += 1
            else:
                accept += 1

    return accept, reject, errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Spot-check tier_policy eligible photos against Immich checksums"
    )
    parser.add_argument(
        "--config",
        default=os.environ.get(
            "PHOTO_SYNC_CONFIG",
            str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
        ),
    )
    parser.add_argument("--cutoff-date", help="Override tier_policy.cutoff_date")
    parser.add_argument(
        "--sample",
        type=int,
        default=0,
        help="Max local-path photos to hash (0 = all hashable)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Immich bulk-upload-check batch size",
    )
    parser.add_argument("--output", help="Write JSON report path")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config_path = expand(args.config)
    if not config_path.is_file():
        print(f"ERROR: config not found: {config_path}", file=sys.stderr)
        return 1

    api_key = os.environ.get("IMMICH_API_KEY", "")
    url = os.environ.get("IMMICH_INSTANCE_URL", "")
    if not api_key or not url:
        print(
            "ERROR: IMMICH_API_KEY and IMMICH_INSTANCE_URL required.\n"
            "  source scripts/photo-sync/ensure-immich-creds.sh && load_immich_creds <repo>",
            file=sys.stderr,
        )
        return 1

    config = load_config(config_path)
    tier = config.get("tier_policy") or {}
    source_id = tier.get("source_library_id", "icloud-primary")
    cutoff = args.cutoff_date or tier.get("cutoff_date", "2023-01-01")
    source_lib = library_by_id(config, source_id)
    photos_lib = photos_library_path(source_lib)

    db = osxphotos.PhotosDB(str(photos_lib))
    eligible = eligible_photos(db, cutoff)
    hashable = [
        photo
        for photo in eligible
        if photo.path and expand(str(photo.path)).is_file()
    ]
    ismissing = [photo for photo in eligible if photo.ismissing]

    sample = hashable if args.sample <= 0 else hashable[: args.sample]
    assets: list[dict[str, str]] = []
    hash_errors: list[str] = []
    for photo in sample:
        path = expand(str(photo.path))
        try:
            assets.append({"id": photo.uuid, "checksum": sha1_file(path)})
        except OSError as exc:
            hash_errors.append(f"{path}: {exc}")

    accept, reject, api_errors = immich_bulk_check(
        url, api_key, assets, args.batch_size
    )

    checked = len(assets)
    overlap_pct = round(100 * reject / checked, 1) if checked else None

    report: dict = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": True,
        "config": str(config_path),
        "tier_policy": {
            "source_library_id": source_id,
            "cutoff_date": cutoff,
        },
        "source": {"photos_library": str(photos_lib)},
        "eligible": {
            "total": len(eligible),
            "with_local_path": len(hashable),
            "ismissing_icloud": len(ismissing),
            "not_ismissing": len(eligible) - len(ismissing),
        },
        "immich_spotcheck": {
            "checked": checked,
            "in_immich_duplicate": reject,
            "not_in_immich": accept,
            "overlap_pct": overlap_pct,
            "hash_errors": hash_errors,
            "api_errors": api_errors,
            "note": (
                "Only photos with a local originals path can be SHA1-checked. "
                "ismissing photos require iCloud download before hash or move."
            ),
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
        out_path = tier_dir / f"tier-spotcheck-{stamp}.json"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\nReport: {out_path}", file=sys.stderr)
    return 1 if hash_errors or api_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
