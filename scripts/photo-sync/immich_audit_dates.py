#!/usr/bin/env python3
"""Audit and fix Immich timeline dates vs Mac Photos library."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))

from photo_sync_lib import (
    expand,
    load_config,
    log_dir,
    normalize_checksum,
    reconcile_album_names,
    sha1_file,
)

try:
    import osxphotos
except ImportError as exc:
    raise SystemExit("osxphotos not found. Install: pip3 install --user osxphotos") from exc


def photos_library_path(path: Path) -> Path:
    if path.name == "originals":
        return path.parent
    if path.suffix == ".photoslibrary":
        return path
    raise SystemExit(f"cannot derive .photoslibrary from: {path}")


def immich_api_base(config: dict) -> str:
    immich = config.get("immich") or {}
    url = os.environ.get("IMMICH_INSTANCE_URL") or immich.get("instance_url") or ""
    base = url.rstrip("/")
    if not base.endswith("/api"):
        base = f"{base}/api"
    return base


def immich_api_key() -> str:
    key = os.environ.get("IMMICH_API_KEY", "")
    if not key or key.startswith("your-"):
        raise SystemExit("IMMICH_API_KEY not set")
    return key


def api_request(
    *,
    method: str,
    url: str,
    api_key: str,
    body: dict | None = None,
    timeout: int = 120,
) -> dict | list | None:
    data = None
    headers = {"Accept": "application/json", "x-api-key": api_key}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {detail[:300]}") from exc
    if not raw:
        return None
    return json.loads(raw)


def load_immich_assets_by_checksum(config: dict) -> dict[str, dict]:
    base = immich_api_base(config)
    api_key = immich_api_key()
    albums = api_request(method="GET", url=f"{base}/albums", api_key=api_key)
    if not isinstance(albums, list):
        return {}

    wanted = set(reconcile_album_names(config))
    by_checksum: dict[str, dict] = {}
    for album in albums:
        name = album.get("albumName")
        if wanted and name not in wanted:
            continue
        album_id = album.get("id")
        if not album_id:
            continue
        detail = api_request(method="GET", url=f"{base}/albums/{album_id}", api_key=api_key)
        if not isinstance(detail, dict):
            continue
        for asset in detail.get("assets", []):
            checksum = normalize_checksum(asset.get("checksum"))
            if checksum:
                by_checksum[checksum] = asset
    return by_checksum


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def default_timezone(config: dict) -> str:
    sync = config.get("sync") or {}
    return str(sync.get("timezone_default") or "Asia/Taipei")


def iana_timezone(dt: datetime, fallback: str) -> str:
    if dt.tzinfo is None:
        return fallback
    key = getattr(dt.tzinfo, "key", None)
    if isinstance(key, str) and key:
        return key
    return fallback


def is_tier_import_window(dt: datetime) -> bool:
    local = dt.replace(tzinfo=None) if dt.tzinfo else dt
    start = datetime(2026, 6, 14)
    end = datetime(2026, 6, 17, 23, 59, 59)
    return start <= local <= end


def should_skip_mismatch(photos_dt: datetime, immich_dt: datetime) -> bool:
    """Skip when Mac still has import-day date but Immich already has the real capture date."""
    return is_tier_import_window(photos_dt) and not is_tier_import_window(immich_dt)


def collect_mismatches(
    config: dict,
    *,
    min_delta_days: int,
    asset_id: str | None,
    library_id: str | None = None,
) -> tuple[list[dict], int]:
    immich_by_checksum = load_immich_assets_by_checksum(config)
    if asset_id:
        immich_by_checksum = {
            checksum: asset for checksum, asset in immich_by_checksum.items() if str(asset.get("id")) == asset_id
        }

    mismatches: list[dict] = []
    checked = 0
    tz_default = default_timezone(config)

    for lib in config.get("libraries", []):
        if not lib.get("enabled", True):
            continue
        lib_id = lib.get("id")
        if library_id and lib_id != library_id:
            continue
        originals = expand(str(lib["path"]))
        photos_lib = photos_library_path(originals)
        db = osxphotos.PhotosDB(str(photos_lib))

        for photo in db.photos():
            if not photo.path:
                continue
            path = expand(str(photo.path))
            if not path.is_file():
                continue
            try:
                checksum = sha1_file(path)
            except OSError:
                continue
            asset = immich_by_checksum.get(checksum)
            if not asset:
                continue
            checked += 1
            photos_dt = photo.date
            immich_dt = parse_iso(asset.get("localDateTime") or asset.get("fileCreatedAt"))
            if not photos_dt or not immich_dt:
                continue
            if photos_dt.tzinfo is None:
                photos_dt = photos_dt.replace(tzinfo=ZoneInfo(tz_default))
            tz = ZoneInfo(tz_default)
            photos_local = photos_dt.astimezone(tz)
            immich_local = immich_dt.astimezone(tz)
            delta_days = abs((photos_local.date() - immich_local.date()).days)
            if delta_days < min_delta_days:
                continue
            if should_skip_mismatch(photos_dt, immich_dt):
                continue
            delta_seconds = int(
                abs((photos_dt.astimezone(timezone.utc) - immich_dt.astimezone(timezone.utc)).total_seconds())
            )
            mismatches.append(
                {
                    "asset_id": str(asset.get("id")),
                    "library_id": lib_id,
                    "filename": asset.get("originalFileName") or photo.original_filename,
                    "photos_uuid": photo.uuid,
                    "photos_date": photos_dt.isoformat(),
                    "immich_date": immich_dt.isoformat(),
                    "delta_seconds": delta_seconds,
                    "delta_days": delta_days,
                    "path": str(path),
                    "time_zone": iana_timezone(photos_dt, tz_default),
                    "date_time_original": photos_dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
                }
            )

    mismatches.sort(key=lambda row: row["delta_days"], reverse=True)
    return dedupe_mismatches_by_asset(mismatches), checked


def dedupe_mismatches_by_asset(mismatches: list[dict]) -> list[dict]:
    """One row per Immich asset; prefer local-archive over icloud-primary."""
    rank = {"local-archive": 0, "icloud-primary": 1}
    best: dict[str, dict] = {}
    for row in mismatches:
        aid = row["asset_id"]
        prev = best.get(aid)
        if prev is None:
            best[aid] = row
            continue
        if rank.get(row["library_id"], 9) < rank.get(prev["library_id"], 9):
            best[aid] = row
    return sorted(best.values(), key=lambda row: row["delta_days"], reverse=True)


def photos_dt_to_immich_iso(photos_dt: datetime, config: dict) -> str:
    """Immich bulk update expects UTC Z; offset isoformat often updates exif only."""
    if photos_dt.tzinfo is None:
        photos_dt = photos_dt.replace(tzinfo=ZoneInfo(default_timezone(config)))
    utc = photos_dt.astimezone(timezone.utc)
    text = utc.isoformat(timespec="milliseconds")
    return text.replace("+00:00", "Z")


def apply_fixes(
    config: dict,
    mismatches: list[dict],
    *,
    batch_size: int,
) -> list[dict]:
    base = immich_api_base(config)
    api_key = immich_api_key()
    applied: list[dict] = []

    for row in mismatches:
        body = {
            "ids": [row["asset_id"]],
            "dateTimeOriginal": photos_dt_to_immich_iso(
                datetime.fromisoformat(row["photos_date"]),
                config,
            ),
        }
        api_request(method="PUT", url=f"{base}/assets", api_key=api_key, body=body)
        applied.append({**row, "result": "updated"})
        if len(applied) % batch_size == 0:
            print(f"  fixed {len(applied)}/{len(mismatches)}…", flush=True)
    return applied


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        default=str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
    )
    parser.add_argument("--asset-id", help="Only check/fix one Immich asset id")
    parser.add_argument("--library-id", help="Only check/fix one Mac library id (e.g. local-archive)")
    parser.add_argument("--min-delta-days", type=int, default=1)
    parser.add_argument("--limit", type=int, default=50, help="Max mismatches to print")
    parser.add_argument("--apply", action="store_true", help="Apply dateTimeOriginal fixes")
    parser.add_argument("--confirm", action="store_true", help="Required with --apply")
    parser.add_argument("--output", help="Write JSON report path")
    args = parser.parse_args()

    if args.apply and not args.confirm:
        print("ERROR: --apply requires --confirm", file=sys.stderr)
        return 1

    config_path = expand(args.config)
    config = load_config(config_path)
    mismatches, checked = collect_mismatches(
        config,
        min_delta_days=args.min_delta_days,
        asset_id=args.asset_id,
        library_id=args.library_id,
    )

    applied: list[dict] = []
    if args.apply and mismatches:
        print(f"Applying date fixes to {len(mismatches)} asset(s)…", flush=True)
        applied = apply_fixes(config, mismatches, batch_size=20)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "checked_on_mac_with_immich_match": checked,
        "mismatch_count": len(mismatches),
        "min_delta_days": args.min_delta_days,
        "mode": "apply" if args.apply else "audit",
        "applied_count": len(applied),
        "mismatches": mismatches,
        "applied": applied,
    }

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    default_out = log_dir(config) / f"audit-dates-{stamp}.json"
    out = expand(args.output) if args.output else default_out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "checked_on_mac_with_immich_match": checked,
                "mismatch_count": len(mismatches),
                "applied_count": len(applied),
            },
            indent=2,
        )
    )
    for row in mismatches[: args.limit]:
        print(
            f"- {row['asset_id']}  Δ{row['delta_days']}d  "
            f"Photos={row['photos_date'][:10]}  Immich={row['immich_date'][:10]}  {row['filename']}"
        )
    print(f"\nFull report: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
