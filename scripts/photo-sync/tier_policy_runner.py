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
    raise SystemExit(
        "osxphotos not found. Install: pip3 install --user osxphotos"
    ) from exc


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


def media_files_in_dir(directory: Path) -> list[Path]:
    return sorted(
        p
        for p in directory.rglob("*")
        if p.is_file()
        and not p.name.startswith(".")
        and p.suffix.lower() in MEDIA_EXT
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
    album_name: str,
    import_timeout: int,
    open_delay: int,
) -> list[str]:
    errors: list[str] = []
    media_paths = [str(p) for p in file_paths if p.is_file()]
    if not media_paths:
        return ["no files to import"]

    subprocess.run(
        ["open", "-a", "Photos", str(target_lib)],
        capture_output=True,
        text=True,
        check=False,
    )
    if open_delay > 0:
        time.sleep(open_delay)

    cmd = [
        "osxphotos",
        "import",
        *media_paths,
        "--library",
        str(target_lib),
        "--album",
        album_name,
        "--skip-dups",
    ]
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
            f"osxphotos import timed out after {import_timeout}s "
            "(Photos.app may need manual confirmation in GUI)"
        )
        return errors

    if proc.returncode != 0:
        detail = proc.stderr.strip() or proc.stdout.strip() or "osxphotos import failed"
        errors.append(detail[:500])
    return errors


def verify_imports(
    target_lib: Path,
    photos: list,
    known_sigs: set[str],
) -> tuple[list[str], list[str]]:
    db = osxphotos.PhotosDB(str(target_lib))
    current = target_signatures(db)
    verified: list[str] = []
    failed: list[str] = []
    for photo in photos:
        sig = photo_signature(photo)
        if not sig:
            failed.append(photo.uuid)
            continue
        if sig in current and sig not in known_sigs:
            verified.append(photo.uuid)
        elif sig in current:
            verified.append(photo.uuid)
        else:
            failed.append(photo.uuid)
    return verified, failed


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
    parser = argparse.ArgumentParser(
        description="Tier policy: move eligible photos icloud-primary → local-archive"
    )
    parser.add_argument(
        "--config",
        default=os.environ.get(
            "PHOTO_SYNC_CONFIG",
            str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
        ),
    )
    parser.add_argument("--cutoff-date", help="Override tier_policy.cutoff_date")
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
        default=10,
        help="Deprecated; kept for CLI compat",
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
    batch_size = args.batch_size or tier.get("batch_size", 10)
    local_path_only = tier.get("local_path_only", True)
    skip_shared = tier.get("skip_shared_library", False) and not args.include_shared

    config_dry_run = tier.get("dry_run", True)
    dry_run = args.dry_run or (not args.execute and config_dry_run)
    if args.execute:
        dry_run = False

    if not dry_run:
        if not tier.get("enabled") and not args.force:
            print(
                "ERROR: tier_policy.enabled is false. Set enabled: true in config "
                "or pass --force with --execute.",
                file=sys.stderr,
            )
            return 1
        require_photoscript()

    source_cfg = library_by_id(config, source_id)
    target_cfg = library_by_id(config, target_id)
    source_lib = photos_library_path(source_cfg)
    target_lib = photos_library_path(target_cfg)
    target_album = tier.get("target_album") or target_cfg.get("album", "Tier Policy Import")

    state = load_state(config)
    imported_uuids = set(state.get("imported_uuids", []))

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
        imported_uuids=imported_uuids,
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

    if not batch:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        print("\nNo candidates in this batch.", file=sys.stderr)
        return 0

    staging_root = staging_dir(config, tier)
    batch_id = time.strftime("%Y%m%d-%H%M%S")
    staging_batch = staging_root / f"batch-{batch_id}"
    uuids = [p.uuid for p in batch]

    try:
        exported_files, export_errors = export_batch(
            source_lib=source_lib,
            staging_batch=staging_batch,
            uuids=uuids,
        )
        report["execute"]["exported"] = len(exported_files)
        report["execute"]["errors"].extend(export_errors)

        if not exported_files:
            raise RuntimeError("export produced no files")

        import_errors = import_to_target(
            target_lib=target_lib,
            file_paths=exported_files,
            album_name=target_album,
            import_timeout=args.import_timeout,
            open_delay=args.open_delay,
        )
        report["execute"]["errors"].extend(import_errors)
        if import_errors:
            raise RuntimeError("; ".join(import_errors))

        report["execute"]["imported"] = len(uuids)
        verified, failed = verify_imports(target_lib, batch, target_sigs)
        report["execute"]["verified"] = len(verified)
        report["execute"]["failed"] = failed

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
            report["execute"]["errors"].append(
                f"verification failed for {len(failed)} uuid(s): {failed}"
            )

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
