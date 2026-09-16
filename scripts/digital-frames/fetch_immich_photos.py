#!/usr/bin/env python3
"""Fetch diverse recent photos from Immich for frame albums."""
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import requests

from paths import BEST2025_DIR, MANIFEST_PATH as DEFAULT_MANIFEST

API_KEY = os.environ.get("IMMICH_API_KEY")
BASE_URL = os.environ.get("IMMICH_BASE_URL")
OUTPUT_DIR = Path(os.environ.get("PHOTOS_OUTPUT_DIR", BEST2025_DIR))
MANIFEST_PATH = Path(os.environ.get("PHOTOS_MANIFEST", DEFAULT_MANIFEST))
COUNT = int(os.environ.get("PHOTO_COUNT", "100"))
TRAVEL_COUNT = int(os.environ.get("TRAVEL_COUNT", COUNT // 2))
DAILY_COUNT = int(os.environ.get("DAILY_COUNT", COUNT - TRAVEL_COUNT))
MAX_PER_DAY = int(os.environ.get("MAX_PHOTOS_PER_DAY", "2"))
TRAVEL_MAX_PER_DAY = int(os.environ.get("TRAVEL_MAX_PER_DAY", "3"))
DAILY_MAX_PER_DAY = int(os.environ.get("DAILY_MAX_PER_DAY", MAX_PER_DAY))
LOOKBACK_DAYS = int(os.environ.get("LOOKBACK_DAYS", "365"))

HOME_COUNTRY_MARKERS = ("taiwan", "台灣", "臺灣")
TRAVEL_TAG_MARKERS = (
    "family-trip",
    "trip",
    "day1",
    "day2",
    "day3",
    "day4",
    "day5",
    "day6",
    "day7",
    "day8",
    "day9",
    "京阪神",
    "環球",
    "usj",
    "大阪",
    "神戶",
    "神户",
    "關西",
    "日本",
    "japan",
    "kobe",
    "osaka",
    "kyoto",
    "highlight-candidate",
)

# Common iPhone screenshot dimensions (portrait and landscape).
SCREENSHOT_SIZES = {
    (1290, 2796),
    (2796, 1290),
    (1170, 2532),
    (2532, 1170),
    (1284, 2778),
    (2778, 1284),
    (1242, 2688),
    (2688, 1242),
    (828, 1792),
    (1792, 828),
    (750, 1334),
    (1334, 750),
    (1080, 1920),
    (1920, 1080),
}

CREATIVE_NAME_MARKERS = (
    "collage",
    "grid",
    "case-",
    "screenshot",
    "screen shot",
    "screen_shot",
)


def capture_dt(asset: dict) -> datetime | None:
    exif = asset.get("exifInfo") or {}
    for key in ("dateTimeOriginal", "localDateTime", "createDate"):
        value = exif.get(key)
        if value:
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00").split("+")[0])
            except ValueError:
                continue
    for key in ("localDateTime", "fileCreatedAt"):
        value = asset.get(key)
        if value:
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00").split("+")[0])
            except ValueError:
                continue
    return None


def day_key(asset: dict) -> str | None:
    dt = capture_dt(asset)
    return dt.strftime("%Y-%m-%d") if dt else None


def image_size(asset: dict) -> tuple[int, int] | None:
    exif = asset.get("exifInfo") or {}
    width = exif.get("exifImageWidth") or asset.get("width")
    height = exif.get("exifImageHeight") or asset.get("height")
    try:
        return int(width), int(height)
    except (TypeError, ValueError):
        return None


def is_screenshot(asset: dict) -> bool:
    size = image_size(asset)
    return bool(size and size in SCREENSHOT_SIZES)


def is_creative_or_saved(asset: dict) -> bool:
    name = (asset.get("originalFileName") or "").lower()
    if name.endswith(".png"):
        return True
    return any(marker in name for marker in CREATIVE_NAME_MARKERS)


def is_real_camera_photo(asset: dict) -> bool:
    exif = asset.get("exifInfo") or {}
    lens = (exif.get("lensModel") or "").lower()
    model = (exif.get("model") or "").lower()
    make = (exif.get("make") or "").lower()
    if "camera" in lens:
        return True
    if "iphone" in model:
        return True
    return bool(make and model and make not in {"apple computer inc."})


def has_gps(asset: dict) -> bool:
    exif = asset.get("exifInfo") or {}
    return exif.get("latitude") is not None


def is_interesting_photo(asset: dict) -> bool:
    """Keep photos with detected people; favorites still need at least one face."""
    people = asset.get("people") or []
    if people:
        return True
    return False


def quality_score(asset: dict) -> int:
    score = 0
    if asset.get("isFavorite"):
        score += 10
    score += 5 * len(asset.get("people") or [])
    if has_gps(asset):
        score += 2
    if is_real_camera_photo(asset):
        score += 5
    exif = asset.get("exifInfo") or {}
    if exif.get("lensModel"):
        score += 2
    return score


def enrich_asset(asset: dict, headers: dict) -> dict:
    """Search results often omit faces/tags; fetch full asset once."""
    if asset.get("_enriched"):
        return asset
    response = requests.get(
        f"{BASE_URL}/api/assets/{asset['id']}",
        headers=headers,
        timeout=30,
    )
    if response.status_code != 200:
        return asset
    full = response.json()
    return {
        **asset,
        "people": full.get("people") or [],
        "tags": full.get("tags") or [],
        "isFavorite": full.get("isFavorite", asset.get("isFavorite", False)),
        "_enriched": True,
    }


def tag_blob(asset: dict) -> str:
    return " ".join((t.get("name") or "") for t in asset.get("tags") or []).lower()


def is_home_country(country: str) -> bool:
    lowered = country.lower()
    return any(marker in lowered for marker in HOME_COUNTRY_MARKERS)


def is_travel_photo(asset: dict) -> bool:
    tags = tag_blob(asset)
    if any(marker in tags for marker in TRAVEL_TAG_MARKERS):
        return True
    if any(tag.startswith("day") and "-" in tag for tag in tags.split()):
        return True
    exif = asset.get("exifInfo") or {}
    country = (exif.get("country") or "").strip()
    if country and not is_home_country(country):
        return True
    return False


def photo_category(asset: dict) -> str:
    return "travel" if is_travel_photo(asset) else "daily"


def filter_eligible(assets: list[dict], headers: dict) -> tuple[list[dict], dict[str, int]]:
    eligible: list[dict] = []
    stats: dict[str, int] = {}
    for asset in assets:
        if is_creative_or_saved(asset):
            stats["creative_or_screenshot_asset"] = stats.get("creative_or_screenshot_asset", 0) + 1
            continue
        if is_screenshot(asset):
            stats["screenshot_dimensions"] = stats.get("screenshot_dimensions", 0) + 1
            continue
        if not is_real_camera_photo(asset):
            stats["not_real_camera"] = stats.get("not_real_camera", 0) + 1
            continue
        mime = (asset.get("originalMimeType") or "").lower()
        if mime and mime not in {"image/heic", "image/heif", "image/jpeg", "image/jpg"}:
            stats["unsupported_mime"] = stats.get("unsupported_mime", 0) + 1
            continue
        asset = enrich_asset(asset, headers)
        if (asset.get("originalMimeType") or "").lower() not in {
            "image/heic",
            "image/heif",
            "image/jpeg",
            "image/jpg",
        }:
            stats["unsupported_mime"] = stats.get("unsupported_mime", 0) + 1
            continue
        exif = asset.get("exifInfo") or {}
        width = exif.get("exifImageWidth") or asset.get("width")
        height = exif.get("exifImageHeight") or asset.get("height")
        try:
            if int(width) < 2000 or int(height) < 2000:
                stats["too_small"] = stats.get("too_small", 0) + 1
                continue
        except (TypeError, ValueError):
            stats["too_small"] = stats.get("too_small", 0) + 1
            continue
        if not is_interesting_photo(asset):
            stats["low_interest"] = stats.get("low_interest", 0) + 1
            continue
        eligible.append(asset)
    return eligible, stats


def spread_pick(day_assets: list[dict], limit: int) -> list[dict]:
    """Pick up to `limit` photos spread across the day (reduce burst duplicates)."""
    if len(day_assets) <= limit:
        return sorted(day_assets, key=lambda a: -quality_score(a))
    ranked = sorted(
        day_assets,
        key=lambda a: (
            -quality_score(a),
            not a.get("isFavorite"),
            capture_dt(a) or datetime.min,
        ),
    )
    if limit == 1:
        return [ranked[0]]
    step = max(1, (len(ranked) - 1) // (limit - 1))
    picked = [ranked[min(i * step, len(ranked) - 1)] for i in range(limit)]
    seen = set()
    out = []
    for asset in picked:
        if asset["id"] not in seen:
            seen.add(asset["id"])
            out.append(asset)
    return out[:limit]


def select_diverse(assets: list[dict], count: int, max_per_day: int) -> list[dict]:
    by_day: dict[str, list[dict]] = defaultdict(list)
    for asset in assets:
        key = day_key(asset)
        if key:
            by_day[key].append(asset)

    days = sorted(by_day, reverse=True)
    selected: list[dict] = []
    per_day_count: dict[str, int] = defaultdict(int)

    while len(selected) < count:
        added = False
        for day in days:
            if per_day_count[day] >= max_per_day:
                continue
            pool = by_day[day]
            picks = spread_pick(pool, max_per_day)
            idx = per_day_count[day]
            if idx >= len(picks):
                continue
            selected.append(picks[idx])
            per_day_count[day] += 1
            added = True
            if len(selected) >= count:
                break
        if not added:
            break

    return selected[:count]


def select_balanced(
    assets: list[dict],
    travel_count: int,
    daily_count: int,
) -> list[dict]:
    travel_pool = [a for a in assets if photo_category(a) == "travel"]
    daily_pool = [a for a in assets if photo_category(a) == "daily"]
    selected_travel = select_diverse(travel_pool, travel_count, TRAVEL_MAX_PER_DAY)
    selected_daily = select_diverse(daily_pool, daily_count, DAILY_MAX_PER_DAY)
    merged = selected_travel + selected_daily
    merged.sort(key=lambda a: capture_dt(a) or datetime.min, reverse=True)
    return merged


def fetch_recent_assets(headers: dict, cutoff: datetime) -> list[dict]:
    # Wide import window, then filter by capture date in Python.
    all_assets: list[dict] = []
    page = 1
    while True:
        response = requests.post(
            f"{BASE_URL}/api/search/metadata",
            headers=headers,
            json={
                "createdAfter": cutoff.isoformat() + "Z",
                "type": "IMAGE",
                "withExif": True,
                "size": 250,
                "page": page,
            },
            timeout=60,
        )
        response.raise_for_status()
        items = response.json().get("assets", {}).get("items", [])
        if not items:
            break
        all_assets.extend(items)
        if len(items) < 250:
            break
        page += 1

    recent = [
        asset
        for asset in all_assets
        if (dt := capture_dt(asset)) and dt >= cutoff.replace(tzinfo=None)
    ]
    return recent


def download_assets(headers: dict, assets: list[dict], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for old in output_dir.glob("photo_*.*"):
        old.unlink()
    for i, asset in enumerate(assets):
        asset_id = asset["id"]
        response = requests.get(
            f"{BASE_URL}/api/assets/{asset_id}/original",
            headers=headers,
            timeout=120,
        )
        if response.status_code != 200:
            print(f"Failed to download {asset_id}: HTTP {response.status_code}")
            continue
        ext = asset.get("originalFileName", "photo.jpg").split(".")[-1].lower()
        if ext not in {"jpg", "jpeg", "png", "heic"}:
            ext = "jpg"
        path = output_dir / f"photo_{i:03d}.{ext}"
        path.write_bytes(response.content)


def main() -> None:
    if not API_KEY or not BASE_URL:
        print("Missing IMMICH_API_KEY or IMMICH_BASE_URL", file=sys.stderr)
        sys.exit(1)

    headers = {"Accept": "application/json", "x-api-key": API_KEY}
    cutoff = datetime.now() - timedelta(days=LOOKBACK_DAYS)

    print(f"Fetching images (capture date >= {cutoff.date()})...")
    recent = fetch_recent_assets(headers, cutoff)
    print(f"Recent by capture date: {len(recent)}")

    eligible, excluded = filter_eligible(recent, headers)
    if excluded:
        print("Excluded:", ", ".join(f"{k}={v}" for k, v in sorted(excluded.items())))
    print(f"Eligible after quality filter: {len(eligible)}")

    travel_pool = sum(1 for a in eligible if photo_category(a) == "travel")
    daily_pool = sum(1 for a in eligible if photo_category(a) == "daily")
    print(f"Eligible split: travel={travel_pool}, daily={daily_pool}")

    selected = select_balanced(eligible, TRAVEL_COUNT, DAILY_COUNT)
    travel_selected = sum(1 for a in selected if photo_category(a) == "travel")
    daily_selected = sum(1 for a in selected if photo_category(a) == "daily")
    print(
        f"Selected {len(selected)} photos "
        f"(travel={travel_selected}, daily={daily_selected}, max {MAX_PER_DAY}/day)"
    )

    if len(selected) < COUNT:
        print(f"Warning: only {len(selected)} photos available", file=sys.stderr)
    if travel_selected < TRAVEL_COUNT or daily_selected < DAILY_COUNT:
        print(
            f"Warning: target split {TRAVEL_COUNT}/{DAILY_COUNT} "
            f"got {travel_selected}/{daily_selected}",
            file=sys.stderr,
        )

    manifest = []
    for i, asset in enumerate(selected):
        dt = capture_dt(asset)
        manifest.append(
            {
                "index": i,
                "assetId": asset["id"],
                "fileName": asset.get("originalFileName"),
                "captureDate": dt.isoformat() if dt else None,
                "day": day_key(asset),
                "isFavorite": asset.get("isFavorite", False),
                "peopleCount": len(asset.get("people") or []),
                "category": photo_category(asset),
                "qualityScore": quality_score(asset),
            }
        )

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    print(f"Wrote manifest: {MANIFEST_PATH}")

    download_assets(headers, selected, OUTPUT_DIR)
    print(f"Downloaded to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
