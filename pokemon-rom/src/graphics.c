#include "game.h"

/* ── Pixel / fill primitives ─────────────────────────────────────── */

void gfx_draw_pixel(int x, int y, u16 color) {
    if ((unsigned)x < SCREEN_W && (unsigned)y < SCREEN_H)
        VRAM[y * SCREEN_W + x] = color;
}

void gfx_fill(u16 color) {
    volatile u32* p = (volatile u32*)VRAM;
    u32 c32 = (u32)color | ((u32)color << 16);
    for (int i = 0; i < (SCREEN_W * SCREEN_H / 2); i++)
        p[i] = c32;
}

void gfx_fill_rect(int x, int y, int w, int h, u16 color) {
    int x2 = x + w, y2 = y + h;
    if (x < 0) x = 0; if (y < 0) y = 0;
    if (x2 > SCREEN_W) x2 = SCREEN_W;
    if (y2 > SCREEN_H) y2 = SCREEN_H;
    for (int row = y; row < y2; row++) {
        volatile u16* p = VRAM + row * SCREEN_W + x;
        for (int col = x; col < x2; col++) *p++ = color;
    }
}

void gfx_draw_hline(int x, int y, int w, u16 color) {
    gfx_fill_rect(x, y, w, 1, color);
}

void gfx_draw_vline(int x, int y, int h, u16 color) {
    gfx_fill_rect(x, y, 1, h, color);
}

void gfx_draw_rect(int x, int y, int w, int h, u16 color) {
    gfx_draw_hline(x, y, w, color);
    gfx_draw_hline(x, y+h-1, w, color);
    gfx_draw_vline(x, y, h, color);
    gfx_draw_vline(x+w-1, y, h, color);
}

/* ── Circle / ellipse ────────────────────────────────────────────── */

static int isqrt(int n) {
    if (n <= 0) return 0;
    int x = n, y = (x + 1) >> 1;
    while (y < x) { x = y; y = (x + gba_div(n, x)) >> 1; }
    return x;
}

void gfx_draw_circle(int cx, int cy, int r, u16 fill, u16 border) {
    for (int y = -r; y <= r; y++) {
        int half = isqrt(r*r - y*y);
        if (fill != 0xFFFF)
            gfx_draw_hline(cx - half, cy + y, half*2+1, fill);
        gfx_draw_pixel(cx - half, cy + y, border);
        gfx_draw_pixel(cx + half, cy + y, border);
    }
}

void gfx_draw_ellipse(int cx, int cy, int rx, int ry, u16 fill, u16 border) {
    for (int y = -ry; y <= ry; y++) {
        /* x = rx * sqrt(1 - (y/ry)^2) */
        int sq = ry*ry - y*y;
        if (sq < 0) sq = 0;
        int half = gba_div(rx * isqrt(sq * 256), ry * 16);
        if (fill != 0xFFFF)
            gfx_draw_hline(cx - half, cy + y, half*2+1, fill);
        gfx_draw_pixel(cx - half, cy + y, border);
        gfx_draw_pixel(cx + half, cy + y, border);
    }
}

/* ── HP bar ──────────────────────────────────────────────────────── */

void gfx_draw_hp_bar(int x, int y, int w, int h, int hp, int max_hp) {
    if (max_hp <= 0) max_hp = 1;
    int filled = gba_div(hp * w, max_hp);
    if (filled > w) filled = w;
    if (filled < 0) filled = 0;

    u16 bar_color;
    int pct = gba_div(hp * 100, max_hp);
    if (pct > 50) bar_color = RGB(0, 28, 0);
    else if (pct > 20) bar_color = RGB(31, 28, 0);
    else bar_color = RGB(31, 0, 0);

    gfx_fill_rect(x, y, w, h, COL_DGRAY);
    if (filled > 0) gfx_fill_rect(x, y, filled, h, bar_color);
    gfx_draw_rect(x-1, y-1, w+2, h+2, COL_LGRAY);
}

/* ── Pokemon silhouette sprite ───────────────────────────────────── */

/* Draw a stylized Pokemon sprite using ellipses colored by type.
   The shape varies by species_id to give each Pokemon a unique look. */
void gfx_draw_pokemon(int cx, int cy, int radius, u16 species_id, int back) {
    const SpeciesData* sp = &species_data[species_id];
    u16 fill = TYPE_COLORS[sp->type1];
    u16 border = COL_BLACK;

    /* vary shape using species_id */
    u8 variant = (u8)(species_id & 0xFF) ^ (u8)(species_id >> 8);

    int rx = radius;
    int ry = radius;

    /* Some species are wider, some taller, some rounder */
    u8 shape = variant & 3;
    if (shape == 0) { rx = radius; ry = (radius*3)/4; }          /* wide */
    else if (shape == 1) { rx = (radius*3)/4; ry = radius; }     /* tall */
    else if (shape == 2) { rx = (radius*5)/6; ry = (radius*5)/6;} /* round */
    else { rx = radius; ry = radius; }

    if (back) {
        /* back sprite: slightly smaller, viewed from behind */
        rx = (rx * 4) / 5;
        ry = (ry * 4) / 5;
        cy += radius / 5;
    }

    /* body */
    gfx_draw_ellipse(cx, cy, rx, ry, fill, border);

    /* head (smaller circle above body, if radius big enough) */
    if (radius >= 18) {
        int hr = (radius * 2) / 5;
        int hx = cx + (back ? 0 : (((variant>>2)&1) ? -rx/4 : rx/4));
        int hy = cy - ry - hr + 3;
        u16 hfill = TYPE_COLORS[(sp->type2 != TYPE_NONE) ? sp->type2 : sp->type1];
        gfx_draw_ellipse(hx, hy, hr, hr, hfill, border);

        /* eye dots */
        if (!back) {
            gfx_draw_pixel(hx + 2, hy - 2, COL_WHITE);
            gfx_draw_pixel(hx - 2, hy - 2, COL_WHITE);
        }
    }

    /* optional tail / feature based on variant */
    if ((variant & 0x0C) == 0x04 && radius >= 16) {
        /* tail to the right */
        int tx = cx + rx;
        for (int i = 0; i < radius/3; i++) {
            gfx_draw_pixel(tx + i, cy - i/2, fill);
            gfx_draw_pixel(tx + i, cy - i/2 + 1, border);
        }
    } else if ((variant & 0x0C) == 0x08 && radius >= 16) {
        /* fin on top */
        for (int i = 0; i < radius/3; i++) {
            gfx_draw_pixel(cx, cy - ry - i, fill);
        }
    }
}
