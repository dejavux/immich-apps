"""Shared paths for digital frame export tooling (local .data/, not committed)."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ.get("DIGITAL_FRAMES_DATA", ROOT / ".data"))
CONFIG_PATH = Path(os.environ.get("NIXPLAY_CONFIG", ROOT / "nixplay_config.json"))
BEST2025_DIR = DATA / "best2025"
UPLOAD_DIR = DATA / "best2025_upload"
MANIFEST_PATH = DATA / "selection_manifest.json"
BROWSER_VIEW_ID = os.environ.get(
    "NIXPLAY_BROWSER_VIEW_ID",
    "glass-browser-91c87e0d-5fd0-4113-b986-6880e9ad776f",
)
