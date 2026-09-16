#!/usr/bin/env bash
# Build 1920px JPEGs for Pix-Star / Nixplay direct upload.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DATA="${DIGITAL_FRAMES_DATA:-$ROOT/.data}"
SRC="$DATA/best2025"
OUT="$DATA/best2025_upload"
MAX_DIM="${MAX_DIM:-1920}"
QUALITY="${JPEG_QUALITY:-85}"

mkdir -p "$OUT"
rm -f "$OUT"/photo_*.jpg
shopt -s nullglob
for heic in "$SRC"/photo_*.heic; do
  bn=$(basename "$heic")
  num="${bn#photo_}"; num="${num%%.*}"
  sips -Z "$MAX_DIM" -s format jpeg -s formatOptions "$QUALITY" "$heic" \
    --out "$OUT/photo_${num}.jpg" >/dev/null 2>&1
done
for jpg in "$SRC"/photo_*.{jpg,jpeg,JPG,JPEG}; do
  [[ -f "$jpg" ]] || continue
  bn=$(basename "$jpg")
  num="${bn#photo_}"; num="${num%%.*}"
  out="$OUT/photo_${num}.jpg"
  [[ -f "$out" ]] && continue
  sips -Z "$MAX_DIM" -s format jpeg -s formatOptions "$QUALITY" "$jpg" \
    --out "$out" >/dev/null 2>&1
done
count=$(find "$OUT" -maxdepth 1 -name 'photo_*.jpg' 2>/dev/null | wc -l | tr -d ' ')
sample="$OUT/photo_000.jpg"
if [[ -f "$sample" ]]; then
  w=$(sips -g pixelWidth "$sample" 2>/dev/null | awk '/pixelWidth/ {print $2}')
  h=$(sips -g pixelHeight "$sample" 2>/dev/null | awk '/pixelHeight/ {print $2}')
  kb=$(($(stat -f%z "$sample") / 1024))
  echo "Sample photo_000.jpg: ${w}x${h}, ${kb}KB"
fi
echo "Wrote $count files to $OUT (max ${MAX_DIM}px, quality ${QUALITY})"
