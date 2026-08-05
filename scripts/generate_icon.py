from __future__ import annotations

import struct
import zlib
from pathlib import Path

SIZE = 1024
BLUE = (13, 71, 199, 255)
WHITE = (255, 255, 255, 255)
SOFT = (86, 135, 235, 255)

pixels = bytearray(BLUE * (SIZE * SIZE))


def put(x: int, y: int, color: tuple[int, int, int, int]) -> None:
    if 0 <= x < SIZE and 0 <= y < SIZE:
        offset = (y * SIZE + x) * 4
        pixels[offset : offset + 4] = bytes(color)


def rounded_rect(left: int, top: int, right: int, bottom: int, radius: int, color: tuple[int, int, int, int]) -> None:
    for y in range(top, bottom):
        for x in range(left, right):
            cx = left + radius if x < left + radius else right - radius - 1 if x >= right - radius else x
            cy = top + radius if y < top + radius else bottom - radius - 1 if y >= bottom - radius else y
            if (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2:
                put(x, y, color)


def circle(cx: int, cy: int, radius: int, color: tuple[int, int, int, int]) -> None:
    r2 = radius * radius
    for y in range(cy - radius, cy + radius + 1):
        for x in range(cx - radius, cx + radius + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                put(x, y, color)


def line(x1: int, y1: int, x2: int, y2: int, width: int, color: tuple[int, int, int, int]) -> None:
    dx = x2 - x1
    dy = y2 - y1
    steps = max(abs(dx), abs(dy))
    for step in range(steps + 1):
        x = round(x1 + dx * step / steps)
        y = round(y1 + dy * step / steps)
        circle(x, y, width // 2, color)


rounded_rect(112, 112, 912, 912, 170, SOFT)
rounded_rect(210, 295, 680, 337, 21, WHITE)
rounded_rect(210, 491, 555, 533, 21, WHITE)
rounded_rect(210, 687, 465, 729, 21, WHITE)

for x, y in ((785, 316), (660, 512), (565, 708)):
    circle(x, y, 62, WHITE)
    circle(x, y, 26, BLUE)

line(235, 220, 300, 285, 34, WHITE)
line(300, 285, 430, 155, 34, WHITE)


def chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


raw = b"".join(b"\x00" + bytes(pixels[y * SIZE * 4 : (y + 1) * SIZE * 4]) for y in range(SIZE))
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")

output = Path(__file__).resolve().parents[1] / "src-tauri" / "icons" / "icon.png"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes(png)
print(output)
