#!/usr/bin/env python3
"""Photos.app GUI helpers: delete UUIDs via staging album, purge Recently Deleted."""

from __future__ import annotations

import argparse
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from photo_sync_lib import expand, load_config, photos_library_path
from tier_policy_delete_source import add_photos_to_album, ensure_album, gui_delete_album_contents
from tier_policy_lib import library_by_id

try:
    import photoscript
    from photoscript.exceptions import AppleScriptError
except ImportError as exc:
    raise SystemExit("photoscript required: pip3 install --user photoscript") from exc


def trashed_count(photos_library: Path) -> int:
    db_path = photos_library / "database" / "Photos.sqlite"
    if not db_path.is_file():
        return 0
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        row = conn.execute("SELECT COUNT(*) FROM ZASSET WHERE ZTRASHEDSTATE=1").fetchone()
    except sqlite3.Error:
        return 0
    finally:
        conn.close()
    return int(row[0]) if row else 0


def purge_recently_deleted(*, dry_run: bool) -> None:
    count = trashed_count(expand("~/Pictures/Photos Library.photoslibrary"))
    print(f"Recently Deleted (sqlite ZTRASHEDSTATE=1): {count}")
    if dry_run:
        print("DRY-RUN: would open Photos → Recently Deleted → Delete All")
        return
    if count == 0:
        print("Nothing in Recently Deleted; skip GUI purge.")
        return

    subprocess.run(["open", "-a", "Photos"], check=False)
    time.sleep(3)
    script = r"""
on run
    tell application "Photos" to activate
    delay 2
    tell application "System Events"
        tell process "Photos"
            set frontmost to true
            delay 1
            set sb to scroll area 1 of group 1 of group 1 of splitter group 1 of group 1 of window 1
            set sidebar to UI element 1 of sb
            set clicked to false
            repeat with labelText in {"最近删除", "最近刪除", "Recently Deleted"}
                try
                    click static text labelText of sidebar
                    set clicked to true
                    exit repeat
                end try
            end repeat
            if clicked is false then
                error "Could not open Recently Deleted sidebar item"
            end if
            delay 2
            set deleted to false
            repeat with btnName in {"全部删除", "全部刪除", "Delete All"}
                try
                    click button btnName of window 1
                    set deleted to true
                    exit repeat
                end try
            end repeat
            if deleted is false then
                error "Could not find Delete All button"
            end if
            delay 1
            repeat with confirmName in {"删除", "刪除", "Delete", "OK"}
                try
                    click button confirmName of sheet 1 of window 1
                    exit repeat
                end try
            end repeat
        end tell
    end tell
end run
"""
    proc = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        detail = proc.stderr.strip() or proc.stdout.strip() or "purge GUI failed"
        raise RuntimeError(detail)
    time.sleep(5)
    after = trashed_count(expand("~/Pictures/Photos Library.photoslibrary"))
    print(f"After purge trashed count: {after}")


def delete_uuids(
    *,
    uuids: list[str],
    photos_library: Path,
    album_name: str,
    dry_run: bool,
) -> None:
    if not uuids:
        print("No UUIDs to delete.")
        return
    print(f"Delete {len(uuids)} item(s) from {photos_library} via album {album_name!r}")
    if dry_run:
        for uid in uuids:
            print(f"  DRY-RUN: {uid}")
        return

    lib = photoscript.PhotosLibrary()
    lib.open(str(photos_library), delay=8)
    subprocess.run(["open", "-a", "Photos", str(photos_library)], check=False)
    time.sleep(3)
    album = ensure_album(lib, album_name)
    attempted, errors = add_photos_to_album(album, uuids, chunk_size=25)
    print(f"Added {attempted}/{len(uuids)} to album; errors={len(errors)}")
    if errors:
        for line in errors[:10]:
            print(f"  {line}", file=sys.stderr)
    time.sleep(2)
    gui_delete_album_contents(album_name, dry_run=False)
    time.sleep(2)
    try:
        lib.delete_album(album)
    except AppleScriptError as exc:
        print(f"album cleanup: {exc}", file=sys.stderr)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Photos GUI delete / purge helpers")
    parser.add_argument(
        "--config",
        default=str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
    )
    sub = parser.add_subparsers(dest="command", required=True)

    purge = sub.add_parser("purge-recently-deleted", help="Photos → Recently Deleted → Delete All")
    purge.add_argument("--dry-run", action="store_true")

    delete = sub.add_parser("delete-uuids", help="Move UUIDs to Recently Deleted via staging album")
    delete.add_argument("uuids", nargs="+")
    delete.add_argument("--album", default="Reconcile-Delete")
    delete.add_argument("--library-id", default="icloud-primary")
    delete.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.command == "purge-recently-deleted":
        purge_recently_deleted(dry_run=args.dry_run)
        return 0

    config = load_config(expand(args.config))
    source_cfg = library_by_id(config, args.library_id)
    photos_lib = photos_library_path(source_cfg)
    delete_uuids(
        uuids=args.uuids,
        photos_library=photos_lib,
        album_name=args.album,
        dry_run=args.dry_run,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
