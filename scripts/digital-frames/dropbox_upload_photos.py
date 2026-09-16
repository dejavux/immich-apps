#!/usr/bin/env python3
"""Upload frame-size JPEGs to Dropbox (optional mirror; Nixplay should use direct upload)."""
import glob
import os
import sys

import dropbox

from paths import UPLOAD_DIR

DROPBOX_FOLDER = os.environ.get("DROPBOX_FRAME_FOLDER", "/Photos/nixplay-photo-frame")
PHOTOS_DIR = os.environ.get("PHOTOS_DIR", str(UPLOAD_DIR))


def main() -> None:
    token = os.environ.get("DROPBOX_TOKEN")
    if not token:
        print("Set DROPBOX_TOKEN", file=sys.stderr)
        sys.exit(1)
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    dbx = dropbox.Dropbox(token)
    files = sorted(glob.glob(os.path.join(PHOTOS_DIR, "photo_*.jpg")))
    ok = 0
    for i, path in enumerate(files[start:], start):
        name = os.path.basename(path)
        dest = f"{DROPBOX_FOLDER}/{name}"
        with open(path, "rb") as f:
            dbx.files_upload(f.read(), dest, mode=dropbox.files.WriteMode.overwrite)
        ok += 1
        print(f"  [{i + 1}/{len(files)}] {name}")
    print(f"Uploaded {ok} files to {DROPBOX_FOLDER}")


if __name__ == "__main__":
    main()
