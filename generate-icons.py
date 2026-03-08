#!/usr/bin/env python3
"""Generate Clairity extension icons: circle inside a circle. Run from extension root: python3 generate-icons.py"""
import struct
import zlib
import os
import math

def create_circle_icon_png(size, r, g, b):
    """Create a PNG with two concentric circles (circle inside a circle). Purple on transparent."""
    cx = cy = (size - 1) / 2.0
    outer_r = size / 2.0 - 1.2
    inner_r = size / 4.0
    stroke = max(0.8, size / 24.0)

    def on_circle(px, py, radius):
        d = math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
        return radius - stroke <= d <= radius + stroke

    raw = b''
    for y in range(size):
        raw += b'\x00'
        for x in range(size):
            if on_circle(x, y, outer_r) or on_circle(x, y, inner_r):
                raw += bytes([r, g, b, 255])
            else:
                raw += bytes([0, 0, 0, 0])

    def png_chunk(chunk_type, data):
        chunk = chunk_type + data
        return struct.pack(">I", len(data)) + chunk + struct.pack(">I", zlib.crc32(chunk) & 0xffffffff)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw, 9)
    signature = b'\x89PNG\r\n\x1a\n'
    chunks = png_chunk(b'IHDR', ihdr) + png_chunk(b'IDAT', idat) + png_chunk(b'IEND', b'')
    return signature + chunks

os.makedirs('icons', exist_ok=True)
color = (124, 92, 255)
for s in [16, 48, 128]:
    png = create_circle_icon_png(s, *color)
    with open(f'icons/icon{s}.png', 'wb') as f:
        f.write(png)
print("Clairity icons (circle in circle) generated in icons/")
