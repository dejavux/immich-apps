#!/usr/bin/env python3
"""Generate browser_cdp Runtime.evaluate payloads for frame setup."""
import json
import sys
from pathlib import Path

from paths import BROWSER_VIEW_ID, CONFIG_PATH

_cfg = json.loads(CONFIG_PATH.read_text())
FRAME_ID = _cfg['frameId']
PLAYLIST_ID = _cfg['playlistId']
VIEW_ID = BROWSER_VIEW_ID


def assign_expr() -> str:
    return (
        f"(async()=>{{const csrf=(document.cookie.match(/prod\\.csrftoken=([^;]+)/)||[])[1];"
        f"const headers={{Accept:'application/json',Authorization:'Bearer '+localStorage.getItem('nixplay.token'),"
        f"'X-CsrfToken':csrf,'Content-Type':'application/json'}};"
        f"const r=await fetch('https://api.nixplay.com/v3/frames/{FRAME_ID}/playlists/',"
        f"{{method:'POST',credentials:'include',headers,body:JSON.stringify({{playlists:[{int(PLAYLIST_ID)}]}})}});"
        f"return{{status:r.status,body:(await r.text()).slice(0,500)}};}})()"
    )


def slideshow_expr() -> str:
    return (
        f"(async()=>{{const csrf=(document.cookie.match(/prod\\.csrftoken=([^;]+)/)||[])[1];"
        f"const headers={{Accept:'application/json',Authorization:'Bearer '+localStorage.getItem('nixplay.token'),"
        f"'X-CsrfToken':csrf,'Content-Type':'application/json'}};"
        f"const body={{transition:'fade',duration:8,shuffle:true}};"
        f"const r=await fetch('https://api.nixplay.com/v3/playlists/{PLAYLIST_ID}/',"
        f"{{method:'PATCH',credentials:'include',headers,body:JSON.stringify(body)}});"
        f"return{{status:r.status,body:(await r.text()).slice(0,500)}};}})()"
    )


def cdp_payload(expr: str) -> dict:
    return {
        'viewId': VIEW_ID,
        'method': 'Runtime.evaluate',
        'params': {'expression': expr, 'awaitPromise': True, 'returnByValue': True},
    }


if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'assign'
    if which == 'assign':
        print(json.dumps(cdp_payload(assign_expr())))
    elif which == 'slideshow':
        print(json.dumps(cdp_payload(slideshow_expr())))
    else:
        raise SystemExit('assign|slideshow')
