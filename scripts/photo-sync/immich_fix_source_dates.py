#!/usr/bin/env python3
"""Fix Immich timeline dates from tier fix-source-dates plan (UUID-named assets)."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))

from immich_audit_dates import (
    api_request,
    apply_fixes,
    default_timezone,
    immich_api_base,
    immich_api_key,
    photos_dt_to_immich_iso,
)
from photo_sync_lib import load_config
from tier_policy_lib import expand, tier_log_dir, utc_now


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fix Immich dates from fix-source-dates plan")
    parser.add_argument(
        "--plan",
        default=str(Path.home() / "Library/Logs/immich-photo-sync/tier/fix-source-dates-plan.json"),
    )
    parser.add_argument(
        "--config",
        default=str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm", action="store_true")
    return parser.parse_args()


def find_asset_by_uuid(base: str, api_key: str, uuid: str) -> dict | None:
    needle = uuid.lower()
    for ext in (".jpeg", ".jpg", ".heic", ".png", ".mov", ".mp4"):
        body = {"originalFileName": f"{uuid}{ext}", "size": 10}
        resp = api_request(method="POST", url=f"{base}/search/metadata", api_key=api_key, body=body)
        items = resp.get("assets", {}).get("items", []) if isinstance(resp, dict) else []
        for asset in items:
            name = (asset.get("originalFileName") or "").lower()
            if name.startswith(needle):
                return asset

    body = {
        "takenAfter": "2026-06-14T00:00:00.000Z",
        "takenBefore": "2026-06-17T23:59:59.999Z",
        "size": 100,
    }
    resp = api_request(method="POST", url=f"{base}/search/metadata", api_key=api_key, body=body)
    items = resp.get("assets", {}).get("items", []) if isinstance(resp, dict) else []
    for asset in items:
        name = (asset.get("originalFileName") or "").lower()
        if name.startswith(needle):
            return asset
    return None


def main() -> int:
    args = parse_args()
    if args.apply and not args.confirm:
        print("ERROR: --apply requires --confirm", file=sys.stderr)
        return 1

    plan_path = expand(args.plan)
    if not plan_path.is_file():
        print(f"ERROR: plan not found: {plan_path}", file=sys.stderr)
        return 1

    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    config = load_config(expand(args.config))
    base = immich_api_base(config)
    api_key = immich_api_key()
    tz = ZoneInfo(default_timezone(config))

    fixes: list[dict] = []
    missing: list[dict] = []
    for item in plan:
        uuid = item["uuid"]
        asset = find_asset_by_uuid(base, api_key, uuid)
        if asset is None:
            missing.append({"uuid": uuid, "filename": item.get("filename")})
            continue
        expected = datetime.fromisoformat(item["expected"])
        if expected.tzinfo is None:
            expected = expected.replace(tzinfo=tz)
        immich_dt = asset.get("localDateTime") or asset.get("fileCreatedAt") or ""
        fixes.append(
            {
                "asset_id": str(asset.get("id")),
                "library_id": "icloud-primary",
                "filename": item.get("filename") or asset.get("originalFileName"),
                "photos_uuid": uuid,
                "photos_date": expected.isoformat(),
                "immich_date": immich_dt,
                "delta_days": abs(
                    (expected.date() - datetime.fromisoformat(immich_dt.replace("Z", "+00:00")).date()).days
                )
                if immich_dt
                else 999,
                "time_zone": default_timezone(config),
                "date_time_original": photos_dt_to_immich_iso(expected, config),
            }
        )

    report = {
        "generated_at": utc_now(),
        "plan": str(plan_path),
        "to_fix": len(fixes),
        "missing_in_immich": missing,
        "fixes": fixes,
    }
    out = tier_log_dir(config) / "immich-fix-source-dates-report.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(json.dumps({"to_fix": len(fixes), "missing": len(missing)}, indent=2))
    for row in fixes:
        print(
            f"- {row['filename']}  asset={row['asset_id'][:8]}…  "
            f"Immich={row['immich_date'][:10]}  →  {row['photos_date'][:10]}"
        )

    if args.dry_run or not args.apply:
        print(f"\nReport: {out}", file=sys.stderr)
        return 0

    applied = apply_fixes(config, fixes, batch_size=20)
    print(json.dumps({"applied": len(applied)}, indent=2))
    print(f"Report: {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
