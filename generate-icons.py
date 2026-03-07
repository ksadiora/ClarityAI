#!/usr/bin/env python3
"""Generate extension icons - run with: python3 scripts/generate-icons.py"""
import base64
import struct
import zlib
import os

# Minimal valid 16x16 red PNG (simplified structure)
def create_png(width, height, r, g, b):
    def png_chunk(chunk_type, data):
        chunk = chunk_type + data
        return struct.pack(">I", len(data)) + chunk + struct.pack(">I", zlib.crc32(chunk) & 0xffffffff)
    
    # Raw pixel data: 1 byte filter + width*height*3 for RGB
    raw = b'\x00'  # filter
    for _ in range(width * height):
        raw += bytes([r, g, b])
    
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    idat = zlib.compress(raw, 9)
    
    signature = b'\x89PNG\r\n\x1a\n'
    chunks = (
        png_chunk(b'IHDR', ihdr) +
        png_chunk(b'IDAT', idat) +
        png_chunk(b'IEND', b'')
    )
    return signature + chunks

os.makedirs('../icons', exist_ok=True)
color = (124, 92, 255)  # Accent purple
for size in [16, 48, 128]:
    png = create_png(size, size, *color)
    with open(f'../icons/icon{size}.png', 'wb') as f:
        f.write(png)
print("Icons generated in icons/")
