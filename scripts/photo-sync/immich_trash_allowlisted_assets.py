#!/usr/bin/env python3
"""Trash only explicitly allowlisted Immich assets (dry-run default, safe apply)."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from immich_reconcile import api_request, apply_orphan_action, immich_api_base, immich_api_key
from immich_reconcile_diagnose import diagnose_asset
from photo_sync_lib import (
    build_mac_refcount,
    delete_policy,
    expand,
    load_config,
    reconcile_log_dir,
    reconcile_settings,
    utc_now,
)

PRESETS: dict[str, list[str]] = {
    "today-png-orphans-20260630": [
        "5db0b445-06fa-4ff2-abbe-14726be75ae9",
        "8a377df4-3737-4fd2-8580-e59adbbab963",
        "35972d38-a2d9-4542-98ee-00af05224e30",
        "d970fb11-eacb-4226-a550-3cf01d1a7251",
        "e7051e7d-1f7a-4a00-ae86-a576e4997d4c",
        "90f6bc05-a611-433d-b2d1-b5589f7d9419",
        "3f5a9bcd-443d-4446-9439-f524c20083fa",
        "e5099545-75ce-4ab3-8b6c-a6a8520dce2e",
    ],
}


def resolve_asset_ids(args: argparse.Namespace) -> tuple[list[str], str | None]:
    ids: list[str] = []
    preset_name: str | None = None
    if args.preset:
        preset_name = args.preset
        if preset_name not in PRESETS:
            known = ", ".join(sorted(PRESETS))
            raise SystemExit(f"ERROR: unknown preset {preset_name!r} (known: {known})")
        ids.extend(PRESETS[preset_name])
    ids.extend(args.asset_ids)
    seen: set[str] = set()
    unique: list[str] = []
    for asset_id in ids:
        normalized = asset_id.strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        unique.append(asset_id.strip())
    if not unique:
        raise SystemExit("ERROR: no asset IDs (use --preset NAME and/or positional asset IDs)")
    return unique, preset_name


def evaluate_asset(
    *,
    asset_id: str,
    config: dict,
    mac_refcount: dict[str, int],
    libraries_by_checksum: dict[str, list[str]],
    reconcile: dict,
    require_png: bool,
) -> dict:
    diagnosis = diagnose_asset(
        asset_id=asset_id,
        config=config,
        mac_refcount=mac_refcount,
        libraries_by_checksum=libraries_by_checksum,
        reconcile=reconcile,
    )
    base = immich_api_base(config)
    api_key = immich_api_key()
    asset = api_request(method="GET", url=f"{base}/assets/{asset_id}", api_key=api_key)
    if not isinstance(asset, dict):
        raise SystemExit(f"unexpected asset response for {asset_id}")

    filename = asset.get("originalFileName") or diagnosis.get("originalFileName") or ""
    trashed = bool(asset.get("isTrashed") or asset.get("trashed"))
    is_png = filename.lower().endswith(".png")

    action = "would_trash"
    skip_reason: str | None = None
    if trashed:
        action = "skip_already_trashed"
        skip_reason = "already_trashed"
    elif diagnosis.get("mac_refcount", 0) > 0:
        action = "skip_still_on_mac"
        skip_reason = "mac_refcount_gt_0"
    elif not diagnosis.get("orphan_candidate"):
        action = "skip_not_orphan"
        skip_reason = "not_orphan_candidate"
    elif require_png and not is_png:
        action = "skip_not_png"
        skip_reason = "filename_not_png"

    return {
        **diagnosis,
        "is_trashed": trashed,
        "is_png": is_png,
        "require_png": require_png,
        "action": action,
        "skip_reason": skip_reason,
    }


def print_asset_row(row: dict) -> None:
    print(f"=== {row['asset_id']} ===")
    print(f"  file: {row.get('originalFileName')}")
    print(f"  created: {row.get('fileCreatedAt')}")
    print(f"  checksum: {row.get('checksum_hex')}")
    print(f"  mac_refcount: {row.get('mac_refcount')}  orphan: {row.get('orphan_candidate')}")
    print(f"  trashed: {row.get('is_trashed')}  png: {row.get('is_png')}")
    print(f"  action: {row.get('action')}")
    if row.get("skip_reason"):
        print(f"  skip_reason: {row.get('skip_reason')}")
    print()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Trash only allowlisted Immich assets (dry-run default; --apply --confirm to trash)",
    )
    parser.add_argument(
        "--config",
        default=os.environ.get(
            "PHOTO_SYNC_CONFIG",
            str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
        ),
    )
    parser.add_argument(
        "--preset",
        choices=sorted(PRESETS),
        help="Built-in allowlist preset (e.g. today-png-orphans-20260630)",
    )
    parser.add_argument("asset_ids", nargs="*", help="Explicit Immich asset UUID(s)")
    parser.add_argument(
        "--require-png",
        action="store_true",
        help="Skip assets whose originalFileName does not end with .png",
    )
    parser.add_argument(
        "--no-require-png",
        action="store_true",
        help="Do not require .png extension (overrides preset default)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Trash eligible allowlisted assets (requires delete_policy=conservative)",
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Required with --apply to confirm destructive action",
    )
    parser.add_argument("--output", help="Write JSON report path")
    parser.add_argument("--json", action="store_true", help="Print JSON report to stdout")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.apply and not args.confirm:
        print("ERROR: --apply requires --confirm", file=sys.stderr)
        return 1

    config_path = expand(args.config)
    if not config_path.is_file():
        print(f"ERROR: config not found: {config_path}", file=sys.stderr)
        return 1

    asset_ids, preset_name = resolve_asset_ids(args)
    require_png = args.require_png
    if preset_name == "today-png-orphans-20260630" and not args.no_require_png:
        require_png = True
    if args.no_require_png:
        require_png = False

    config = load_config(config_path)
    policy = delete_policy(config)
    if args.apply and policy != "conservative":
        print(
            "ERROR: --apply requires sync.delete_policy: conservative in photo-sync.config.yaml",
            file=sys.stderr,
        )
        return 1

    reconcile = reconcile_settings(config)
    print("Scanning Mac originals checksum inventory…", flush=True)
    mac_refcount, libraries_by_checksum = build_mac_refcount(config, reconcile=reconcile)
    print(f"Mac unique checksums: {len(mac_refcount)}", flush=True)
    print(f"Allowlisted assets: {len(asset_ids)}", flush=True)

    evaluations: list[dict] = []
    for asset_id in asset_ids:
        evaluations.append(
            evaluate_asset(
                asset_id=asset_id,
                config=config,
                mac_refcount=mac_refcount,
                libraries_by_checksum=libraries_by_checksum,
                reconcile=reconcile,
                require_png=require_png,
            )
        )

    to_trash = [row for row in evaluations if row["action"] == "would_trash"]
    skipped = [row for row in evaluations if row["action"] != "would_trash"]

    applied: list[dict] = []
    if args.apply and to_trash:
        print(f"Trashing {len(to_trash)} allowlisted orphan(s)…", flush=True)
        orphan_rows = [
            {
                "asset_id": row["asset_id"],
                "checksum": row.get("checksum_hex"),
                "filename": row.get("originalFileName"),
            }
            for row in to_trash
        ]
        applied = apply_orphan_action(
            base=immich_api_base(config),
            api_key=immich_api_key(),
            orphans=orphan_rows,
            action="trash",
            batch_size=int(reconcile.get("batch_size", 100)),
        )
        for row in applied:
            row["action"] = "trashed"

    summary = {
        "allowlisted": len(asset_ids),
        "would_trash": len(to_trash),
        "skipped": len(skipped),
        "applied": len(applied),
    }
    by_action: dict[str, int] = {}
    for row in evaluations:
        action = row["action"]
        by_action[action] = by_action.get(action, 0) + 1

    report = {
        "generated_at": utc_now(),
        "mode": "apply" if args.apply else "dry-run",
        "delete_policy": policy,
        "preset": preset_name,
        "require_png": require_png,
        "summary": summary,
        "by_action": by_action,
        "assets": evaluations,
        "applied": applied,
    }

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    prefix = "trash-allowlist-apply" if args.apply else "trash-allowlist"
    out_path = expand(args.output) if args.output else reconcile_log_dir(config) / f"{prefix}-{stamp}.json"
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        for row in evaluations:
            print_asset_row(row)
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        print(f"\nFull report: {out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
