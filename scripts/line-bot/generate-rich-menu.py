#!/usr/bin/env python3
"""Generate LINE Rich Menu banner (2500×843) with Traditional Chinese labels.

Visible titles on the compact rich menu come from this JPEG, not API fields.
Regenerate after copy changes:

  python3 scripts/line-bot/generate-rich-menu.py
  bash scripts/line-bot/setup-rich-menu.sh   # push to LINE (needs access token)
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "deploy/line-bot/rich-menu.jpg"

WIDTH = 2500
HEIGHT = 843
LABELS = ("找照片", "上傳教學", "使用說明", "帳戶設定")
COLORS = ("#1E54DB", "#0E7D74", "#712CE0", "#B45309")

FONT_CANDIDATES = (
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
    "/System/Library/Fonts/Supplemental/Songti.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
)


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        candidate = Path(path)
        if not candidate.exists():
            continue
        try:
            return ImageFont.truetype(str(candidate), size=size, index=0)
        except OSError:
            continue
    print(
        "error: no CJK font found; install Noto Sans CJK or run on macOS",
        file=sys.stderr,
    )
    sys.exit(1)


def draw_search_icon(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    r = size // 2
    bbox = (cx - r, cy - r, cx + r - size // 5, cy + r - size // 5)
    draw.arc(bbox, start=0, end=360, fill="white", width=max(14, size // 8))
    handle_len = size // 2
    hx = bbox[2] - size // 10
    hy = bbox[3] - size // 10
    draw.line(
        (hx, hy, hx + handle_len, hy + handle_len),
        fill="white",
        width=max(14, size // 8),
    )


def draw_upload_icon(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    half = size // 2
    box = (cx - half, cy - half + size // 8, cx + half, cy + half)
    draw.rounded_rectangle(box, radius=size // 6, outline="white", width=max(12, size // 10))
    shaft_top = cy - size // 5
    shaft_bottom = cy + size // 6
    draw.line((cx, shaft_bottom, cx, shaft_top), fill="white", width=max(12, size // 10))
    head = size // 5
    draw.polygon(
        [
            (cx, shaft_top - head),
            (cx - head, shaft_top + head // 2),
            (cx + head, shaft_top + head // 2),
        ],
        fill="white",
    )


def draw_help_icon(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    r = size // 2
    draw.ellipse(
        (cx - r, cy - r, cx + r, cy + r),
        outline="white",
        width=max(12, size // 10),
    )
    font = load_font(max(48, size // 2))
    draw.text((cx, cy), "?", fill="white", font=font, anchor="mm")


def draw_settings_icon(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int) -> None:
    r = size // 2
    draw.ellipse(
        (cx - r, cy - r, cx + r, cy + r),
        outline="white",
        width=max(12, size // 10),
    )
    tooth = size // 5
    for angle in range(0, 360, 45):
        rad = math.radians(angle)
        x0 = cx + int((r - tooth // 2) * math.cos(rad))
        y0 = cy + int((r - tooth // 2) * math.sin(rad))
        x1 = cx + int((r + tooth) * math.cos(rad))
        y1 = cy + int((r + tooth) * math.sin(rad))
        draw.line((x0, y0, x1, y1), fill="white", width=max(10, size // 12))
    inner = r // 2
    draw.ellipse(
        (cx - inner, cy - inner, cx + inner, cy + inner),
        fill="white",
    )


def main() -> None:
    img = Image.new("RGB", (WIDTH, HEIGHT), "white")
    draw = ImageDraw.Draw(img)
    quarter = WIDTH // 4
    label_font = load_font(72)
    icon_size = 180
    icon_y = int(HEIGHT * 0.34)
    label_y = int(HEIGHT * 0.72)

    icon_drawers = (
        draw_search_icon,
        draw_upload_icon,
        draw_help_icon,
        draw_settings_icon,
    )

    for index, (label, color) in enumerate(zip(LABELS, COLORS, strict=True)):
        x0 = index * quarter
        x1 = x0 + quarter if index < 3 else WIDTH
        draw.rectangle((x0, 0, x1, HEIGHT), fill=color)
        if index > 0:
            draw.line((x0, 0, x0, HEIGHT), fill="#FFFFFF", width=4)

        cx = x0 + (x1 - x0) // 2
        icon_drawers[index](draw, cx, icon_y, icon_size)
        draw.text((cx, label_y), label, fill="white", font=label_font, anchor="mm")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, format="JPEG", quality=92, optimize=True)
    print(f"wrote {OUT} ({WIDTH}×{HEIGHT})")


if __name__ == "__main__":
    main()
