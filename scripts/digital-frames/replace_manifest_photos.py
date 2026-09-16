#!/usr/bin/env python3
"""Replace specific manifest slots with new Immich picks and refresh uploads."""
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

import requests

from fetch_immich_photos import (
    API_KEY,
    BASE_URL,
    LOOKBACK_DAYS,
    OUTPUT_DIR,
    capture_dt,
    day_key,
    download_assets,
    enrich_asset,
    fetch_recent_assets,
    filter_eligible,
    photo_category,
    quality_score,
)
from paths import MANIFEST_PATH, UPLOAD_DIR

REPO = Path(__file__).resolve().parent
REPLACE_INDICES = [
    int(x)
    for x in os.environ.get("REPLACE_INDICES", "20,21,22,44").split(",")
    if x.strip()
]


def pick_replacement(
    pool: list[dict],
    category: str,
    *,
    avoid_day: str | None,
) -> dict | None:
    candidates = [a for a in pool if photo_category(a) == category]
    if not candidates:
        return None

    def rank(asset: dict) -> tuple:
        people = len(asset.get("people") or [])
        dt = capture_dt(asset) or datetime.min
        day = day_key(asset) or ""
        return (
            people >= 2,
            people >= 1,
            people,
            quality_score(asset),
            int(asset.get("isFavorite", False)),
            day != avoid_day,
            dt,
        )

    candidates.sort(key=rank, reverse=True)
    for asset in candidates:
        if len(asset.get("people") or []) >= 1:
            return asset
    return None


def download_one(headers: dict, asset: dict, index: int, output_dir: Path) -> Path:
    response = requests.get(
        f"{BASE_URL}/api/assets/{asset['id']}/original",
        headers=headers,
        timeout=120,
    )
    response.raise_for_status()
    ext = asset.get("originalFileName", "photo.jpg").split(".")[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "heic"}:
        ext = "jpg"
    path = output_dir / f"photo_{index:03d}.{ext}"
    path.write_bytes(response.content)
    return path


def build_upload_jpeg(heic_or_jpg: Path, out_jpg: Path) -> None:
    max_dim = os.environ.get("MAX_DIM", "1920")
    quality = os.environ.get("JPEG_QUALITY", "85")
    subprocess.run(
        [
            "sips",
            "-Z",
            max_dim,
            "-s",
            "format",
            "jpeg",
            "-s",
            "formatOptions",
            quality,
            str(heic_or_jpg),
            "--out",
            str(out_jpg),
        ],
        check=True,
        capture_output=True,
    )


def manifest_entry(index: int, asset: dict) -> dict:
    dt = capture_dt(asset)
    return {
        "index": index,
        "assetId": asset["id"],
        "fileName": asset.get("originalFileName"),
        "captureDate": dt.isoformat() if dt else None,
        "day": day_key(asset),
        "isFavorite": asset.get("isFavorite", False),
        "peopleCount": len(asset.get("people") or []),
        "category": photo_category(asset),
        "qualityScore": quality_score(asset),
    }


def main() -> None:
    if not API_KEY or not BASE_URL:
        print("Missing IMMICH_API_KEY or IMMICH_BASE_URL", file=sys.stderr)
        sys.exit(1)

    manifest = json.loads(MANIFEST_PATH.read_text())
    headers = {"Accept": "application/json", "x-api-key": API_KEY}
    cutoff = datetime.now() - timedelta(days=LOOKBACK_DAYS)

    used_ids = {entry["assetId"] for entry in manifest}
    recent = fetch_recent_assets(headers, cutoff)
    eligible, _ = filter_eligible(recent, headers)
    pool = [a for a in eligible if a["id"] not in used_ids]
    print(f"Replacement pool: {len(pool)} assets")

    replacements: list[tuple[int, dict, dict]] = []
    for index in REPLACE_INDICES:
        old = manifest[index]
        pick = pick_replacement(pool, old["category"], avoid_day=old.get("day"))
        if not pick:
            print(f"No replacement for photo_{index:03d} ({old['category']})", file=sys.stderr)
            sys.exit(1)
        pool = [a for a in pool if a["id"] != pick["id"]]
        replacements.append((index, old, pick))
        manifest[index] = manifest_entry(index, pick)
        print(
            f"photo_{index:03d}: {old['fileName']} -> {pick.get('originalFileName')} "
            f"people={len(pick.get('people') or [])} score={quality_score(pick)}"
        )

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    print(f"Updated {MANIFEST_PATH}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    for index, _, pick in replacements:
        path = download_one(headers, pick, index, OUTPUT_DIR)
        build_upload_jpeg(path, UPLOAD_DIR / f"photo_{index:03d}.jpg")
        print(f"Wrote {path.name} + upload JPEG")

    summary = {
        "replaced": [
            {
                "index": index,
                "oldAssetId": old["assetId"],
                "newAssetId": pick["id"],
                "newFileName": pick.get("originalFileName"),
            }
            for index, old, pick in replacements
        ]
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
