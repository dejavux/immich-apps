#!/usr/bin/env python3
"""Delete tier-policy verified items from icloud-primary via Photos album + GUI."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tier_policy_lib import (
    expand,
    library_by_id,
    load_config,
    photo_signature,
    photos_library_path,
    target_signatures,
    tier_log_dir,
    utc_now,
)

try:
    import osxphotos
    import photoscript
except ImportError as exc:
    raise SystemExit("osxphotos and photoscript required") from exc


def collect_uuids(*, manifests: list[Path], state_path: Path) -> list[str]:
    uuids: list[str] = []
    seen: set[str] = set()
    for path in manifests:
        if not path.is_file():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for item in data.get("items", []):
            uid = item.get("uuid")
            if uid and uid not in seen:
                seen.add(uid)
                uuids.append(uid)

    if state_path.is_file():
        state = json.loads(state_path.read_text(encoding="utf-8"))
        for uid in state.get("imported_uuids", []):
            if uid not in seen:
                seen.add(uid)
                uuids.append(uid)
    return uuids


def verify_target_present(
    *,
    source_db: osxphotos.PhotosDB,
    target_db: osxphotos.PhotosDB,
    target_sigs: set[str],
    uuids: list[str],
) -> tuple[list[str], list[str]]:
    by_filename: dict[str, list] = {}
    for target_photo in target_db.photos():
        name = (target_photo.original_filename or target_photo.filename or "").lower()
        if name:
            by_filename.setdefault(name, []).append(target_photo)

    ok: list[str] = []
    missing: list[str] = []
    for uid in uuids:
        photo = source_db.get_photo(uid)
        if photo is None:
            missing.append(uid)
            continue
        sig = photo_signature(photo)
        filename = (photo.original_filename or photo.filename or "").lower()
        if sig and sig in target_sigs:
            ok.append(uid)
        elif by_filename.get(filename):
            ok.append(uid)
        else:
            missing.append(uid)
    return ok, missing


def ensure_album(lib: photoscript.PhotosLibrary, name: str) -> photoscript.Album:
    for album_name in lib.album_names():
        if album_name == name:
            album = lib.album(name)
            if album is not None:
                return album
    return lib.create_album(name)


def add_photos_to_album(
    album: photoscript.Album,
    uuids: list[str],
    *,
    chunk_size: int,
) -> tuple[int, list[str]]:
    added = 0
    errors: list[str] = []
    for start in range(0, len(uuids), chunk_size):
        chunk = uuids[start : start + chunk_size]
        photos: list[photoscript.Photo] = []
        for uid in chunk:
            try:
                photos.append(photoscript.Photo(uid))
            except ValueError as exc:
                errors.append(f"{uid}: {exc}")
        if not photos:
            continue
        try:
            album.add(photos)
            added += len(photos)
        except photoscript.AppleScriptError as exc:
            errors.append(f"album.add chunk@{start}: {exc}")
        time.sleep(0.5)
    return added, errors


def gui_delete_album_contents(album_name: str, *, dry_run: bool) -> None:
    if dry_run:
        print(f"DRY-RUN: would GUI-delete all items in album {album_name!r}")
        return

    photos_sidebar = "UI element 1 of scroll area 1 of group 1 of group 1 of splitter group 1 of group 1 of window 1"
    photos_sidebar_alt = "scroll area 1 of group 1 of group 1 of splitter group 1 of group 1 of window 1"
    script = f'''
on run
    tell application "Photos" to activate
    delay 2
    tell application "System Events"
        tell process "Photos"
            set frontmost to true
            delay 1
            try
                click UI element "{album_name}" of {photos_sidebar}
            on error
                try
                    click static text "{album_name}" of {photos_sidebar_alt}
                end try
            end try
            delay 2
            keystroke "a" using command down
            delay 0.5
            key code 51 using command down
            delay 1
            try
                click button "Delete" of sheet 1 of window 1
            on error
                try
                    click button "Delete" of sheet 1 of window "Photos"
                end try
            end try
        end tell
    end tell
end run
'''
    proc = subprocess.run(
        ["osascript", "-e", script],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        detail = proc.stderr.strip() or proc.stdout.strip() or "GUI delete failed"
        raise RuntimeError(detail)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Delete verified tier items from source library")
    parser.add_argument(
        "--config",
        default=str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
    )
    parser.add_argument(
        "--manifest",
        action="append",
        dest="manifests",
        help="tier-delete-manifest JSON (repeatable; default: all in tier log dir)",
    )
    parser.add_argument("--album", default="TierPolicy-Delete", help="Staging album name")
    parser.add_argument("--batch-size", type=int, default=100, help="album.add chunk size")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--yes", action="store_true", help="Skip confirmation prompt")
    parser.add_argument("--skip-gui", action="store_true", help="Only populate album; no GUI delete")
    parser.add_argument("--limit", type=int, help="Max UUIDs to process (testing)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = load_config(expand(args.config))
    tier = config.get("tier_policy") or {}
    source_cfg = library_by_id(config, tier.get("source_library_id", "icloud-primary"))
    target_cfg = library_by_id(config, tier.get("target_library_id", "local-archive"))
    source_lib = photos_library_path(source_cfg)
    target_lib = photos_library_path(target_cfg)

    log_dir = tier_log_dir(config)
    manifests = (
        [expand(p) for p in args.manifests] if args.manifests else sorted(log_dir.glob("tier-delete-manifest-*.json"))
    )
    state_path = log_dir / "state.json"
    uuids = collect_uuids(manifests=manifests, state_path=state_path)
    if args.limit:
        uuids = uuids[: args.limit]
    if not uuids:
        print("No UUIDs to delete.", file=sys.stderr)
        return 1

    source_db = osxphotos.PhotosDB(str(source_lib))
    target_db = osxphotos.PhotosDB(str(target_lib))
    target_sigs = target_signatures(target_db)
    ready, not_ready = verify_target_present(
        source_db=source_db,
        target_db=target_db,
        target_sigs=target_sigs,
        uuids=uuids,
    )

    report = {
        "generated_at": utc_now(),
        "source_library": str(source_lib),
        "album": args.album,
        "requested": len(uuids),
        "ready_to_delete": len(ready),
        "blocked_not_in_target": not_ready,
        "dry_run": args.dry_run,
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))

    if not_ready:
        print(
            f"ERROR: {len(not_ready)} UUID(s) not verified in target; aborting.",
            file=sys.stderr,
        )
        return 1

    if not args.yes and not args.dry_run and sys.stdin.isatty():
        answer = input(f"Delete {len(ready)} item(s) from icloud-primary? [y/N] ")
        if answer.strip().lower() not in {"y", "yes"}:
            print("Aborted.", file=sys.stderr)
            return 1

    lib = photoscript.PhotosLibrary()
    lib.open(str(source_lib), delay=5)
    album = ensure_album(lib, args.album)

    if args.dry_run:
        print(f"Would add {len(ready)} photos to album {args.album!r} and delete via Photos GUI.")
        return 0

    added, add_errors = add_photos_to_album(album, ready, chunk_size=args.batch_size)
    report["album_added"] = added
    report["add_errors"] = add_errors

    if args.skip_gui:
        print(f"Album {args.album!r} populated with {added} item(s). Delete manually in Photos.")
    else:
        gui_delete_album_contents(args.album, dry_run=False)
        time.sleep(3)
        try:
            lib.delete_album(album)
        except photoscript.AppleScriptError as exc:
            report["album_cleanup_error"] = str(exc)

    remaining = 0
    in_trash = 0
    for uid in ready:
        photo = source_db.get_photo(uid)
        if photo is None:
            continue
        if photo.intrash:
            in_trash += 1
        else:
            remaining += 1
    report["in_trash"] = in_trash
    report["remaining_in_source"] = remaining
    report["deleted"] = in_trash

    out_path = log_dir / "tier-delete-source-report.json"
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\nReport: {out_path}", file=sys.stderr)
    return 0 if in_trash == len(ready) else 1


if __name__ == "__main__":
    raise SystemExit(main())
