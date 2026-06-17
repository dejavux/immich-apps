#!/usr/bin/env python3
"""Classify tier delete-source UUIDs: ready, absent from icloud, or not in local-archive."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tier_policy_delete_source import collect_uuids, verify_target_present
from tier_policy_lib import (
    expand,
    library_by_id,
    load_config,
    photos_library_path,
    target_signatures,
    tier_log_dir,
)

try:
    import osxphotos
except ImportError as exc:
    raise SystemExit("osxphotos required") from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Diagnose tier delete-source UUID buckets")
    parser.add_argument(
        "--config",
        default=str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
    )
    parser.add_argument("--manifests-only", action="store_true")
    parser.add_argument("--output", help="Write JSON report path")
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

    manifests = sorted(log_dir.glob("tier-delete-manifest-*.json"))
    state_path = log_dir / "state.json"
    uuids = collect_uuids(
        manifests=manifests,
        state_path=state_path,
        manifests_only=args.manifests_only,
    )
    if not uuids:
        print("No UUIDs to analyze.", file=sys.stderr)
        return 1

    source_db = osxphotos.PhotosDB(str(source_lib))
    target_db = osxphotos.PhotosDB(str(target_lib))
    ready, not_ready = verify_target_present(
        source_db=source_db,
        target_db=target_db,
        target_sigs=target_signatures(target_db),
        uuids=uuids,
    )

    absent: list[str] = []
    blocked: list[str] = []
    block_reasons: Counter[str] = Counter()
    for uid in not_ready:
        photo = source_db.get_photo(uid)
        if photo is None:
            absent.append(uid)
            continue
        blocked.append(uid)
        if photo.ismissing:
            block_reasons["ismissing"] += 1
        elif not photo.path:
            block_reasons["no_local_path"] += 1
        else:
            block_reasons["not_in_local_archive"] += 1

    report = {
        "requested": len(uuids),
        "ready_to_delete": len(ready),
        "absent_from_icloud": len(absent),
        "blocked_not_in_local": len(blocked),
        "block_reasons": dict(block_reasons),
        "interpretation": (
            "absent_from_icloud: UUID 已不在 icloud Photos DB（常見於已移入「最近刪除」或第一輪已刪）；"
            "blocked_not_in_local: 仍在 icloud 但 local-archive 簽名/檔名對不上。"
        ),
        "samples": {
            "absent": absent[:5],
            "blocked": blocked[:5],
        },
    }
    text = json.dumps(report, indent=2, ensure_ascii=False)
    print(text)
    if args.output:
        Path(args.output).write_text(text + "\n", encoding="utf-8")
    return 0 if not blocked else 1


if __name__ == "__main__":
    raise SystemExit(main())
