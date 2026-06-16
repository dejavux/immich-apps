"""Shared helpers for Phase 3.5 tier policy scripts."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any

import yaml

if TYPE_CHECKING:
    from osxphotos import PhotosDB
else:
    PhotosDB = Any


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


def tier_log_dir(config: dict) -> Path:
    log_dir = expand(config.get("sync", {}).get("log_dir", "~/Library/Logs/immich-photo-sync"))
    tier_dir = log_dir / "tier"
    tier_dir.mkdir(parents=True, exist_ok=True)
    return tier_dir


def staging_dir(config: dict, tier: dict) -> Path:
    raw = tier.get("staging_dir") or config.get("staging_dir")
    if raw:
        path = expand(str(raw))
    else:
        path = Path("/tmp/immich-photo-sync/tier-staging")
    path.mkdir(parents=True, exist_ok=True)
    return path


def state_path(config: dict) -> Path:
    return tier_log_dir(config) / "state.json"


def load_state(config: dict) -> dict:
    path = state_path(config)
    if not path.is_file():
        return {"imported_uuids": [], "exported_uuids": [], "runs": []}
    data = json.loads(path.read_text(encoding="utf-8"))
    data.setdefault("exported_uuids", [])
    data.setdefault("imported_uuids", [])
    data.setdefault("runs", [])
    return data


def save_state(config: dict, state: dict) -> None:
    path = state_path(config)
    path.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def photo_signature(photo) -> str | None:
    if not photo.fingerprint:
        return None
    filename = (photo.original_filename or photo.filename or "").lower()
    return f"{filename}:{photo.fingerprint}"


def eligible_photos(db: PhotosDB, cutoff_date: str) -> list:
    return [photo for photo in db.photos() if photo.date and photo.date.strftime("%Y-%m-%d") < cutoff_date]


def target_signatures(target_db: PhotosDB) -> set[str]:
    sigs: set[str] = set()
    for photo in target_db.photos():
        sig = photo_signature(photo)
        if sig:
            sigs.add(sig)
    return sigs


def is_shared_library(photo) -> bool:
    return bool(getattr(photo, "shared_library", False))


def has_local_original(photo) -> bool:
    return bool(photo.path and expand(str(photo.path)).is_file())


@lru_cache(maxsize=4)
def load_visible_uuids(source_lib: Path) -> frozenset[str]:
    db_path = source_lib / "database" / "Photos.sqlite"
    if not db_path.is_file():
        return frozenset()
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    rows = conn.execute(
        """
        SELECT ZUUID FROM ZASSET
        WHERE ZTRASHEDSTATE=0 AND ZVISIBILITYSTATE=0 AND ZCLOUDLOCALSTATE=1
        """
    ).fetchall()
    conn.close()
    return frozenset(row[0] for row in rows)


def is_visible_in_photos_app(photo, visible_uuids: frozenset[str]) -> bool:
    """Match Photos.app Library count (ZVISIBILITYSTATE=0, ZCLOUDLOCALSTATE=1)."""
    state = getattr(photo, "visibility_state", None)
    if state is not None:
        return int(state) == 0
    return photo.uuid in visible_uuids


def select_move_candidates(
    source_db: PhotosDB,
    target_sigs: set[str],
    *,
    cutoff_date: str,
    local_path_only: bool,
    skip_shared_library: bool,
    skip_ismissing: bool,
    processed_uuids: set[str],
    visible_only: bool = True,
) -> tuple[list, dict[str, int]]:
    counts = {
        "eligible_total": 0,
        "eligible_visible": 0,
        "skipped_already_processed": 0,
        "skipped_in_target": 0,
        "skipped_ismissing": 0,
        "skipped_no_local_path": 0,
        "skipped_shared_library": 0,
        "skipped_burst": 0,
        "skipped_not_visible": 0,
        "selected": 0,
    }
    selected: list = []
    visible_uuids: frozenset[str] = frozenset()
    if visible_only:
        visible_uuids = load_visible_uuids(Path(str(source_db.library_path)))
    for photo in eligible_photos(source_db, cutoff_date):
        counts["eligible_total"] += 1
        if visible_only:
            if not is_visible_in_photos_app(photo, visible_uuids):
                counts["skipped_not_visible"] += 1
                continue
            counts["eligible_visible"] += 1
        if photo.uuid in processed_uuids:
            counts["skipped_already_processed"] += 1
            continue
        sig = photo_signature(photo)
        if sig and sig in target_sigs:
            counts["skipped_in_target"] += 1
            continue
        if skip_ismissing and photo.ismissing:
            counts["skipped_ismissing"] += 1
            continue
        if local_path_only and not has_local_original(photo):
            counts["skipped_no_local_path"] += 1
            continue
        if skip_shared_library and is_shared_library(photo):
            counts["skipped_shared_library"] += 1
            continue
        if photo.burst:
            counts["skipped_burst"] += 1
            continue
        selected.append(photo)
        counts["selected"] += 1
    selected.sort(key=lambda photo: (photo.date or datetime.min, photo.uuid))
    return selected, counts


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def report_path(config: dict, prefix: str) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return tier_log_dir(config) / f"{prefix}-{stamp}.json"
