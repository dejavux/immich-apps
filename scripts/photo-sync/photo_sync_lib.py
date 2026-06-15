"""Shared helpers for Mac Photo Sync scripts (upload, tier policy, reconcile)."""

from __future__ import annotations

import base64
import binascii
import hashlib
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import yaml

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

IMAGE_EXT = {".jpg", ".jpeg", ".heic", ".heif", ".png", ".gif", ".tif", ".tiff", ".webp"}


def expand(path: str) -> Path:
    return Path(os.path.expanduser(path))


def load_config(config_path: Path) -> dict:
    with config_path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def sha1_file(path: Path, chunk: int = 1024 * 1024) -> str:
    digest = hashlib.sha1()
    with path.open("rb") as fh:
        while True:
            block = fh.read(chunk)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


def normalize_checksum(value: str | None) -> str | None:
    """Return lowercase hex SHA1 for Immich base64 or hex checksum strings."""
    if not value:
        return None
    raw = value.strip()
    if len(raw) == 40 and all(ch in "0123456789abcdefABCDEF" for ch in raw):
        return raw.lower()
    try:
        decoded = base64.b64decode(raw, validate=True)
    except (ValueError, binascii.Error):
        return None
    if len(decoded) != 20:
        return None
    return decoded.hex()


def paths_for_import(file_paths: list[Path]) -> list[Path]:
    """Drop Live Photo companion video when a still image exists in the same folder."""
    by_dir: dict[Path, list[Path]] = defaultdict(list)
    for path in file_paths:
        if path.is_file():
            by_dir[path.parent].append(path)

    selected: list[Path] = []
    for files in by_dir.values():
        image_stems = {p.stem.lower() for p in files if p.suffix.lower() in IMAGE_EXT}
        for path in sorted(files):
            if path.suffix.lower() in {".mov", ".mp4", ".m4v"} and path.stem.lower() in image_stems:
                continue
            selected.append(path)
    return sorted(selected)


def primary_checksum(file_paths: list[Path]) -> str | None:
    """Checksum of the primary upload file (matches immich-sync Live Photo filter)."""
    import_paths = paths_for_import(file_paths)
    for path in import_paths:
        if path.suffix.lower() not in MEDIA_EXT:
            continue
        try:
            return sha1_file(path)
        except OSError:
            continue
    return None


def originals_root(library: dict) -> Path:
    raw = expand(str(library["path"]))
    if raw.name == "originals":
        return raw
    if raw.suffix == ".photoslibrary":
        return raw / "originals"
    raise SystemExit(f"cannot derive originals path from library config: {raw}")


def scan_originals_inventory(root: Path, library_id: str) -> dict[str, set[str]]:
    """Map hex checksum → library ids that still have the file on disk."""
    inventory: dict[str, set[str]] = defaultdict(set)
    if not root.is_dir():
        return inventory

    for dirpath, _, filenames in os.walk(root):
        for name in filenames:
            path = Path(dirpath) / name
            if path.suffix.lower() not in MEDIA_EXT:
                continue
            try:
                checksum = sha1_file(path)
            except OSError:
                continue
            inventory[checksum].add(library_id)
    return inventory


def build_mac_refcount(
    config: dict,
    *,
    library_ids: list[str] | None = None,
) -> tuple[dict[str, int], dict[str, list[str]]]:
    """Return checksum → refcount and checksum → library id list."""
    refcount: dict[str, int] = defaultdict(int)
    libraries_by_checksum: dict[str, list[str]] = defaultdict(list)

    for lib in config.get("libraries", []):
        lib_id = lib.get("id")
        if not lib_id or not lib.get("enabled", True):
            continue
        if library_ids and lib_id not in library_ids:
            continue
        root = originals_root(lib)
        partial = scan_originals_inventory(root, lib_id)
        for checksum, ids in partial.items():
            refcount[checksum] += len(ids)
            for lib_name in sorted(ids):
                if lib_name not in libraries_by_checksum[checksum]:
                    libraries_by_checksum[checksum].append(lib_name)

    return dict(refcount), dict(libraries_by_checksum)


def sync_settings(config: dict) -> dict:
    return config.get("sync") or {}


def delete_policy(config: dict) -> str:
    value = sync_settings(config).get("delete_policy", "none")
    if value not in {"none", "conservative"}:
        raise SystemExit(f"unsupported sync.delete_policy: {value!r} (expected none|conservative)")
    return value


def reconcile_settings(config: dict) -> dict:
    defaults = {
        "enabled": False,
        "scope": "albums",
        "immich_albums": None,
        "immich_tags": [],
        "batch_size": 100,
        "fetch_page_size": 500,
        "grace_days": 7,
        "action": "trash",
        "schedule": "0 4 * * 0",
    }
    merged = {**defaults, **(sync_settings(config).get("reconcile") or {})}
    return merged


def reconcile_album_names(config: dict) -> list[str]:
    reconcile = reconcile_settings(config)
    explicit = reconcile.get("immich_albums")
    if explicit:
        return [str(name) for name in explicit if name]
    names: list[str] = []
    for lib in config.get("libraries", []):
        if not lib.get("enabled", True):
            continue
        album = lib.get("album") or lib.get("name") or lib.get("id")
        if album and album not in names:
            names.append(str(album))
    return names


def log_dir(config: dict) -> Path:
    path = expand(sync_settings(config).get("log_dir", "~/Library/Logs/immich-photo-sync"))
    path.mkdir(parents=True, exist_ok=True)
    return path


def reconcile_log_dir(config: dict) -> Path:
    path = log_dir(config) / "reconcile"
    path.mkdir(parents=True, exist_ok=True)
    return path


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()
