#!/usr/bin/env python3
"""Delete all photos from a Pix-Star web album using session cookies."""
import json
import re
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

import requests

ALBUM_ID = __import__("os").environ.get("PIXSTAR_ALBUM_ID", "4640016")
COOKIES_DB = (
    Path.home()
    / "Library/Application Support/Cursor/Partitions/cursor-browser/Cookies"
)
DELETE_URL = "https://www.pix-star.com/delete/album/image/"


def load_pixstar_cookies() -> dict[str, str]:
    tmp = tempfile.mktemp(suffix=".cookies")
    shutil.copy2(COOKIES_DB, tmp)
    con = sqlite3.connect(tmp)
    cur = con.cursor()
    cur.execute("SELECT name, value FROM cookies WHERE host_key LIKE '%pix-star%'")
    cookies = {name: value for name, value in cur.fetchall() if value}
    con.close()
    Path(tmp).unlink(missing_ok=True)
    if "sessionid" not in cookies:
        raise RuntimeError("sessionid cookie not found; log in via Cursor browser first")
    return cookies


def photo_ids_from_html(html: str) -> list[str]:
    return sorted(set(re.findall(r'value="(\d{6,})"', html)))


def main() -> None:
    cookies = load_pixstar_cookies()
    csrf = cookies["csrftoken"]
    session = requests.Session()
    session.cookies.update(cookies)
    session.headers.update(
        {
            "User-Agent": "Mozilla/5.0",
            "Origin": "https://www.pix-star.com",
            "Referer": f"https://www.pix-star.com/album/web/{ALBUM_ID}/",
            "X-CSRFToken": csrf,
            "X-Requested-With": "XMLHttpRequest",
        }
    )

    deleted_total = 0
    rounds = 0
    while rounds < 20:
        rounds += 1
        page = session.get(f"https://www.pix-star.com/album/web/{ALBUM_ID}/", timeout=60)
        page.raise_for_status()
        ids = photo_ids_from_html(page.text)
        if not ids:
            break
        resp = session.post(
            DELETE_URL,
            data={
                "images[]": ids,
                "album_id": ALBUM_ID,
                "size": "small",
                "album_type": "web",
            },
            timeout=60,
        )
        if resp.status_code != 200 or resp.text.strip() == "error":
            print(json.dumps({"round": rounds, "status": resp.status_code, "body": resp.text[:200]}))
            sys.exit(1)
        deleted_total += len(ids)
        print(f"round {rounds}: deleted {len(ids)} (total {deleted_total})")

    print(json.dumps({"deleted_total": deleted_total, "rounds": rounds}, indent=2))


if __name__ == "__main__":
    main()
