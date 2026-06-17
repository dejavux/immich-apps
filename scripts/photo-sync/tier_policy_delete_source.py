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
    from photoscript.exceptions import AppleScriptError
except ImportError as exc:
    raise SystemExit("osxphotos and photoscript required") from exc


def collect_uuids(*, manifests: list[Path], state_path: Path, manifests_only: bool = False) -> list[str]:
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

    if not manifests_only and state_path.is_file():
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


def album_member_uuids(album: photoscript.Album) -> set[str]:
    try:
        return {photo.uuid for photo in album.photos()}
    except (ValueError, OSError, AppleScriptError):
        return set()


def album_member_uuids_osxphotos(
    source_db: osxphotos.PhotosDB,
    album_name: str,
    *,
    ready_uuids: set[str] | None = None,
) -> set[str]:
    members = {photo.uuid for photo in source_db.photos(albums=[album_name])}
    if ready_uuids is None:
        return members
    return members & ready_uuids


def add_photos_to_album(
    album: photoscript.Album,
    uuids: list[str],
    *,
    chunk_size: int,
) -> tuple[int, list[str]]:
    attempted = 0
    errors: list[str] = []
    total = len(uuids)
    for start in range(0, total, chunk_size):
        chunk = uuids[start : start + chunk_size]
        photos: list[photoscript.Photo] = []
        for uid in chunk:
            try:
                photos.append(photoscript.Photo(uid))
            except (ValueError, OSError, AppleScriptError) as exc:
                errors.append(f"{uid}: {exc}")
        if not photos:
            continue
        try:
            album.add(photos)
            attempted += len(photos)
        except AppleScriptError:
            for photo in photos:
                try:
                    album.add([photo])
                    attempted += 1
                    time.sleep(0.2)
                except (ValueError, OSError, AppleScriptError) as exc:
                    errors.append(f"{photo.uuid}: {exc}")
        if attempted and (attempted % 100 == 0 or start + chunk_size >= total):
            print(f"  album add attempts {attempted}/{total}…", flush=True)
        time.sleep(0.5)
    return attempted, errors


def populate_album_with_verification(
    *,
    album: photoscript.Album,
    source_lib: Path,
    album_name: str,
    ready: list[str],
    chunk_size: int,
    max_passes: int = 3,
) -> tuple[dict[str, int | list[str]], list[str]]:
    """Add ready UUIDs to album; verify membership via osxphotos between passes."""
    ready_set = set(ready)
    add_errors: list[str] = []
    add_attempts = 0
    verified_before = 0

    for pass_num in range(1, max_passes + 1):
        source_db = osxphotos.PhotosDB(str(source_lib))
        in_album = album_member_uuids_osxphotos(source_db, album_name, ready_uuids=ready_set)
        pending = [uid for uid in ready if uid not in in_album]
        if pass_num == 1:
            verified_before = len(in_album)
        if not pending:
            break

        print(
            f"Pass {pass_num}/{max_passes}: verified={len(in_album)}, pending={len(pending)}",
            file=sys.stderr,
            flush=True,
        )
        attempted, errors = add_photos_to_album(album, pending, chunk_size=chunk_size)
        add_attempts += attempted
        add_errors.extend(errors)
        time.sleep(3)

    source_db = osxphotos.PhotosDB(str(source_lib))
    verified_after = album_member_uuids_osxphotos(source_db, album_name, ready_uuids=ready_set)
    missing = [uid for uid in ready if uid not in verified_after]
    stats: dict[str, int | list[str]] = {
        "album_already_present": verified_before,
        "album_add_attempts": add_attempts,
        "album_verified_in_album": len(verified_after),
        "album_still_missing": len(missing),
        "album_missing_uuids": missing[:50],
    }
    return stats, add_errors


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
    parser.add_argument("--batch-size", type=int, default=25, help="album.add chunk size")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--yes", action="store_true", help="Skip confirmation prompt")
    parser.add_argument("--skip-gui", action="store_true", help="Only populate album; no GUI delete")
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip UUIDs already present in the staging album",
    )
    parser.add_argument(
        "--manifests-only",
        action="store_true",
        help="Do not merge state.json imported_uuids (use manifest items only)",
    )
    parser.add_argument("--limit", type=int, help="Max UUIDs to process (testing)")
    parser.add_argument(
        "--skip-blocked",
        action="store_true",
        help="Process ready UUIDs only; skip those not verified in target",
    )
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
    uuids = collect_uuids(manifests=manifests, state_path=state_path, manifests_only=args.manifests_only)
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

    absent_from_source: list[str] = []
    blocked_not_in_target: list[str] = []
    for uid in not_ready:
        if source_db.get_photo(uid) is None:
            absent_from_source.append(uid)
        else:
            blocked_not_in_target.append(uid)

    report = {
        "generated_at": utc_now(),
        "source_library": str(source_lib),
        "album": args.album,
        "requested": len(uuids),
        "ready_to_delete": len(ready),
        "absent_from_icloud": len(absent_from_source),
        "blocked_not_in_local": blocked_not_in_target,
        "dry_run": args.dry_run,
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))

    if absent_from_source:
        print(
            f"INFO: {len(absent_from_source)} UUID(s) already absent from icloud "
            "(likely in Recently Deleted or prior delete round).",
            file=sys.stderr,
        )

    if blocked_not_in_target:
        if args.skip_blocked:
            print(
                f"WARN: skipping {len(blocked_not_in_target)} UUID(s) not verified in local-archive; "
                f"processing {len(ready)} ready.",
                file=sys.stderr,
            )
            report["skipped_blocked"] = len(blocked_not_in_target)
        else:
            print(
                f"ERROR: {len(blocked_not_in_target)} UUID(s) not verified in local-archive; aborting.",
                file=sys.stderr,
            )
            return 1

    if not args.yes and not args.dry_run and sys.stdin.isatty():
        answer = input(f"Delete {len(ready)} item(s) from icloud-primary? [y/N] ")
        if answer.strip().lower() not in {"y", "yes"}:
            print("Aborted.", file=sys.stderr)
            return 1

    lib = photoscript.PhotosLibrary()
    lib.open(str(source_lib), delay=8)
    subprocess.run(["open", "-a", "Photos", str(source_lib)], check=False)
    time.sleep(3)
    album = ensure_album(lib, args.album)

    pending = ready
    if args.resume:
        in_album = album_member_uuids_osxphotos(source_db, args.album, ready_uuids=set(ready))
        if not in_album:
            in_album = album_member_uuids(album)
        pending = [uid for uid in ready if uid not in in_album]
        print(
            f"Resume: {len(in_album)} verified in {args.album!r}, pending={len(pending)}",
            file=sys.stderr,
            flush=True,
        )

    if args.dry_run:
        verified = album_member_uuids_osxphotos(source_db, args.album, ready_uuids=set(ready))
        print(
            f"Would add {len(pending)} photos to album {args.album!r} "
            f"({len(verified)} verified present) and delete via Photos GUI."
        )
        return 0

    fill_stats, add_errors = populate_album_with_verification(
        album=album,
        source_lib=source_lib,
        album_name=args.album,
        ready=ready,
        chunk_size=args.batch_size,
    )
    report.update(fill_stats)
    report["album_pending"] = len(pending)
    report["add_errors"] = add_errors[:50]
    report["add_error_count"] = len(add_errors)

    verified_count = int(report["album_verified_in_album"])
    still_missing = int(report["album_still_missing"])

    if args.skip_gui:
        print(
            f"Album {args.album!r}: verified {verified_count}/{len(ready)} "
            f"(+{report['album_add_attempts']} add attempts, {still_missing} still missing). "
            "Delete manually in Photos when complete.",
            flush=True,
        )
    else:
        gui_delete_album_contents(args.album, dry_run=False)
        time.sleep(3)
        try:
            lib.delete_album(album)
        except AppleScriptError as exc:
            report["album_cleanup_error"] = str(exc)

    source_db = osxphotos.PhotosDB(str(source_lib))
    verified_count = len(album_member_uuids_osxphotos(source_db, args.album, ready_uuids=set(ready)))
    report["album_total"] = verified_count

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
    if args.skip_gui:
        return 0 if still_missing == 0 else 1
    return 0 if in_trash == len(ready) else 1


if __name__ == "__main__":
    raise SystemExit(main())
