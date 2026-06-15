#!/usr/bin/env python3
"""Phase 3.6: conservative Immich orphan reconcile (dry-run + optional apply)."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from photo_sync_lib import (
    build_mac_refcount,
    delete_policy,
    expand,
    load_config,
    log_dir,
    normalize_checksum,
    reconcile_album_names,
    reconcile_log_dir,
    reconcile_settings,
    utc_now,
)


def immich_api_base(config: dict) -> str:
    immich = config.get("immich") or {}
    url = os.environ.get("IMMICH_INSTANCE_URL") or immich.get("instance_url") or ""
    if not url:
        raise SystemExit("IMMICH_INSTANCE_URL or immich.instance_url required")
    base = url.rstrip("/")
    if not base.endswith("/api"):
        base = f"{base}/api"
    return base


def immich_api_key() -> str:
    key = os.environ.get("IMMICH_API_KEY", "")
    if not key or key.startswith("your-"):
        raise SystemExit("IMMICH_API_KEY not set (bootstrap-credentials.sh or load-env-from-op.sh)")
    return key


def api_request(
    *,
    method: str,
    url: str,
    api_key: str,
    body: dict | None = None,
    timeout: int = 180,
    allow_empty: bool = False,
) -> dict | list:
    data = None
    headers = {
        "Accept": "application/json",
        "x-api-key": api_key,
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Immich API HTTP {exc.code}: {detail[:300]}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"Immich API error: {exc}") from exc
    if not raw:
        return {} if not allow_empty else []
    return json.loads(raw)


def find_tag_id(base: str, api_key: str, tag_name: str) -> str | None:
    tags = api_request(method="GET", url=f"{base}/tags", api_key=api_key)
    if not isinstance(tags, list):
        return None
    for tag in tags:
        if tag.get("name") == tag_name:
            return str(tag.get("id"))
    return None


def list_tagged_assets(
    base: str,
    api_key: str,
    tag_names: list[str],
    *,
    page_size: int,
) -> list[dict]:
    tag_ids: list[str] = []
    missing_tags: list[str] = []
    for name in tag_names:
        tag_id = find_tag_id(base, api_key, name)
        if tag_id:
            tag_ids.append(tag_id)
        else:
            missing_tags.append(name)
    if missing_tags:
        print(f"WARNING: Immich tags not found: {', '.join(missing_tags)}", file=sys.stderr)
    if not tag_ids:
        return []

    assets: list[dict] = []
    page = 1
    while True:
        payload = api_request(
            method="POST",
            url=f"{base}/search/metadata",
            api_key=api_key,
            body={"tagIds": tag_ids, "size": page_size, "page": page},
        )
        if not isinstance(payload, dict):
            break
        chunk = payload.get("assets", {}).get("items", [])
        if not chunk:
            break
        assets.extend(chunk)
        total = payload.get("assets", {}).get("total", len(assets))
        if len(assets) >= total:
            break
        page += 1
    return assets


def find_album_id(base: str, api_key: str, album_name: str) -> str | None:
    albums = api_request(method="GET", url=f"{base}/albums", api_key=api_key)
    if not isinstance(albums, list):
        return None
    for album in albums:
        if album.get("albumName") == album_name:
            return str(album.get("id"))
    return None


def list_album_assets(base: str, api_key: str, album_name: str) -> list[dict]:
    album_id = find_album_id(base, api_key, album_name)
    if not album_id:
        print(f"WARNING: Immich album not found: {album_name}", file=sys.stderr)
        return []
    detail = api_request(method="GET", url=f"{base}/albums/{album_id}", api_key=api_key)
    if not isinstance(detail, dict):
        return []
    return list(detail.get("assets") or [])


def fetch_reconcile_assets(base: str, api_key: str, config: dict) -> tuple[list[dict], dict]:
    reconcile = reconcile_settings(config)
    scope = reconcile.get("scope", "albums")
    by_id: dict[str, dict] = {}
    meta = {"albums": [], "tags": []}

    if scope in {"albums", "both"}:
        for album_name in reconcile_album_names(config):
            assets = list_album_assets(base, api_key, album_name)
            meta["albums"].append({"name": album_name, "count": len(assets)})
            for asset in assets:
                asset_id = str(asset.get("id", ""))
                if asset_id:
                    by_id[asset_id] = asset

    tag_names = list(reconcile.get("immich_tags") or [])
    if scope in {"tags", "both"} and tag_names:
        tagged = list_tagged_assets(
            base,
            api_key,
            tag_names,
            page_size=int(reconcile.get("fetch_page_size", 500)),
        )
        meta["tags"] = tag_names
        for asset in tagged:
            asset_id = str(asset.get("id", ""))
            if asset_id:
                by_id[asset_id] = asset

    return list(by_id.values()), meta


def load_tier_delete_checksums(config: dict) -> dict[str, dict]:
    tier_dir = log_dir(config) / "tier"
    entries: dict[str, dict] = {}
    if not tier_dir.is_dir():
        return entries
    for path in sorted(tier_dir.glob("tier-delete-manifest-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for item in data.get("items", []):
            checksum = item.get("checksum")
            if not checksum:
                continue
            normalized = normalize_checksum(checksum) or checksum.lower()
            entries[normalized] = {
                "uuid": item.get("uuid"),
                "filename": item.get("filename"),
                "manifest": str(path),
                "status": item.get("status"),
            }
    return entries


def asset_tag_names(asset: dict) -> list[str]:
    return [str(t.get("name")) for t in asset.get("tags", []) if t.get("name")]


def apply_orphan_action(
    *,
    base: str,
    api_key: str,
    orphans: list[dict],
    action: str,
    batch_size: int,
) -> list[dict]:
    applied: list[dict] = []
    for offset in range(0, len(orphans), batch_size):
        chunk = orphans[offset : offset + batch_size]
        ids = [row["asset_id"] for row in chunk if row.get("asset_id")]
        if not ids:
            continue
        if action == "delete":
            body = {"ids": ids, "force": True}
        else:
            body = {"ids": ids}
        api_request(
            method="DELETE",
            url=f"{base}/assets",
            api_key=api_key,
            body=body,
            allow_empty=True,
        )
        for row in chunk:
            applied.append({**row, "result": action})
    return applied


def compute_orphans(
    *,
    immich_assets: list[dict],
    mac_refcount: dict[str, int],
    libraries_by_checksum: dict[str, list[str]],
    tier_checksums: dict[str, dict],
    reconcile: dict,
    apply: bool,
) -> tuple[list[dict], list[dict], list[dict], list[dict], list[dict]]:
    orphans: list[dict] = []
    skipped_on_mac: list[dict] = []
    skipped_tier_local: list[dict] = []
    skipped_trashed: list[dict] = []
    skipped_no_checksum: list[dict] = []

    for asset in immich_assets:
        asset_id = str(asset.get("id", ""))
        checksum = normalize_checksum(asset.get("checksum"))
        filename = asset.get("originalFileName")
        trashed = bool(asset.get("isTrashed") or asset.get("trashed"))

        if trashed:
            skipped_trashed.append({"asset_id": asset_id, "checksum": checksum, "filename": filename})
            continue
        if not checksum:
            skipped_no_checksum.append({"asset_id": asset_id, "filename": filename})
            continue

        refcount = mac_refcount.get(checksum, 0)
        if refcount > 0:
            skipped_on_mac.append(
                {
                    "asset_id": asset_id,
                    "checksum": checksum,
                    "filename": filename,
                    "mac_refcount": refcount,
                    "libraries": libraries_by_checksum.get(checksum, []),
                }
            )
            if checksum in tier_checksums and refcount >= 1:
                skipped_tier_local.append(
                    {
                        "asset_id": asset_id,
                        "checksum": checksum,
                        "filename": filename,
                        "tier_manifest": tier_checksums[checksum].get("manifest"),
                        "mac_refcount": refcount,
                        "libraries": libraries_by_checksum.get(checksum, []),
                        "reason": "tier_delete_but_still_on_mac",
                    }
                )
            continue

        orphans.append(
            {
                "asset_id": asset_id,
                "checksum": checksum,
                "filename": filename,
                "tags": asset_tag_names(asset),
                "action": reconcile.get("action", "trash") if apply else "dry-run",
            }
        )

    return orphans, skipped_on_mac, skipped_tier_local, skipped_trashed, skipped_no_checksum


def build_report(
    *,
    config: dict,
    mac_refcount: dict[str, int],
    libraries_by_checksum: dict[str, list[str]],
    immich_assets: list[dict],
    immich_scope: dict,
    tier_checksums: dict[str, dict],
    apply: bool,
    applied: list[dict] | None = None,
) -> dict:
    policy = delete_policy(config)
    reconcile = reconcile_settings(config)
    orphans, skipped_on_mac, skipped_tier_local, skipped_trashed, skipped_no_checksum = compute_orphans(
        immich_assets=immich_assets,
        mac_refcount=mac_refcount,
        libraries_by_checksum=libraries_by_checksum,
        tier_checksums=tier_checksums,
        reconcile=reconcile,
        apply=apply,
    )

    return {
        "generated_at": utc_now(),
        "mode": "apply" if apply else "dry-run",
        "delete_policy": policy,
        "reconcile": reconcile,
        "mac": {
            "unique_checksums": len(mac_refcount),
            "libraries_scanned": [lib.get("id") for lib in config.get("libraries", []) if lib.get("enabled", True)],
        },
        "immich": {
            "scoped_asset_count": len(immich_assets),
            "scope": immich_scope,
        },
        "summary": {
            "orphan_candidates": len(orphans),
            "skipped_still_on_mac": len(skipped_on_mac),
            "skipped_tier_local_retains": len(skipped_tier_local),
            "skipped_trashed": len(skipped_trashed),
            "skipped_no_checksum": len(skipped_no_checksum),
            "applied": len(applied or []),
        },
        "orphans": orphans[:500],
        "applied": (applied or [])[:500],
        "skipped_tier_local_retains": skipped_tier_local[:100],
        "orphans_truncated": max(0, len(orphans) - 500),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        default=str(Path.home() / ".config/immich-apps/photo-sync.config.yaml"),
    )
    parser.add_argument(
        "--library",
        action="append",
        dest="libraries",
        help="Limit Mac scan to library id(s); default: all enabled libraries",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Trash/delete orphan assets (requires delete_policy=conservative)",
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Required with --apply to confirm destructive action",
    )
    parser.add_argument("--output", help="Write JSON report path")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config_path = expand(args.config)
    if not config_path.is_file():
        print(f"ERROR: config not found: {config_path}", file=sys.stderr)
        return 1

    if args.apply and not args.confirm:
        print("ERROR: --apply requires --confirm", file=sys.stderr)
        return 1

    config = load_config(config_path)
    policy = delete_policy(config)
    if args.apply and policy != "conservative":
        print(
            "ERROR: --apply requires sync.delete_policy: conservative in photo-sync.config.yaml",
            file=sys.stderr,
        )
        return 1
    if not args.apply and policy == "none":
        print(
            "NOTE: sync.delete_policy is 'none'. Dry-run only; set conservative + --apply --confirm to trash orphans.",
            file=sys.stderr,
        )

    reconcile = reconcile_settings(config)
    print("Scanning Mac originals/ checksum inventory…", flush=True)
    mac_refcount, libraries_by_checksum = build_mac_refcount(config, library_ids=args.libraries)
    print(f"Mac unique checksums: {len(mac_refcount)}", flush=True)

    base = immich_api_base(config)
    api_key = immich_api_key()
    album_names = reconcile_album_names(config)
    print(f"Fetching Immich scope={reconcile.get('scope', 'albums')} albums={album_names}…", flush=True)
    immich_assets, immich_scope = fetch_reconcile_assets(base, api_key, config)
    print(f"Immich scoped assets: {len(immich_assets)}", flush=True)

    tier_checksums = load_tier_delete_checksums(config)

    applied: list[dict] = []
    if args.apply:
        orphans_for_apply, *_rest = compute_orphans(
            immich_assets=immich_assets,
            mac_refcount=mac_refcount,
            libraries_by_checksum=libraries_by_checksum,
            tier_checksums=tier_checksums,
            reconcile=reconcile,
            apply=True,
        )
        action = reconcile.get("action", "trash")
        print(f"Applying {action} to {len(orphans_for_apply)} orphan(s)…", flush=True)
        applied = apply_orphan_action(
            base=base,
            api_key=api_key,
            orphans=orphans_for_apply,
            action=action,
            batch_size=int(reconcile.get("batch_size", 100)),
        )

    report = build_report(
        config=config,
        mac_refcount=mac_refcount,
        libraries_by_checksum=libraries_by_checksum,
        immich_assets=immich_assets,
        immich_scope=immich_scope,
        tier_checksums=tier_checksums,
        apply=args.apply,
        applied=applied if args.apply else None,
    )

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    prefix = "reconcile-apply" if args.apply else "reconcile"
    out_path = expand(args.output) if args.output else reconcile_log_dir(config) / f"{prefix}-{stamp}.json"
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(json.dumps(report["summary"], indent=2, ensure_ascii=False))
    print(f"\nFull report: {out_path}")
    if report["summary"]["orphan_candidates"] and not args.apply:
        print("\nSample orphan candidates:")
        for row in report["orphans"][:5]:
            print(f"  - {row['asset_id']}  {row.get('filename')}  {row.get('checksum', '')[:12]}…")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
