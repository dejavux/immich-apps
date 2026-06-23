#!/usr/bin/env python3
"""Normalize markdown tables to padded pipe style (| col |) for MD060."""
from __future__ import annotations

import re
import sys
from pathlib import Path

TABLE_LINE = re.compile(r"^\s*\|.+\|\s*$")
SEPARATOR_CELL = re.compile(r"^:?-{1,}:?$")


def is_separator_row(cells: list[str]) -> bool:
    return bool(cells) and all(SEPARATOR_CELL.match(c.strip()) for c in cells)


def format_row(cells: list[str], separator: bool) -> str:
    if separator:
        formatted = []
        for cell in cells:
            c = cell.strip()
            left = c.startswith(":")
            right = c.endswith(":")
            core = c.strip(":")
            if not core:
                core = "---"
            elif len(core) < 3:
                core = core.ljust(3, "-")
            dash = f"{':' if left else ''}{core}{':' if right else ''}"
            formatted.append(dash)
        cells = formatted
    else:
        cells = [c.strip() if c.strip() else " " for c in cells]
    return "| " + " | ".join(cells) + " |"


def fix_line(line: str) -> str:
    if not TABLE_LINE.match(line):
        return line
    stripped = line.strip()
    inner = stripped[1:-1]
    cells = [c.strip() for c in inner.split("|")]
    sep = is_separator_row(cells)
    return format_row(cells, sep)


def fix_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    changed = False
    out: list[str] = []
    for line in lines:
        nl = "\n" if line.endswith("\n") else ""
        body = line[:-1] if nl else line
        fixed = fix_line(body)
        if fixed != body:
            changed = True
        out.append(fixed + nl)
    if changed:
        path.write_text("".join(out), encoding="utf-8")
    return changed


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    patterns = ["**/*.md"]
    skip = {"node_modules"}
    n = 0
    for pat in patterns:
        for path in root.glob(pat):
            if any(part in skip for part in path.parts):
                continue
            if fix_file(path):
                n += 1
                print(path.relative_to(root))
    print(f"fixed {n} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
