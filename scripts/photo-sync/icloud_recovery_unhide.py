#!/usr/bin/env python3
"""Restore icloud-primary photos hidden with ZVISIBILITYSTATE=2 (not in Recently Deleted).

Export+re-import does not work: osxphotos --skip-dups matches hidden assets and skips them.
This script backs up Photos.sqlite, quits Photos, sets visibility back to 0, reopens Photos.
"""

from __future__ import annotations

import argparse
import shutil
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from photo_sync_lib import expand, load_config, photos_library_path
from tier_policy_lib import library_by_id

LOG_ROOT = expand("~/Library/Logs/immich-photo-sync/recovery")


def visibility_counts(photos_library: Path) -> dict[str, int]:
    db_path = photos_library / "database" / "Photos.sqlite"
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        visible = conn.execute("SELECT COUNT(*) FROM ZASSET WHERE ZTRASHEDSTATE=0 AND ZVISIBILITYSTATE=0").fetchone()[0]
        hidden = conn.execute("SELECT COUNT(*) FROM ZASSET WHERE ZTRASHEDSTATE=0 AND ZVISIBILITYSTATE=2").fetchone()[0]
        trashed = conn.execute("SELECT COUNT(*) FROM ZASSET WHERE ZTRASHEDSTATE=1").fetchone()[0]
    finally:
        conn.close()
    return {"visible": int(visible), "hidden": int(hidden), "trashed": int(trashed)}


def backup_database(photos_library: Path) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dest = LOG_ROOT / f"Photos.sqlite.backup-{stamp}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    src = photos_library / "database" / "Photos.sqlite"
    shutil.copy2(src, dest)
    for suffix in ("-wal", "-shm"):
        side = Path(str(src) + suffix)
        if side.is_file():
            shutil.copy2(side, Path(str(dest) + suffix))
    return dest


def quit_photos() -> None:
    subprocess.run(
        ["osascript", "-e", 'tell application "Photos" to quit'],
        capture_output=True,
        text=True,
        check=False,
    )
    for _ in range(30):
        proc = subprocess.run(["pgrep", "-x", "Photos"], capture_output=True, check=False)
        if proc.returncode != 0:
            return
        time.sleep(1)
    raise RuntimeError("Photos did not quit within 30s; quit manually and retry.")


def open_photos(photos_library: Path) -> None:
    subprocess.run(["open", "-a", "Photos", str(photos_library)], check=False)
    time.sleep(5)


def unhide_hidden_assets(
    photos_library: Path,
    *,
    limit: int | None,
    dry_run: bool,
) -> int:
    db_path = photos_library / "database" / "Photos.sqlite"
    conn = sqlite3.connect(db_path)
    try:
        if limit is None:
            hidden = conn.execute(
                "SELECT COUNT(*) FROM ZASSET WHERE ZTRASHEDSTATE=0 AND ZVISIBILITYSTATE=2"
            ).fetchone()[0]
        else:
            hidden = conn.execute(
                """
                SELECT COUNT(*) FROM ZASSET
                WHERE ZTRASHEDSTATE=0 AND ZVISIBILITYSTATE=2
                LIMIT ?
                """,
                (limit,),
            ).fetchone()[0]
        print(f"hidden candidates: {hidden}" + (f" (limit {limit})" if limit else ""))
        if dry_run:
            return int(hidden)
        if limit is None:
            cur = conn.execute(
                """
                UPDATE ZASSET
                SET ZVISIBILITYSTATE = 0
                WHERE ZTRASHEDSTATE = 0 AND ZVISIBILITYSTATE = 2
                """
            )
        else:
            uuids = [
                row[0]
                for row in conn.execute(
                    """
                    SELECT ZUUID FROM ZASSET
                    WHERE ZTRASHEDSTATE=0 AND ZVISIBILITYSTATE=2
                    LIMIT ?
                    """,
                    (limit,),
                )
            ]
            placeholders = ",".join("?" for _ in uuids)
            cur = conn.execute(
                f"""
                UPDATE ZASSET
                SET ZVISIBILITYSTATE = 0
                WHERE ZUUID IN ({placeholders})
                """,
                uuids,
            )
        conn.commit()
        return int(cur.rowcount)
    finally:
        conn.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Unhide ZVISIBILITYSTATE=2 photos in icloud-primary")
    parser.add_argument(
        "--config",
        default=str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
    )
    parser.add_argument("--library-id", default="icloud-primary")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None, help="Unhide only N assets (pilot)")
    parser.add_argument("--skip-quit", action="store_true", help="Do not quit Photos (unsafe)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = load_config(expand(args.config))
    photos_lib = photos_library_path(library_by_id(config, args.library_id))

    before = visibility_counts(photos_lib)
    print(f"Before: visible={before['visible']} hidden={before['hidden']}")

    if args.dry_run:
        unhide_hidden_assets(photos_lib, limit=args.limit, dry_run=True)
        return 0

    backup = backup_database(photos_lib)
    print(f"Backup: {backup}")

    if not args.skip_quit:
        print("Quitting Photos...")
        quit_photos()

    updated = unhide_hidden_assets(photos_lib, limit=args.limit, dry_run=False)
    print(f"Updated ZVISIBILITYSTATE 2→0: {updated}")

    if not args.skip_quit:
        print("Reopening Photos...")
        open_photos(photos_lib)

    after = visibility_counts(photos_lib)
    print(f"After: visible={after['visible']} hidden={after['hidden']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
