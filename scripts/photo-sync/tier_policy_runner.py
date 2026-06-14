#!/usr/bin/env python3
"""Phase 3.5 M3: tier policy dry-run and execute (export → import, manual delete gate)."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tier_policy_lib import (
    expand,
    is_shared_library,
    library_by_id,
    load_config,
    load_state,
    photo_signature,
    photos_library_path,
    report_path,
    save_state,
    select_move_candidates,
    staging_dir,
    target_signatures,
    tier_log_dir,
    utc_now,
)

try:
    import osxphotos
except ImportError as exc:
    raise SystemExit("osxphotos not found. Install: pip3 install --user osxphotos") from exc


def require_photoscript() -> None:
    if shutil.which("osxphotos") is None:
        raise SystemExit("osxphotos not on PATH")


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
}

IMAGE_EXT = {".jpg", ".jpeg", ".heic", ".heif", ".png", ".gif", ".tif", ".tiff", ".webp"}


def paths_for_import(file_paths: list[Path]) -> list[Path]:
    """Drop Live Photo companion .mov when a matching still image exists in the same folder."""
    by_dir: dict[Path, list[Path]] = {}
    for path in file_paths:
        if path.is_file():
            by_dir.setdefault(path.parent, []).append(path)

    selected: list[Path] = []
    for files in by_dir.values():
        image_stems = {p.stem.lower() for p in files if p.suffix.lower() in IMAGE_EXT}
        for path in sorted(files):
            if path.suffix.lower() in {".mov", ".mp4", ".m4v"} and path.stem.lower() in image_stems:
                continue
            selected.append(path)
    return sorted(selected)


def media_files_in_dir(directory: Path) -> list[Path]:
    return sorted(
        p for p in directory.rglob("*") if p.is_file() and not p.name.startswith(".") and p.suffix.lower() in MEDIA_EXT
    )


def export_batch(
    *,
    source_lib: Path,
    staging_batch: Path,
    uuids: list[str],
) -> tuple[list[Path], list[str]]:
    staging_batch.mkdir(parents=True, exist_ok=True)
    cmd = [
        "osxphotos",
        "export",
        str(staging_batch),
        "--library",
        str(source_lib),
        "--update",
        "--directory",
        "{uuid}",
    ]
    for uuid in uuids:
        cmd.extend(["--uuid", uuid])

    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        msg = proc.stderr.strip() or proc.stdout.strip() or "osxphotos export failed"
        raise RuntimeError(msg)

    exported: list[Path] = []
    errors: list[str] = []
    for uuid in uuids:
        photo_dir = staging_batch / uuid
        if not photo_dir.is_dir():
            errors.append(f"export dir missing for uuid {uuid}")
            continue
        files = media_files_in_dir(photo_dir)
        if not files:
            errors.append(f"no files exported for uuid {uuid}")
            continue
        exported.extend(files)
    return exported, errors


def import_to_target(
    *,
    target_lib: Path,
    file_paths: list[Path],
    album_name: str | None,
    import_timeout: int,
    open_delay: int,
    import_mode: str,
) -> list[str]:
    errors: list[str] = []
    import_paths = paths_for_import(file_paths)
    media_paths = [str(p) for p in import_paths]
    if not media_paths:
        return ["no files to import"]

    skipped = len(file_paths) - len(import_paths)
    if skipped:
        print(
            f"Live Photo filter: importing {len(import_paths)} file(s), skipping {skipped} companion video(s).\n",
            file=sys.stderr,
        )

    if import_mode == "manual":
        subprocess.run(["open", "-a", "Photos", str(target_lib)], check=False)
        subprocess.run(["open", "-R", media_paths[0]], check=False)
        print(
            "\nMANUAL IMPORT: In Photos (LOCAL library), use File → Import "
            "or drag files from Finder.\n"
            "Live Photo: import only the HEIC/JPEG; keep the .mov in the same folder.\n",
            file=sys.stderr,
        )
        return []

    subprocess.run(["open", "-a", "Photos", str(target_lib)], check=False)
    if open_delay > 0:
        time.sleep(open_delay)

    subprocess.run(
        [
            "osascript",
            "-e",
            'tell application "Photos" to activate',
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    time.sleep(3)

    cmd = [
        "osxphotos",
        "import",
        *media_paths,
        "--library",
        str(target_lib),
        "--skip-dups",
    ]
    if album_name:
        cmd.extend(["--album", album_name])

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False,
            timeout=import_timeout,
        )
    except subprocess.TimeoutExpired:
        errors.append(
            f"osxphotos import timed out after {import_timeout}s. "
            "Switch to Photos.app and complete import manually, then run "
            "tier-policy-import-staging.sh on the batch directory."
        )
        return errors

    if proc.returncode != 0:
        detail = proc.stderr.strip() or proc.stdout.strip() or "osxphotos import failed"
        errors.append(detail[:500])
    return errors


def write_batch_manifest(
    staging_batch: Path,
    *,
    batch_id: str,
    source_lib: Path,
    target_lib: Path,
    batch: list,
    exported_files: list[Path],
) -> Path:
    items = []
    for photo in batch:
        photo_dir = staging_batch / photo.uuid
        files = media_files_in_dir(photo_dir) if photo_dir.is_dir() else []
        items.append(
            {
                "uuid": photo.uuid,
                "filename": photo.original_filename or photo.filename,
                "date": photo.date.strftime("%Y-%m-%d") if photo.date else None,
                "staging_files": [str(p) for p in files],
            }
        )
    manifest = {
        "batch_id": batch_id,
        "staging_batch": str(staging_batch),
        "source_library": str(source_lib),
        "target_library": str(target_lib),
        "exported_file_count": len(exported_files),
        "items": items,
    }
    path = staging_batch / "batch-manifest.json"
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def verify_imports(
    target_lib: Path,
    photos: list,
    known_sigs: set[str],
) -> tuple[list[str], list[str], list[dict]]:
    db = osxphotos.PhotosDB(str(target_lib))
    current = target_signatures(db)
    by_filename: dict[str, list] = {}
    for target_photo in db.photos():
        name = (target_photo.original_filename or target_photo.filename or "").lower()
        if name:
            by_filename.setdefault(name, []).append(target_photo)

    verified: list[str] = []
    failed: list[str] = []
    notes: list[dict] = []
    for photo in photos:
        sig = photo_signature(photo)
        filename = (photo.original_filename or photo.filename or "").lower()
        if sig and sig in current and sig not in known_sigs:
            verified.append(photo.uuid)
            continue
        if sig and sig in current:
            verified.append(photo.uuid)
            continue
        filename_hits = by_filename.get(filename, [])
        if filename_hits:
            verified.append(photo.uuid)
            notes.append(
                {
                    "uuid": photo.uuid,
                    "match": "filename",
                    "target_uuids": [p.uuid for p in filename_hits[:3]],
                }
            )
            continue
        failed.append(photo.uuid)
    return verified, failed, notes


def wait_for_verified_imports(
    target_lib: Path,
    photos: list,
    known_sigs: set[str],
    *,
    timeout_seconds: int,
    poll_seconds: int,
) -> tuple[list[str], list[str], list[dict]]:
    deadline = time.time() + timeout_seconds
    last_notes: list[dict] = []
    while time.time() < deadline:
        verified, failed, notes = verify_imports(target_lib, photos, known_sigs)
        last_notes = notes
        if verified:
            return verified, failed, notes
        time.sleep(poll_seconds)
    return [], [p.uuid for p in photos], last_notes


def manual_delete_gate(manifest_path: Path, pause: bool) -> None:
    print("\n" + "=" * 72, file=sys.stderr)
    print("MANUAL DELETE GATE — source library NOT modified by this script.", file=sys.stderr)
    print(f"Delete manifest: {manifest_path}", file=sys.stderr)
    print(
        "After verifying imports in local-archive, remove items from icloud-primary "
        "via Photos.app (search by filename / date).",
        file=sys.stderr,
    )
    print("=" * 72 + "\n", file=sys.stderr)
    if pause and sys.stdin.isatty():
        try:
            input("Press Enter to continue (Ctrl+C to stop)... ")
        except KeyboardInterrupt:
            print("\nStopped before next batch.", file=sys.stderr)
            raise SystemExit(130) from None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Tier policy: move eligible photos icloud-primary → local-archive")
    parser.add_argument(
        "--config",
        default=os.environ.get(
            "PHOTO_SYNC_CONFIG",
            str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
        ),
    )
    parser.add_argument("--cutoff-date", help="Override tier_policy.cutoff_date")
    parser.add_argument(
        "--cutoff-one-year",
        action="store_true",
        help="Use today minus 365 days as cutoff",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        help="Max photos per run (default: tier_policy.batch_size or 10)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Plan only (default unless tier_policy.dry_run=false and --execute)",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Export to staging and import into target library via Photos.app",
    )
    parser.add_argument(
        "--export-only",
        action="store_true",
        help="With --execute: export to staging only (no Photos import)",
    )
    parser.add_argument(
        "--import-staging",
        help="Import an existing staging batch directory (reads batch-manifest.json)",
    )
    parser.add_argument(
        "--import-mode",
        choices=("auto", "manual"),
        default="auto",
        help="auto=osxphotos import; manual=open Photos+Finder and wait for verify",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Run --execute even if tier_policy.enabled=false",
    )
    parser.add_argument(
        "--include-shared",
        action="store_true",
        help="Include shared-library photos (default: skip)",
    )
    parser.add_argument(
        "--no-pause",
        action="store_true",
        help="Do not pause for manual delete confirmation between batches",
    )
    parser.add_argument(
        "--import-timeout",
        type=int,
        default=600,
        help="Seconds to wait for osxphotos import (Photos.app must be available)",
    )
    parser.add_argument(
        "--open-delay",
        type=int,
        default=45,
        help="Seconds to wait after opening target library before import",
    )
    parser.add_argument(
        "--verify-timeout",
        type=int,
        default=120,
        help="Seconds to poll target library after import (manual or auto)",
    )
    parser.add_argument("--output", help="Write JSON report path")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config_path = expand(args.config)
    if not config_path.is_file():
        print(f"ERROR: config not found: {config_path}", file=sys.stderr)
        return 1

    if shutil.which("osxphotos") is None:
        print("ERROR: osxphotos not on PATH (~/.local/bin)", file=sys.stderr)
        return 1

    config = load_config(config_path)
    tier = config.get("tier_policy") or {}
    source_id = tier.get("source_library_id", "icloud-primary")
    target_id = tier.get("target_library_id", "local-archive")
    cutoff = args.cutoff_date or tier.get("cutoff_date", "2023-01-01")
    if args.cutoff_one_year:
        cutoff = (date.today() - timedelta(days=365)).isoformat()
    batch_size = args.batch_size or tier.get("batch_size", 10)
    local_path_only = tier.get("local_path_only", True)
    skip_shared = tier.get("skip_shared_library", False) and not args.include_shared

    config_dry_run = tier.get("dry_run", True)
    import_staging = expand(args.import_staging) if args.import_staging else None
    dry_run = args.dry_run or (not args.execute and not import_staging and config_dry_run)
    if args.execute or import_staging:
        dry_run = False

    if not dry_run:
        if not tier.get("enabled") and not args.force:
            print(
                "ERROR: tier_policy.enabled is false. Set enabled: true in config or pass --force with --execute.",
                file=sys.stderr,
            )
            return 1
        require_photoscript()

    source_cfg = library_by_id(config, source_id)
    target_cfg = library_by_id(config, target_id)
    source_lib = photos_library_path(source_cfg)
    target_lib = photos_library_path(target_cfg)
    import_to_album = tier.get("import_to_album", False)
    album_name = None
    if import_to_album:
        album_name = tier.get("target_album") or target_cfg.get("album")
    target_album = album_name or target_cfg.get("album", "Mac Photos (Local Archive)")

    state = load_state(config)
    imported_uuids = set(state.get("imported_uuids", []))
    exported_uuids = set(state.get("exported_uuids", []))
    processed_uuids = imported_uuids | exported_uuids

    source_db = osxphotos.PhotosDB(str(source_lib))
    target_db = osxphotos.PhotosDB(str(target_lib))
    target_sigs = target_signatures(target_db)

    candidates, counts = select_move_candidates(
        source_db,
        target_sigs,
        cutoff_date=cutoff,
        local_path_only=local_path_only,
        skip_shared_library=skip_shared,
        skip_ismissing=True,
        processed_uuids=processed_uuids,
    )
    batch = candidates[:batch_size]

    report: dict = {
        "generated_at": utc_now(),
        "dry_run": dry_run,
        "config": str(config_path),
        "tier_policy": {
            "source_library_id": source_id,
            "target_library_id": target_id,
            "cutoff_date": cutoff,
            "batch_size": batch_size,
            "local_path_only": local_path_only,
            "skip_shared_library": skip_shared,
            "target_album": target_album,
        },
        "libraries": {
            "source": str(source_lib),
            "target": str(target_lib),
        },
        "selection": counts,
        "batch": {
            "planned": len(batch),
            "remaining_after_batch": max(0, len(candidates) - len(batch)),
            "items": [
                {
                    "uuid": p.uuid,
                    "filename": p.original_filename or p.filename,
                    "date": p.date.strftime("%Y-%m-%d") if p.date else None,
                    "live_photo": bool(p.live_photo),
                    "shared_library": is_shared_library(p),
                    "path": p.path,
                }
                for p in batch
            ],
        },
        "execute": {
            "exported": 0,
            "imported": 0,
            "verified": 0,
            "failed": [],
            "errors": [],
            "verify_notes": [],
            "staging_batch": None,
            "batch_manifest": None,
        },
        "delete_manifest": None,
    }

    if dry_run:
        out_path = expand(args.output) if args.output else report_path(config, "tier-plan")
        out_path.write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(json.dumps(report, indent=2, ensure_ascii=False))
        print(f"\nDry-run report: {out_path}", file=sys.stderr)
        return 0

    if not batch and not import_staging:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        print("\nNo candidates in this batch.", file=sys.stderr)
        return 0

    staging_root = staging_dir(config, tier)
    batch_id = time.strftime("%Y%m%d-%H%M%S")
    staging_batch = staging_root / f"batch-{batch_id}"
    uuids = [p.uuid for p in batch]
    exported_files: list[Path] = []

    if import_staging:
        staging_batch = import_staging
        batch_id = staging_batch.name.replace("batch-", "", 1)
        manifest_path = staging_batch / "batch-manifest.json"
        if not manifest_path.is_file():
            print(f"ERROR: missing {manifest_path}", file=sys.stderr)
            return 1
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        uuids = [item["uuid"] for item in manifest.get("items", [])]
        batch = [source_db.get_photo(uid) for uid in uuids]
        batch = [photo for photo in batch if photo is not None]
        exported_files = [Path(path) for item in manifest.get("items", []) for path in item.get("staging_files", [])]
        report["execute"]["staging_batch"] = str(staging_batch)
        report["execute"]["batch_manifest"] = str(manifest_path)
        report["execute"]["exported"] = len(exported_files)
    else:
        uuids = [p.uuid for p in batch]

    try:
        if not import_staging:
            exported_files, export_errors = export_batch(
                source_lib=source_lib,
                staging_batch=staging_batch,
                uuids=uuids,
            )
            report["execute"]["exported"] = len(exported_files)
            report["execute"]["errors"].extend(export_errors)
            report["execute"]["staging_batch"] = str(staging_batch)

            if not exported_files:
                raise RuntimeError("export produced no files")

            manifest_written = write_batch_manifest(
                staging_batch,
                batch_id=batch_id,
                source_lib=source_lib,
                target_lib=target_lib,
                batch=batch,
                exported_files=exported_files,
            )
            report["execute"]["batch_manifest"] = str(manifest_written)

            if args.export_only:
                for photo in batch:
                    if photo.uuid not in state["exported_uuids"]:
                        state["exported_uuids"].append(photo.uuid)
                state["runs"].append(
                    {
                        "batch_id": batch_id,
                        "at": utc_now(),
                        "action": "export_only",
                        "count": len(batch),
                        "staging_batch": str(staging_batch),
                    }
                )
                save_state(config, state)
                report["execute"]["import_skipped"] = True
                out_path = expand(args.output) if args.output else report_path(config, "tier-export")
                out_path.write_text(
                    json.dumps(report, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8",
                )
                print(json.dumps(report, indent=2, ensure_ascii=False))
                print(
                    f"\nExport-only complete. Import with:\n"
                    f"  ./scripts/photo-sync/tier-policy-import-staging.sh {staging_batch}\n",
                    file=sys.stderr,
                )
                return 0

        import_mode: str = args.import_mode
        tier_import_mode = tier.get("import_mode")
        if isinstance(tier_import_mode, str) and tier_import_mode in ("auto", "manual"):
            import_mode = tier_import_mode

        import_errors = import_to_target(
            target_lib=target_lib,
            file_paths=exported_files,
            album_name=album_name,
            import_timeout=args.import_timeout,
            open_delay=args.open_delay,
            import_mode=import_mode,
        )
        report["execute"]["errors"].extend(import_errors)
        if import_errors and import_mode == "auto":
            raise RuntimeError("; ".join(import_errors))

        report["execute"]["imported"] = len(uuids)
        verified, failed, notes = wait_for_verified_imports(
            target_lib,
            batch,
            target_sigs,
            timeout_seconds=args.verify_timeout,
            poll_seconds=5,
        )
        report["execute"]["verified"] = len(verified)
        report["execute"]["failed"] = failed
        report["execute"]["verify_notes"] = notes

        if not verified:
            raise RuntimeError(
                "import verification failed: target library has no matching items. "
                "Use --import-mode manual or Photos File → Import, then re-run "
                f"tier-policy-import-staging.sh {staging_batch}"
            )

        delete_items = []
        for photo in batch:
            if photo.uuid in verified:
                delete_items.append(
                    {
                        "uuid": photo.uuid,
                        "filename": photo.original_filename or photo.filename,
                        "date": photo.date.strftime("%Y-%m-%d") if photo.date else None,
                        "shared_library": is_shared_library(photo),
                        "source_library": str(source_lib),
                        "imported_at": utc_now(),
                        "status": "pending_manual_delete",
                    }
                )

        manifest_path = tier_log_dir(config) / f"tier-delete-manifest-{batch_id}.json"
        manifest = {
            "generated_at": utc_now(),
            "batch_id": batch_id,
            "source_library": str(source_lib),
            "instructions": (
                "Open icloud-primary in Photos.app and delete these items manually. "
                "Immich retains copies; local-archive now has imports."
            ),
            "items": delete_items,
        }
        manifest_path.write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        report["delete_manifest"] = str(manifest_path)

        for uuid in verified:
            if uuid not in state["imported_uuids"]:
                state["imported_uuids"].append(uuid)
        state["runs"].append(
            {
                "batch_id": batch_id,
                "at": utc_now(),
                "verified": len(verified),
                "failed": len(failed),
                "manifest": str(manifest_path),
            }
        )
        save_state(config, state)

        if failed:
            report["execute"]["errors"].append(f"verification failed for {len(failed)} uuid(s): {failed}")

    except RuntimeError as exc:
        report["execute"]["errors"].append(str(exc))
        out_path = expand(args.output) if args.output else report_path(config, "tier-run-failed")
        out_path.write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(json.dumps(report, indent=2, ensure_ascii=False))
        print(f"\nFailed run report: {out_path}", file=sys.stderr)
        return 1

    out_path = expand(args.output) if args.output else report_path(config, "tier-run")
    out_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\nRun report: {out_path}", file=sys.stderr)

    if report["delete_manifest"]:
        manual_delete_gate(Path(report["delete_manifest"]), pause=not args.no_pause)

    return 0 if not report["execute"]["failed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
