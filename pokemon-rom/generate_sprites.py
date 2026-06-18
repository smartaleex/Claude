#!/usr/bin/env python3
"""
Generates 2bpp 40x40 Pokemon sprite bitmap data for the GBA ROM.
Values: 0=transparent  1=light body  2=dark/secondary  3=black outline
Run:  python3 generate_sprites.py > src/sprite_data.c
"""
import math

W, H = 40, 40

def grid():
    return [[0]*W for _ in range(H)]

def pset(g, x, y, v):
    if 0 <= x < W and 0 <= y < H:
        g[y][x] = v

def hline(g, x, y, w, v):
    for i in range(w):
        pset(g, x+i, y, v)

def vline(g, x, y, h, v):
    for i in range(h):
        pset(g, x, y+i, v)

def frect(g, x, y, w, h, fill, border=3):
    for row in range(y, y+h):
        for col in range(x, x+w):
            edge = (row==y or row==y+h-1 or col==x or col==x+w-1)
            if edge and border >= 0:
                pset(g, col, row, border)
            elif not edge and fill >= 0:
                pset(g, col, row, fill)

def ellipse(g, cx, cy, rx, ry, fill, border=3):
    if rx <= 0 or ry <= 0:
        return
    for dy in range(-ry, ry+1):
        sq = ry*ry - dy*dy
        if sq < 0: continue
        half = round(rx * math.sqrt(sq) / ry)
        for dx in range(-half, half+1):
            on_edge = (abs(dx) >= half-1 and abs(dx) <= half) or (abs(dy) == ry)
            if on_edge and border >= 0:
                pset(g, cx+dx, cy+dy, border)
            elif not on_edge and fill >= 0:
                pset(g, cx+dx, cy+dy, fill)

def circle(g, cx, cy, r, fill, border=3):
    ellipse(g, cx, cy, r, r, fill, border)

def encode(g):
    data = []
    for row in range(H):
        for b in range(0, W, 4):
            byte = 0
            for k in range(4):
                col = b + k
                v = g[row][col] if col < W else 0
                byte |= (v & 3) << (6 - k*2)
            data.append(byte)
    return data

def emit(name, g):
    data = encode(g)
    print(f"static const u8 {name}[400] = {{")
    for i in range(0, len(data), 16):
        chunk = data[i:i+16]
        print("    " + ", ".join(f"0x{b:02X}" for b in chunk) + ",")
    print("};")
    print()

# ── BULBASAUR ──────────────────────────────────────────────────────────
# 1=light green body  2=dark green bulb  3=black
def bulbasaur_f():
    g = grid()
    # Bulb (dark green, upper-right)
    ellipse(g, 27, 19, 11, 13, 2, 3)
    # Cross stripe on bulb (lighter)
    for x in range(17,38):
        if g[19][x] == 2: pset(g, x, 19, 1)
    for y in range(7,32):
        if g[y][27] == 2: pset(g, 27, y, 1)
    # Seed bumps on bulb
    for px,py in [(22,13),(31,13),(22,25),(31,25),(35,19)]:
        if g[py][px] in (1,2): pset(g, px, py, 2)
    # Body
    ellipse(g, 18, 27, 14, 9, 1, 3)
    # Head (left)
    ellipse(g, 13, 16, 8, 7, 1, 3)
    # Eyes
    circle(g, 10, 12, 2, 0, 3); pset(g, 10, 12, 3)
    circle(g, 16, 11, 2, 0, 3); pset(g, 16, 11, 3)
    # Spots on forehead
    pset(g,  8, 15, 2); pset(g, 12, 10, 2); pset(g, 17, 10, 2)
    # Mouth
    hline(g, 9, 18, 5, 3)
    # Four legs
    frect(g,  5, 33, 6, 6, 1, 3)
    frect(g, 12, 34, 6, 5, 1, 3)
    frect(g, 20, 34, 6, 5, 1, 3)
    frect(g, 27, 33, 6, 6, 1, 3)
    hline(g,  6,38,4,2); hline(g,13,38,4,2)
    hline(g, 21,38,4,2); hline(g,28,38,4,2)
    return g

def bulbasaur_b():
    g = grid()
    ellipse(g, 20, 17, 13, 15, 2, 3)
    for x in range(8,32):
        if g[17][x] == 2: pset(g, x, 17, 1)
    for y in range(3,32):
        if g[y][20] == 2: pset(g, 20, y, 1)
    ellipse(g, 20, 31, 14, 8, 1, 3)
    frect(g, 6,36,6,4,1,3); frect(g,13,36,6,4,1,3)
    frect(g,21,36,6,4,1,3); frect(g,28,36,6,4,1,3)
    return g

# ── CHARMANDER ─────────────────────────────────────────────────────────
# 1=orange  2=cream/yellow  3=black
def charmander_f():
    g = grid()
    # Body
    ellipse(g, 19, 24, 10, 12, 1, 3)
    # Cream belly (no border)
    ellipse(g, 18, 25,  6,  8, 2, -1)
    # Head
    ellipse(g, 18, 13,  9,  8, 1, 3)
    # Eyes
    circle(g,13,10,2,3,3); circle(g,22,10,2,3,3)
    pset(g,14, 9,0); pset(g,23, 9,0)
    # Nostril + mouth
    pset(g,13,15,3)
    hline(g,12,17,6,3)
    # Arms
    ellipse(g, 9,24,4,5,1,3); ellipse(g,28,23,4,5,1,3)
    # Legs
    frect(g,13,33,6,6,1,3); frect(g,21,33,6,6,1,3)
    hline(g,12,38,5,3); hline(g,20,38,5,3)
    # Tail: vertical stub right side then angle
    vline(g,31,20,8,1); vline(g,30,20,8,3); vline(g,32,20,8,3)
    hline(g,31,27,5,1); hline(g,30,28,5,3); hline(g,30,27,5,3)
    vline(g,35,21,7,1); vline(g,34,21,7,3); vline(g,36,21,7,3)
    pset(g,35,28,3)
    # Flame (orange outer, cream inner tip)
    ellipse(g,35,16,5,6,1,3)
    ellipse(g,35,13,3,4,2,-1)
    pset(g,33,11,1); pset(g,35,10,2); pset(g,37,11,1)
    return g

def charmander_b():
    g = grid()
    ellipse(g,19,24,10,12,1,3)
    ellipse(g,19,25, 6, 8,2,-1)
    ellipse(g,19,12, 9, 8,1,3)
    frect(g,13,33,6,6,1,3); frect(g,21,33,6,6,1,3)
    hline(g,12,38,5,3); hline(g,20,38,5,3)
    ellipse(g, 9,23,4,5,1,3); ellipse(g,28,22,4,5,1,3)
    # Tail going up-right for back view
    hline(g,28,22,8,1); hline(g,28,21,8,3); hline(g,28,23,8,3)
    vline(g,35,15,7,1); vline(g,34,15,7,3); vline(g,36,15,7,3)
    pset(g,35,22,3)
    ellipse(g,35,12,4,5,1,3)
    ellipse(g,35,10,2,3,2,-1)
    return g

# ── SQUIRTLE ───────────────────────────────────────────────────────────
# 1=blue body  2=brown shell  3=black
def squirtle_f():
    g = grid()
    # Shell (brown, behind body)
    ellipse(g,22,24,13,11,2,3)
    # Shell ridge lines
    hline(g, 10,24,24,3)
    vline(g, 22,14,20,3)
    for px,py in [(17,19),(27,19),(14,27),(30,27)]: pset(g,px,py,1)
    # Blue front body
    ellipse(g,19,25, 8, 9,1,3)
    # Head
    ellipse(g,18,12, 8, 8,1,3)
    circle(g,14,10,2,3,3); circle(g,22,10,2,3,3)
    pset(g,15, 9,0); pset(g,23, 9,0)
    pset(g,13,15,3)
    hline(g,13,17,7,3)
    # Arms
    ellipse(g, 9,24,4,5,1,3); ellipse(g,29,22,4,6,1,3)
    # Legs
    frect(g,12,33,6,6,1,3); frect(g,21,33,6,6,1,3)
    hline(g,11,38,5,3); hline(g,20,38,5,3)
    # Curly tail
    circle(g,35,26,4,1,3); circle(g,37,31,3,1,3)
    return g

def squirtle_b():
    g = grid()
    ellipse(g,20,23,14,12,2,3)
    hline(g,7,23,26,3); vline(g,20,12,22,3)
    for px,py in [(15,18),(25,18),(12,27),(28,27)]: pset(g,px,py,1)
    ellipse(g,20,24, 8, 9,1,3)
    ellipse(g,18,11, 8, 8,1,3)
    frect(g,12,33,6,6,1,3); frect(g,23,33,6,6,1,3)
    ellipse(g, 8,23,4,5,1,3); ellipse(g,30,22,4,6,1,3)
    circle(g, 5,26,4,1,3); circle(g, 4,31,3,1,3)
    return g

# ── PIKACHU ─────────────────────────────────────────────────────────────
# 1=yellow  2=red cheeks (drawn as val=2 so c2=red)  3=black
def pikachu_f():
    g = grid()
    # Left ear: tall narrow oval, black tip
    ellipse(g,12, 7, 3, 8,1,3)
    frect(g, 9, 0, 7, 5,3,3)
    # Right ear
    ellipse(g,28, 6, 3, 8,1,3)
    frect(g,25, 0, 7, 5,3,3)
    # Head (wide oval)
    ellipse(g,19,18,13, 9,1,3)
    # Eyes
    circle(g,14,15,2,3,3); circle(g,24,15,2,3,3)
    pset(g,15,14,0); pset(g,25,14,0)
    # Red cheeks (color 2)
    circle(g,11,21,4,2,-1)
    circle(g,27,21,4,2,-1)
    # Nose + mouth
    pset(g,19,18,3)
    hline(g,17,20,5,3)
    pset(g,16,21,3); pset(g,22,21,3)
    # Back stripes (dark brown = just use 3 for black lines)
    hline(g,12,24,6,3); hline(g,23,24,5,3)
    # Body
    ellipse(g,19,29,11, 9,1,3)
    # Arms
    ellipse(g, 7,29,3,5,1,3); ellipse(g,31,28,3,5,1,3)
    # Legs
    frect(g,13,36,6,4,1,3); frect(g,22,36,6,4,1,3)
    hline(g,12,39,5,3); hline(g,21,39,5,3)
    # Lightning bolt tail (upper-right zigzag)
    frect(g,33,21,5,5,1,3)
    frect(g,30,26,5,5,1,3)
    frect(g,33,31,5,5,1,3)
    return g

def pikachu_b():
    g = grid()
    ellipse(g,12, 7,3,8,1,3); frect(g, 9,0,7,5,3,3)
    ellipse(g,28, 6,3,8,1,3); frect(g,25,0,7,5,3,3)
    ellipse(g,19,18,13,9,1,3)
    circle(g,11,21,4,2,-1); circle(g,27,21,4,2,-1)
    hline(g,12,24,6,3); hline(g,23,24,5,3)
    ellipse(g,19,29,11,9,1,3)
    ellipse(g, 7,29,3,5,1,3); ellipse(g,31,28,3,5,1,3)
    frect(g,13,36,6,4,1,3); frect(g,22,36,6,4,1,3)
    hline(g,12,39,5,3); hline(g,21,39,5,3)
    # Tail on left for back view
    frect(g, 2,21,5,5,1,3)
    frect(g, 5,26,5,5,1,3)
    frect(g, 2,31,5,5,1,3)
    return g

# ── GENGAR ─────────────────────────────────────────────────────────────
# 1=dark purple body  2=red eyes  3=black
def gengar_f():
    g = grid()
    # Main body
    ellipse(g,19,23,17,15,1,3)
    # Spiky head bumps (3 top bumps)
    circle(g,10, 9,5,1,3)
    circle(g,19, 7,5,1,3)
    circle(g,28, 9,5,1,3)
    # Side ear spikes
    circle(g, 5,17,4,1,3)
    circle(g,33,17,4,1,3)
    # Eyes (red = val 2)
    circle(g,13,19,3,2,3); pset(g,13,19,3)
    circle(g,25,19,3,2,3); pset(g,25,19,3)
    # Wide grin
    hline(g, 8,27,23,3)
    hline(g, 9,28,21,3)
    # White teeth gaps in grin (val 0 = transparent over grin)
    for tx in [9,12,15,18,21,24,27]:
        pset(g,tx,27,0); pset(g,tx+1,27,0)
    # Tongue (red)
    ellipse(g,19,31,5,3,2,3)
    # Side hands
    circle(g, 2,28,3,1,3); circle(g, 2,34,3,1,3)
    circle(g,36,28,3,1,3); circle(g,36,34,3,1,3)
    # Bottom finger bumps
    circle(g,12,38,3,1,3); circle(g,19,39,3,1,3); circle(g,26,38,3,1,3)
    return g

def gengar_b():
    g = grid()
    ellipse(g,19,23,17,15,1,3)
    circle(g,10, 9,5,1,3); circle(g,19, 7,5,1,3); circle(g,28, 9,5,1,3)
    circle(g, 5,17,4,1,3); circle(g,33,17,4,1,3)
    circle(g, 2,28,3,1,3); circle(g, 2,34,3,1,3)
    circle(g,36,28,3,1,3); circle(g,36,34,3,1,3)
    circle(g,12,38,3,1,3); circle(g,19,39,3,1,3); circle(g,26,38,3,1,3)
    return g

# ── MEWTWO ─────────────────────────────────────────────────────────────
# 1=light gray-purple  2=dark purple (tube, shading)  3=black
def mewtwo_f():
    g = grid()
    # Psychic tube (back of head, left side, dark)
    frect(g, 5, 3,5,14,2,3)
    circle(g, 7, 3,4,2,3)
    # Large round head
    ellipse(g,20,14,14,12,1,3)
    # Lighter inner face
    ellipse(g,22,14, 8, 7,2,-1)
    # Narrow slanted eyes
    hline(g,14,11,7,3); hline(g,23,11,6,3)
    pset(g,13,12,3); pset(g,21,12,3)
    pset(g,22,10,3); pset(g,29,10,3)
    # Thin neck
    frect(g,17,24,7,5,1,3)
    # Body
    ellipse(g,20,32,9,7,1,3)
    ellipse(g,20,33,5,5,2,-1)
    # Arms (thin, angled)
    ellipse(g, 8,31,4,8,1,3)
    ellipse(g,32,30,4,8,1,3)
    # Legs
    frect(g,13,37,6,3,1,3); frect(g,21,37,6,3,1,3)
    # Long tail curves right side
    vline(g,36,10,22,2); vline(g,37,10,22,3); vline(g,35,10,22,3)
    circle(g,36,33,4,2,3)
    return g

def mewtwo_b():
    g = grid()
    # Tube on right side for back view
    frect(g,30, 3,5,14,2,3); circle(g,32, 3,4,2,3)
    ellipse(g,20,14,14,12,1,3)
    ellipse(g,18,14, 8, 7,2,-1)
    frect(g,17,24,7,5,1,3)
    ellipse(g,20,32,9,7,1,3)
    ellipse(g,20,33,5,5,2,-1)
    ellipse(g, 8,31,4,8,1,3); ellipse(g,32,30,4,8,1,3)
    frect(g,13,37,6,3,1,3); frect(g,21,37,6,3,1,3)
    # Tail on left for back
    vline(g, 4,10,22,2); vline(g, 5,10,22,3); vline(g, 3,10,22,3)
    circle(g, 4,33,4,2,3)
    return g

# ── main ───────────────────────────────────────────────────────────────
sprites = [
    ("spr_bulbasaur_f",  bulbasaur_f()),
    ("spr_bulbasaur_b",  bulbasaur_b()),
    ("spr_charmander_f", charmander_f()),
    ("spr_charmander_b", charmander_b()),
    ("spr_squirtle_f",   squirtle_f()),
    ("spr_squirtle_b",   squirtle_b()),
    ("spr_pikachu_f",    pikachu_f()),
    ("spr_pikachu_b",    pikachu_b()),
    ("spr_gengar_f",     gengar_f()),
    ("spr_gengar_b",     gengar_b()),
    ("spr_mewtwo_f",     mewtwo_f()),
    ("spr_mewtwo_b",     mewtwo_b()),
]

print("/* Auto-generated by generate_sprites.py — do not edit */")
print('#include "game.h"')
print()
print("/* 2bpp 40x40 sprite data: 10 bytes/row x 40 rows = 400 bytes each */")
print("/* Pixel values: 0=transparent 1=c1(light) 2=c2(dark) 3=black     */")
print()
for name, g in sprites:
    emit(name, g)

print("const u8* const spr_table[6][2] = {")
for n in ["bulbasaur","charmander","squirtle","pikachu","gengar","mewtwo"]:
    print(f"    {{ spr_{n}_f, spr_{n}_b }},")
print("};")
print()
