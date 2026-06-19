#!/usr/bin/env python3
"""Patch the GBA ROM header complement checksum (byte 0xBD)."""
import sys, struct

def fix_header(path):
    with open(path, 'rb') as f:
        data = bytearray(f.read())
    if len(data) < 0xC0:
        print(f"File too small: {len(data)} bytes"); return
    checksum = 0x19
    for b in data[0xA0:0xBD]:
        checksum += b
    data[0xBD] = (-checksum) & 0xFF
    with open(path, 'wb') as f:
        f.write(data)
    print(f"Header checksum fixed: 0x{data[0xBD]:02X}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: fix_header.py <rom.gba>"); sys.exit(1)
    fix_header(sys.argv[1])
