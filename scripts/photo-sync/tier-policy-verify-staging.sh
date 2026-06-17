#!/usr/bin/env bash
# Verify tier-policy staging batches against local-archive (fingerprint + filename).
#
# Usage:
#   ./scripts/photo-sync/tier-policy-verify-staging.sh
#   ./scripts/photo-sync/tier-policy-verify-staging.sh /path/to/batch-YYYYMMDD-HHMMSS
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAGING="${TIER_STAGING_ROOT:-/tmp/immich-photo-sync/tier-staging}"
export PATH="${HOME}/.local/bin:${PATH}"

TARGET_BATCH="${1:-}"

exec python3 - "$ROOT/scripts/photo-sync" "$STAGING" "$TARGET_BATCH" <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, sys.argv[1])
from tier_policy_lib import photo_signature, target_signatures

import osxphotos

staging = Path(sys.argv[2])
target_batch = sys.argv[3]

source = osxphotos.PhotosDB("/Users/light0/Pictures/Photos Library.photoslibrary")
target = osxphotos.PhotosDB("/Users/light0/Pictures/LOCAL PHOTO LIBRARY.photoslibrary")
target_sigs = target_signatures(target)
by_filename: dict[str, list] = {}
for photo in target.photos():
    name = (photo.original_filename or photo.filename or "").lower()
    if name:
        by_filename.setdefault(name, []).append(photo)

batches = [Path(target_batch)] if target_batch else sorted(staging.glob("batch-*"))
total = 0
verified = 0
missing_batches: list[tuple[str, int, int]] = []
missing_items: list[tuple[str, str, str]] = []

for batch in batches:
    manifest_path = batch / "batch-manifest.json"
    if not manifest_path.is_file():
        continue
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    batch_ok = 0
    batch_miss = 0
    for item in manifest.get("items", []):
        total += 1
        photo = source.get_photo(item["uuid"])
        if photo is None:
            # Source may already be deleted from icloud; fall back to manifest filename.
            filename = (item.get("filename") or "").lower()
            ok = bool(filename and by_filename.get(filename))
        else:
            sig = photo_signature(photo)
            filename = (photo.original_filename or photo.filename or "").lower()
            ok = bool(sig and sig in target_sigs) or bool(by_filename.get(filename))
        if ok:
            verified += 1
            batch_ok += 1
        else:
            batch_miss += 1
            missing_items.append((batch.name, item.get("filename", "?"), item["uuid"][:8]))
    if batch_miss:
        missing_batches.append((batch.name, batch_ok, batch_miss))

print(f"LOCAL library count: {len(list(target.photos()))}")
print(f"Staging items: {total}")
print(f"Verified in LOCAL: {verified}")
print(f"Missing: {total - verified}")
print(f"Batches with gaps: {len(missing_batches)}")
for name, ok, miss in missing_batches:
    print(f"  {name}: verified={ok} missing={miss}")
if missing_items:
    print("Sample missing:")
    for row in missing_items[:12]:
        print(f"  {row[0]} {row[1]} ({row[2]})")

report = {
    "local_count": len(list(target.photos())),
    "staging_items": total,
    "verified": verified,
    "missing": total - verified,
    "missing_batches": [
        {"batch": name, "verified": ok, "missing": miss}
        for name, ok, miss in missing_batches
    ],
}
log_dir = Path.home() / "Library/Logs/immich-photo-sync/tier"
log_dir.mkdir(parents=True, exist_ok=True)
report_path = log_dir / "tier-verify-staging.json"
report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"\nReport: {report_path}")

raise SystemExit(0 if verified == total else 1)
PY
