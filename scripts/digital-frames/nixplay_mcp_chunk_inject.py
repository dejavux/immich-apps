#!/usr/bin/env python3
"""Split photo base64 into small CDP Runtime.evaluate steps for MCP browser_cdp."""
import base64
import glob
import json
import os
import sys

from paths import BROWSER_VIEW_ID, CONFIG_PATH, UPLOAD_DIR

_cfg = json.loads(CONFIG_PATH.read_text())
PHOTOS_DIR = str(UPLOAD_DIR)
PLAYLIST_ID = _cfg['playlistId']
VIEW_ID = BROWSER_VIEW_ID
CHUNK = 80000


def photo_files():
    return sorted(glob.glob(os.path.join(PHOTOS_DIR, 'photo_*.jpg')))


def steps_for(index: int) -> list[dict]:
    path = photo_files()[index]
    name = os.path.basename(path)
    b64 = base64.b64encode(open(path, 'rb').read()).decode()
    parts = [b64[i : i + CHUNK] for i in range(0, len(b64), CHUNK)]
    steps: list[dict] = [
        {
            'viewId': VIEW_ID,
            'method': 'Runtime.evaluate',
            'params': {
                'expression': 'window.__b64parts=[]; window.__b64name=null;',
                'returnByValue': True,
            },
        }
    ]
    for i, part in enumerate(parts):
        steps.append(
            {
                'viewId': VIEW_ID,
                'method': 'Runtime.evaluate',
                'params': {
                    'expression': f"window.__b64parts[{i}]='{part}';",
                    'returnByValue': True,
                },
            }
        )
    steps.append(
        {
            'viewId': VIEW_ID,
            'method': 'Runtime.evaluate',
            'params': {
                'expression': (
                    f"window.__b64name='{name}'; "
                    f"(async()=>{{const b64=window.__b64parts.join(''); "
                    f"return await window.__nixplayUpload('{PLAYLIST_ID}', window.__b64name, b64);}})()"
                ),
                'awaitPromise': True,
                'returnByValue': True,
            },
        }
    )
    return steps


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'count'
    if cmd == 'count':
        print(len(photo_files()))
    elif cmd == 'steps':
        index = int(sys.argv[2])
        print(json.dumps(steps_for(index), separators=(',', ':')))
    elif cmd == 'step':
        index = int(sys.argv[2])
        step = int(sys.argv[3])
        print(json.dumps(steps_for(index)[step], separators=(',', ':')))
    elif cmd == 'nsteps':
        print(len(steps_for(int(sys.argv[2]))))
    else:
        raise SystemExit('count|steps|step|nsteps')


if __name__ == '__main__':
    main()
