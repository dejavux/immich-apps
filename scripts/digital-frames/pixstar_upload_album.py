#!/usr/bin/env python3
"""Upload photos to a Pix-Star web album using session cookies from Cursor browser."""
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import time
from pathlib import Path

import requests
from requests_toolbelt.multipart.encoder import MultipartEncoder

from paths import UPLOAD_DIR

REPO = Path(__file__).resolve().parent
PHOTOS_DIR = Path(os.environ.get("PHOTOS_DIR", UPLOAD_DIR))
ALBUM_ID = os.environ.get("PIXSTAR_ALBUM_ID", "4640016")
COOKIES_DB = (
    Path.home()
    / "Library/Application Support/Cursor/Partitions/cursor-browser/Cookies"
)


def load_pixstar_cookies() -> dict[str, str]:
    tmp = tempfile.mktemp(suffix=".cookies")
    shutil.copy2(COOKIES_DB, tmp)
    con = sqlite3.connect(tmp)
    cur = con.cursor()
    cur.execute(
        "SELECT name, value FROM cookies WHERE host_key LIKE '%pix-star%'"
    )
    cookies = {name: value for name, value in cur.fetchall() if value}
    con.close()
    os.unlink(tmp)
    if "sessionid" not in cookies:
        raise RuntimeError("sessionid cookie not found; log in via Cursor browser first")
    return cookies


def upload_photo(session: requests.Session, photo_path: Path, csrf: str) -> int:
    url = f"https://www.pix-star.com/album/web/{ALBUM_ID}/"
    with photo_path.open("rb") as f:
        encoder = MultipartEncoder(
            fields=[
                ("image", (photo_path.name, f, "image/jpeg")),
                ("image", ("", "", "application/octet-stream")),
                ("image", ("", "", "application/octet-stream")),
                ("image", ("", "", "application/octet-stream")),
                ("image", ("", "", "application/octet-stream")),
                ("size", ""),
                ("csrfmiddlewaretoken", csrf),
            ]
        )
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Origin": "https://www.pix-star.com",
            "Referer": url,
            "Content-Type": encoder.content_type,
        }
        resp = session.post(url, data=encoder, headers=headers, timeout=60, allow_redirects=False)
    return resp.status_code


def main() -> None:
    photos = sorted(PHOTOS_DIR.glob("photo_*.jpg"))
    if not photos:
        print(f"No photos in {PHOTOS_DIR}", file=sys.stderr)
        sys.exit(1)

    cookies = load_pixstar_cookies()
    csrf = cookies["csrftoken"]
    session = requests.Session()
    session.cookies.update(cookies)

    ok, errors = 0, []
    t0 = time.time()
    for i, photo in enumerate(photos):
        try:
            status = upload_photo(session, photo, csrf)
            if status in (200, 302):
                ok += 1
                if (i + 1) % 10 == 0:
                    print(f"  {i + 1}/{len(photos)} uploaded...")
            else:
                errors.append({"photo": photo.name, "status": status})
                print(f"FAIL {photo.name}: HTTP {status}")
        except Exception as exc:
            errors.append({"photo": photo.name, "error": str(exc)})
            print(f"ERR {photo.name}: {exc}")

    elapsed = time.time() - t0
    print(
        json.dumps(
            {
                "total": len(photos),
                "ok": ok,
                "errors": errors,
                "elapsed_sec": round(elapsed, 1),
            },
            indent=2,
        )
    )
    sys.exit(0 if ok == len(photos) else 1)


if __name__ == "__main__":
    main()
