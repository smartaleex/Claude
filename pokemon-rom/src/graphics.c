#include "game.h"

/* ── Palette management ──────────────────────────────────────────── */

static u16  pal_cache[256];   /* RGB15 value for each palette index    */
static u8   pal_count = 1;    /* index 0 = black, start at 1           */

u8 gfx_back_page = 1;         /* currently drawing to page 1           */

/* Map an RGB15 color to a palette index, registering if not present. */
static u8 pal_idx(u16 rgb15) {
    if (rgb15 == COL_BLACK) return 0;
    /* 4-entry MRU cache — text rendering repeatedly uses the same few colors */
    static u16 cc[4] = {0,0,0,0};
    static u8  ci[4] = {0,0,0,0};
    static u8  ch    = 0;
    if (cc[0] == rgb15) return ci[0];
    if (cc[1] == rgb15) return ci[1];
    if (cc[2] == rgb15) return ci[2];
    if (cc[3] == rgb15) return ci[3];
    for (u8 i = 1; i < pal_count; i++) {
        if (pal_cache[i] == rgb15) {
            cc[ch] = rgb15; ci[ch] = i; ch = (ch + 1) & 3;
            return i;
        }
    }
    if (pal_count < 255) {
        u8 idx = pal_count++;
        pal_cache[idx] = rgb15;
        PAL_BG[idx]    = rgb15;
        cc[ch] = rgb15; ci[ch] = idx; ch = (ch + 1) & 3;
        return idx;
    }
    return 1; /* palette full — fall back to first non-black */
}

/* DMA3 32-bit fill: fills 'words' 32-bit words at dst with val. */
static volatile u32 dma_fill_val;

static void dma3_fill32(volatile void* dst, u32 val, u32 words) {
    dma_fill_val  = val;
    REG_DMA3SAD   = (u32)&dma_fill_val;
    REG_DMA3DAD   = (u32)dst;
    REG_DMA3CNT_L = (u16)words;
    REG_DMA3CNT_H = 0x8500;   /* enable | 32-bit transfer | src fixed */
    /* Immediate DMA: hardware stalls CPU until done; no polling needed */
}

void gfx_init(void) {
    /* Palette entry 0 = black (shown when pixel index is 0) */
    PAL_BG[0]    = COL_BLACK;
    pal_cache[0] = COL_BLACK;
    pal_count    = 1;

    /* Pre-register named colors so their indices are stable */
    pal_idx(COL_WHITE);   pal_idx(COL_RED);     pal_idx(COL_GREEN);
    pal_idx(COL_BLUE);    pal_idx(COL_YELLOW);  pal_idx(COL_ORANGE);
    pal_idx(COL_PURPLE);  pal_idx(COL_CYAN);    pal_idx(COL_PINK);
    pal_idx(COL_GRAY);    pal_idx(COL_DGRAY);   pal_idx(COL_LGRAY);
    pal_idx(COL_BROWN);   pal_idx(COL_DARKBLUE);pal_idx(COL_DARKGREEN);
    pal_idx(COL_DKRED);   pal_idx(COL_GOLD);    pal_idx(COL_SILVER);
    pal_idx(COL_TAN);     pal_idx(COL_SKYBLUE); pal_idx(COL_GRASS);
    pal_idx(COL_WATER);   pal_idx(COL_SAND);    pal_idx(COL_BARK);
    for (int i = 0; i < 19; i++) pal_idx(TYPE_COLORS[i]);
    /* Overworld tile colors */
    pal_idx(RGB( 8,20, 6)); pal_idx(RGB( 4,16, 2)); pal_idx(RGB(22,18,12));
    pal_idx(RGB( 4,16,26)); pal_idx(RGB( 4,12, 2)); pal_idx(RGB(10,10,10));
    pal_idx(RGB(26,24,14)); pal_idx(RGB(20,16, 6)); pal_idx(RGB( 8,22, 6));
    pal_idx(RGB( 8, 8, 8));
    /* Tile detail colors */
    pal_idx(RGB(4,18,2));   pal_idx(RGB(2,22,0));   pal_idx(RGB(8,20,30));
    pal_idx(RGB(24,20,8));  pal_idx(RGB(18,16,10)); pal_idx(RGB(7,7,7));
    /* HUD background colors */
    pal_idx(RGB(2,4,6));    pal_idx(RGB(2,4,8));    pal_idx(RGB(2,4,10));
    pal_idx(RGB(4,8,16));   pal_idx(RGB(4,8,20));   pal_idx(RGB(2,4,10));
    pal_idx(RGB(2,6,18));   pal_idx(RGB(4,6,8));    pal_idx(RGB(2,4,12));
    /* Battle background colors */
    pal_idx(RGB(20,24,12)); pal_idx(RGB(14,18,8));  pal_idx(RGB(16,20,10));
    pal_idx(RGB(18,14, 6)); pal_idx(RGB(14,10, 4)); pal_idx(RGB(10,14,18));
    pal_idx(RGB( 6,10,14)); pal_idx(RGB( 0,28, 0));
    pal_idx(RGB(31,28, 0)); pal_idx(RGB(31, 0, 0));
    /* Named Pokemon sprite colors */
    pal_idx(RGB( 8,22,14)); pal_idx(RGB(14,28,20)); pal_idx(RGB( 2,12, 4));
    pal_idx(RGB(20,24, 0)); pal_idx(RGB(28,22, 0));   /* Bulbasaur */
    pal_idx(RGB(31,14, 4)); pal_idx(RGB(31,26,18)); pal_idx(RGB(31,28, 2));
    pal_idx(RGB(31,14, 2));                            /* Charmander */
    pal_idx(RGB( 8,18,28)); pal_idx(RGB(20,24,28)); pal_idx(RGB(18,14, 4));
    pal_idx(RGB( 8,18, 4));                            /* Squirtle */
    pal_idx(RGB(31,28, 4)); pal_idx(RGB(20,12, 2)); pal_idx(RGB(31, 4, 4));  /* Pikachu */
    pal_idx(RGB(14, 6,18)); pal_idx(RGB(20,10,24)); pal_idx(RGB(28, 4, 4));  /* Gengar */
    pal_idx(RGB(22,16,24)); pal_idx(RGB(28,20,28));                          /* Mewtwo */

    /* BG2 affine: identity matrix — Mode 4 uses affine BG2, and without
       the BIOS the PA/PD registers default to garbage (often −1.0),
       which mirrors or scales the display. Explicitly set 1:1 scale. */
    REG_BG2PA = 0x0100;   /* x-scale = 1.0 in 8.8 fixed point */
    REG_BG2PB = 0x0000;   /* x-shear = 0                      */
    REG_BG2PC = 0x0000;   /* y-shear = 0                      */
    REG_BG2PD = 0x0100;   /* y-scale = 1.0                    */
    REG_BG2X  = 0;        /* reference point X = 0            */
    REG_BG2Y  = 0;        /* reference point Y = 0            */

    /* Clear both VRAM pages to black (palette index 0) */
    dma3_fill32(VRAM_PAGE0, 0, SCREEN_W * SCREEN_H / 4);
    dma3_fill32(VRAM_PAGE1, 0, SCREEN_W * SCREEN_H / 4);

    gfx_back_page = 1;   /* start drawing to page 1; page 0 displayed */
}

/* ── Back-buffer pointer ─────────────────────────────────────────── */

static inline volatile u16* back_buf(void) {
    return gfx_back_page ? VRAM_PAGE1 : VRAM_PAGE0;
}

/* Write one pixel into the back buffer (Mode 4: 2 pixels per u16). */
static inline void m4_pixel(volatile u16* vram, int x, int y, u8 idx) {
    volatile u16* cell = vram + (y * (SCREEN_W / 2) + (x >> 1));
    if (x & 1)
        *cell = (*cell & 0x00FFu) | ((u16)idx << 8);
    else
        *cell = (*cell & 0xFF00u) | (u16)idx;
}

/* ── Public drawing primitives ───────────────────────────────────── */

u8 gfx_color_idx(u16 color) {
    return pal_idx(color);
}

void gfx_draw_pixel_idx(int x, int y, u8 idx) {
    if ((unsigned)x >= SCREEN_W || (unsigned)y >= SCREEN_H) return;
    m4_pixel(back_buf(), x, y, idx);
}

void gfx_draw_pixel(int x, int y, u16 color) {
    if ((unsigned)x >= SCREEN_W || (unsigned)y >= SCREEN_H) return;
    if (color == 0xFFFF) return;
    m4_pixel(back_buf(), x, y, pal_idx(color));
}

void gfx_fill(u16 color) {
    u8  idx    = pal_idx(color);
    u32 packed = (u32)idx | ((u32)idx << 8) | ((u32)idx << 16) | ((u32)idx << 24);
    dma3_fill32(back_buf(), packed, SCREEN_W * SCREEN_H / 4);
}

void gfx_fill_rect(int x, int y, int w, int h, u16 color) {
    int x2 = x + w, y2 = y + h;
    if (x  < 0)       x  = 0;
    if (y  < 0)       y  = 0;
    if (x2 > SCREEN_W) x2 = SCREEN_W;
    if (y2 > SCREEN_H) y2 = SCREEN_H;
    if (x >= x2 || y >= y2) return;

    u8  idx  = pal_idx(color);
    u16 pair = (u16)idx | ((u16)idx << 8);
    volatile u16* vram = back_buf();

    for (int row = y; row < y2; row++) {
        volatile u16* line = vram + row * (SCREEN_W / 2);
        int col = x;

        /* handle odd left edge */
        if (col & 1) {
            volatile u16* cell = line + (col >> 1);
            *cell = (*cell & 0x00FFu) | ((u16)idx << 8);
            col++;
        }
        /* bulk 16-bit pair writes */
        volatile u16* p     = line + (col >> 1);
        int           pairs = (x2 - col) >> 1;
        for (int i = 0; i < pairs; i++) *p++ = pair;
        col += pairs << 1;

        /* handle odd right edge */
        if (col < x2)
            *p = (*p & 0xFF00u) | (u16)idx;
    }
}

void gfx_draw_hline(int x, int y, int w, u16 color) {
    gfx_fill_rect(x, y, w, 1, color);
}

void gfx_draw_vline(int x, int y, int h, u16 color) {
    gfx_fill_rect(x, y, 1, h, color);
}

void gfx_draw_rect(int x, int y, int w, int h, u16 color) {
    gfx_draw_hline(x,     y,     w, color);
    gfx_draw_hline(x,     y+h-1, w, color);
    gfx_draw_vline(x,     y,     h, color);
    gfx_draw_vline(x+w-1, y,     h, color);
}

/* ── Circle / ellipse ────────────────────────────────────────────── */

static int isqrt(int n) {
    if (n <= 0) return 0;
    /* Start near sqrt(n) using bit length to get fast Newton convergence */
    int x = 1;
    int tmp = n;
    while (tmp > 3) { tmp >>= 2; x <<= 1; }
    int y = (x + gba_div(n, x)) >> 1;
    while (y < x) { x = y; y = (x + gba_div(n, x)) >> 1; }
    return x;
}

void gfx_draw_circle(int cx, int cy, int r, u16 fill, u16 border) {
    for (int dy = -r; dy <= r; dy++) {
        int half = isqrt(r*r - dy*dy);
        if (fill != 0xFFFF)
            gfx_draw_hline(cx - half, cy + dy, half*2+1, fill);
        gfx_draw_pixel(cx - half, cy + dy, border);
        gfx_draw_pixel(cx + half, cy + dy, border);
    }
}

void gfx_draw_ellipse(int cx, int cy, int rx, int ry, u16 fill, u16 border) {
    for (int dy = -ry; dy <= ry; dy++) {
        int sq = ry*ry - dy*dy;
        if (sq < 0) sq = 0;
        int half = (ry > 0) ? gba_div(rx * isqrt(sq), ry) : 0;
        if (fill != 0xFFFF)
            gfx_draw_hline(cx - half, cy + dy, half*2+1, fill);
        gfx_draw_pixel(cx - half, cy + dy, border);
        gfx_draw_pixel(cx + half, cy + dy, border);
    }
}

/* ── HP bar ──────────────────────────────────────────────────────── */

void gfx_draw_hp_bar(int x, int y, int w, int h, int hp, int max_hp) {
    if (max_hp <= 0) max_hp = 1;
    int filled = gba_div(hp * w, max_hp);
    if (filled > w) filled = w;
    if (filled < 0) filled = 0;

    int pct = gba_div(hp * 100, max_hp);
    u16 bar_color = (pct > 50) ? RGB(0,28,0) : (pct > 20) ? RGB(31,28,0) : RGB(31,0,0);

    gfx_fill_rect(x, y, w, h, COL_DGRAY);
    if (filled > 0) gfx_fill_rect(x, y, filled, h, bar_color);
    gfx_draw_rect(x-1, y-1, w+2, h+2, COL_LGRAY);
}

/* ── 2bpp sprite renderer ────────────────────────────────────────── */

/* Draw a 40×40 2bpp sprite centered at (cx,cy).
   val 0=skip  1→c1  2→c2  3→black */
static void gfx_draw_sprite_2bpp(int cx, int cy, const u8* spr, u16 c1, u16 c2) {
    int sx = cx - 20, sy = cy - 20;
    u8 i1 = pal_idx(c1), i2 = pal_idx(c2), i3 = 0; /* 0 = COL_BLACK */
    for (int row = 0; row < 40; row++) {
        for (int col = 0; col < 40; col++) {
            u8 byte  = spr[row * 10 + (col >> 2)];
            u8 shift = (u8)((3 - (col & 3)) << 1);
            u8 val   = (byte >> shift) & 3;
            if (!val) continue;
            u8 ci = (val == 1) ? i1 : (val == 2) ? i2 : i3;
            gfx_draw_pixel_idx(sx + col, sy + row, ci);
        }
    }
}

/* ── Named Pokemon sprite renderers ─────────────────────────────── */

static void draw_bulbasaur(int cx, int cy, int r, int back) {
    (void)r;
    gfx_draw_sprite_2bpp(cx, cy, spr_table[0][back ? 1 : 0],
                          RGB(10,22,14),   /* light green body */
                          RGB( 2,12, 4));  /* dark green bulb  */
}

static void draw_charmander(int cx, int cy, int r, int back) {
    (void)r;
    gfx_draw_sprite_2bpp(cx, cy, spr_table[1][back ? 1 : 0],
                          RGB(31,14, 4),   /* orange body */
                          RGB(31,26,18));  /* cream belly */
}

static void draw_squirtle(int cx, int cy, int r, int back) {
    (void)r;
    gfx_draw_sprite_2bpp(cx, cy, spr_table[2][back ? 1 : 0],
                          RGB( 8,18,28),   /* blue body  */
                          RGB(18,14, 4));  /* brown shell */
}

static void draw_pikachu(int cx, int cy, int r, int back) {
    (void)r;
    gfx_draw_sprite_2bpp(cx, cy, spr_table[3][back ? 1 : 0],
                          RGB(31,28, 4),   /* yellow body */
                          RGB(31, 4, 4));  /* red cheeks  */
}

static void draw_gengar(int cx, int cy, int r, int back) {
    (void)r;
    gfx_draw_sprite_2bpp(cx, cy, spr_table[4][back ? 1 : 0],
                          RGB(14, 6,18),   /* dark purple body */
                          RGB(28, 4, 4));  /* red eyes/tongue  */
}

static void draw_mewtwo(int cx, int cy, int r, int back) {
    (void)r;
    gfx_draw_sprite_2bpp(cx, cy, spr_table[5][back ? 1 : 0],
                          RGB(22,16,24),   /* light gray-purple */
                          RGB(14, 6,18));  /* dark purple tube  */
}

static void draw_pokemon_generic(int cx, int cy, int radius, u16 species_id, int back) {
    const SpeciesData* sp = &species_data[species_id];
    u16 fill   = TYPE_COLORS[sp->type1];
    u16 border = COL_BLACK;
    u8  variant = (u8)(species_id & 0xFF) ^ (u8)(species_id >> 8);
    int rx = radius, ry = radius;
    u8  shape = variant & 3;
    if      (shape == 0) { ry = (radius*3)/4; }
    else if (shape == 1) { rx = (radius*3)/4; }
    else if (shape == 2) { rx = ry = (radius*5)/6; }
    if (back) { rx = (rx*4)/5; ry = (ry*4)/5; cy += radius/5; }
    gfx_draw_ellipse(cx, cy, rx, ry, fill, border);
    if (radius >= 18) {
        int hr = (radius*2)/5;
        int hx = cx + (back ? 0 : (((variant>>2)&1) ? -rx/4 : rx/4));
        int hy = cy - ry - hr + 3;
        u16 hfill = TYPE_COLORS[(sp->type2 != TYPE_NONE) ? sp->type2 : sp->type1];
        gfx_draw_ellipse(hx, hy, hr, hr, hfill, border);
        if (!back) {
            gfx_draw_pixel(hx+2, hy-2, COL_WHITE);
            gfx_draw_pixel(hx-2, hy-2, COL_WHITE);
        }
    }
    if ((variant & 0x0C) == 0x04 && radius >= 16) {
        int tx = cx + rx;
        for (int i = 0; i < radius/3; i++) {
            gfx_draw_pixel(tx+i, cy - i/2,     fill);
            gfx_draw_pixel(tx+i, cy - i/2 + 1, border);
        }
    } else if ((variant & 0x0C) == 0x08 && radius >= 16) {
        for (int i = 0; i < radius/3; i++)
            gfx_draw_pixel(cx, cy - ry - i, fill);
    }
}

void gfx_draw_pokemon(int cx, int cy, int radius, u16 species_id, int back) {
    switch (species_id) {
    case   1: draw_bulbasaur(cx, cy, radius, back);  return;
    case   4: draw_charmander(cx, cy, radius, back); return;
    case   7: draw_squirtle(cx, cy, radius, back);   return;
    case  25: draw_pikachu(cx, cy, radius, back);    return;
    case  94: draw_gengar(cx, cy, radius, back);     return;
    case 150: draw_mewtwo(cx, cy, radius, back);     return;
    default:  draw_pokemon_generic(cx, cy, radius, species_id, back); return;
    }
}

