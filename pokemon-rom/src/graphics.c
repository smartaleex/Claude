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

/* ── Named Pokemon sprite renderers ─────────────────────────────── */

static void draw_bulbasaur(int cx, int cy, int r, int back) {
    u16 gbody = RGB( 8,22,14);
    u16 gbel  = RGB(14,28,20);
    u16 gbulb = RGB( 2,12, 4);
    u16 gseed = RGB(20,24, 0);
    u16 geye  = RGB(28,22, 0);
    u16 blk   = COL_BLACK;
    if (back) { cy += r/8; }
    /* Bulb (upper-right for front, upper-left for back) */
    int bx = cx + (back ? -r/3 : r/3);
    gfx_draw_ellipse(bx, cy - r/4, r*3/8, r*9/16, gbulb, blk);
    gfx_draw_hline(bx - r/4, cy - r/4,      r/2,   gseed);
    gfx_draw_hline(bx - r/5, cy - r/4 + r/7, r*2/5, gseed);
    gfx_draw_vline(bx, cy - r*9/16 + r/10,   r*7/8, gseed);
    /* Main body */
    gfx_draw_ellipse(cx, cy + r/10, r*5/7, r*4/9, gbody, blk);
    gfx_draw_ellipse(cx + (back ? r/5 : -r/5), cy + r/10, r/3, r/3, gbel, blk);
    /* Head (front-left for front, front-right for back) */
    int hx = cx + (back ? r*3/8 : -r*3/8);
    gfx_draw_ellipse(hx, cy - r/8, r*3/8, r/3, gbody, blk);
    if (!back) {
        gfx_draw_circle(hx - r/8, cy - r/5, r/9, geye, blk);
        gfx_draw_circle(hx + r/9, cy - r/5, r/9, geye, blk);
        gfx_draw_pixel(hx - r/8, cy - r/5, blk);
        gfx_draw_pixel(hx + r/9, cy - r/5, blk);
    }
    /* Four stubby legs */
    int ly = cy + r*4/9, lw = r/6, lh = r*3/11;
    gfx_fill_rect(cx-r*3/5, ly, lw, lh, gbody); gfx_draw_rect(cx-r*3/5, ly, lw, lh, blk);
    gfx_fill_rect(cx-r/4,   ly, lw, lh, gbody); gfx_draw_rect(cx-r/4,   ly, lw, lh, blk);
    gfx_fill_rect(cx+r/8,   ly, lw, lh, gbody); gfx_draw_rect(cx+r/8,   ly, lw, lh, blk);
    gfx_fill_rect(cx+r*2/5, ly, lw, lh, gbody); gfx_draw_rect(cx+r*2/5, ly, lw, lh, blk);
}

static void draw_charmander(int cx, int cy, int r, int back) {
    u16 corg  = RGB(31,14, 4);
    u16 cbel  = RGB(31,26,18);
    u16 cflm1 = RGB(31,28, 2);
    u16 cflm2 = RGB(31,14, 2);
    u16 blk   = COL_BLACK;
    if (back) { cx += 0; cy += r/6; r = r*4/5; }
    /* Body (upright oval) */
    gfx_draw_ellipse(cx, cy + r/8, r*3/8, r*5/9, corg, blk);
    /* Cream belly */
    gfx_draw_ellipse(cx - r/8, cy + r/8, r*2/7, r*2/5, cbel, blk);
    /* Head */
    gfx_draw_ellipse(cx, cy - r*3/8, r*3/8, r*3/8, corg, blk);
    if (!back) {
        /* Eye with white highlight */
        gfx_draw_circle(cx - r/5, cy - r/2, r/8, blk, blk);
        gfx_draw_pixel(cx - r/5 + 1, cy - r/2 - 1, COL_WHITE);
        /* Nostril */
        gfx_draw_pixel(cx - r/3, cy - r*5/14, blk);
    }
    /* Arms */
    gfx_draw_ellipse(cx - r/2, cy,        r/6, r/4, corg, blk);
    gfx_draw_ellipse(cx + r/2, cy - r/10, r/6, r/4, corg, blk);
    /* Legs */
    int ly = cy + r*5/9;
    gfx_fill_rect(cx-r/3,  ly, r/4, r/3, corg); gfx_draw_rect(cx-r/3,  ly, r/4, r/3, blk);
    gfx_fill_rect(cx+r/12, ly, r/4, r/3, corg); gfx_draw_rect(cx+r/12, ly, r/4, r/3, blk);
    /* Tail: stub right then down */
    int tx = cx + r*3/8, ty = cy + r/5;
    gfx_draw_vline(tx,       ty, r/4, corg);
    gfx_draw_hline(tx,       ty + r/4 - 1, r/5, corg);
    gfx_draw_vline(tx + r/5, ty + r/4, r/5, corg);
    /* Flame (two overlapping ellipses: orange base, yellow core) */
    gfx_draw_ellipse(tx + r/5, ty + r*7/12, r/5, r/4, cflm2, blk);
    gfx_draw_ellipse(tx + r/5, ty + r*5/12, r/7, r/5, cflm1, blk);
    gfx_draw_pixel(tx + r/5 - r/8, ty + r*3/10, cflm1);
    gfx_draw_pixel(tx + r/5 + r/8, ty + r*3/10, cflm1);
}

static void draw_squirtle(int cx, int cy, int r, int back) {
    u16 sblue = RGB( 8,18,28);
    u16 slblu = RGB(20,24,28);
    u16 shbrn = RGB(18,14, 4);
    u16 shgrn = RGB( 8,18, 4);
    u16 blk   = COL_BLACK;
    if (back) { cy += r/6; r = r*4/5; }
    /* Shell (oval behind, slightly offset right for front view) */
    int sx = back ? cx : cx + r/8;
    gfx_draw_ellipse(sx, cy + r/8, r*3/5, r/2, shbrn, blk);
    /* Shell cross/hex line pattern */
    gfx_draw_hline(sx - r*2/5, cy + r/8,       r*4/5, shgrn);
    gfx_draw_hline(sx - r/3,   cy + r*3/8,      r*2/3, shgrn);
    gfx_draw_vline(sx,         cy - r*3/8,       r*3/4, shgrn);
    /* Body/belly oval in front */
    gfx_draw_ellipse(cx - (back ? 0 : r/5), cy + r/8, r*2/5, r*4/9, slblu, blk);
    /* Head */
    gfx_draw_ellipse(cx, cy - r*3/8, r*3/8, r*3/8, sblue, blk);
    if (!back) {
        gfx_draw_circle(cx - r/5, cy - r/2, r/9, blk, blk);
        gfx_draw_circle(cx + r/5, cy - r/2, r/9, blk, blk);
        gfx_draw_pixel(cx - r/5 + 1, cy - r/2 - 1, COL_WHITE);
        gfx_draw_pixel(cx + r/5 + 1, cy - r/2 - 1, COL_WHITE);
    }
    /* Arms */
    gfx_draw_ellipse(cx - r/2, cy,        r/5, r/3, sblue, blk);
    gfx_draw_ellipse(cx + r/2, cy - r/8,  r/5, r/3, sblue, blk);
    /* Legs */
    int ly = cy + r*4/9;
    gfx_fill_rect(cx-r*3/8, ly, r/4, r/3, sblue); gfx_draw_rect(cx-r*3/8, ly, r/4, r/3, blk);
    gfx_fill_rect(cx+r/8,   ly, r/4, r/3, sblue); gfx_draw_rect(cx+r/8,   ly, r/4, r/3, blk);
    /* Curly tail (two overlapping circles) */
    gfx_draw_circle(cx + r*3/4, cy + r/4, r/5, sblue, blk);
    gfx_draw_circle(cx + r*5/6, cy + r*3/8, r/7, sblue, blk);
}

static void draw_pikachu(int cx, int cy, int r, int back) {
    u16 pyel = RGB(31,28, 4);
    u16 pbrn = RGB(20,12, 2);
    u16 pred = RGB(31, 4, 4);
    u16 blk  = COL_BLACK;
    if (back) { cy += r/6; r = r*4/5; }
    /* Ears (two tall narrow ovals with black tips) */
    for (int s = -1; s <= 1; s += 2) {
        int ex = cx + s * r*3/8;
        gfx_draw_ellipse(ex, cy - r*3/4, r/9, r*3/8, pyel, blk);
        gfx_fill_rect(ex - r/10, cy - r*3/4 - r*3/8 + r/10, r/5, r/5, blk);
    }
    /* Head (wide oval) */
    gfx_draw_ellipse(cx, cy - r/5, r/2, r*2/5, pyel, blk);
    if (!back) {
        /* Eyes with white glints */
        gfx_draw_circle(cx - r/4, cy - r*3/10, r/10, blk, blk);
        gfx_draw_circle(cx + r/4, cy - r*3/10, r/10, blk, blk);
        gfx_draw_pixel(cx - r/4 + 1, cy - r*3/10 - 1, COL_WHITE);
        gfx_draw_pixel(cx + r/4 + 1, cy - r*3/10 - 1, COL_WHITE);
        /* Red cheeks */
        gfx_draw_circle(cx - r*2/5, cy - r/8, r/7, pred, blk);
        gfx_draw_circle(cx + r*2/5, cy - r/8, r/7, pred, blk);
        /* Nose + mouth */
        gfx_draw_pixel(cx, cy - r/6, blk);
        gfx_draw_hline(cx - r/8, cy - r/9, r/4 + 1, blk);
    }
    /* Body */
    gfx_draw_ellipse(cx, cy + r/5, r*2/5, r*3/8, pyel, blk);
    /* Brown back stripes */
    gfx_draw_hline(cx - r/4, cy + r/10,      r/2, pbrn);
    gfx_draw_hline(cx - r/4, cy + r*3/8 - r/10, r/2, pbrn);
    /* Arms */
    gfx_draw_ellipse(cx - r/2, cy + r/10, r/7, r/4, pyel, blk);
    gfx_draw_ellipse(cx + r/2, cy + r/10, r/7, r/4, pyel, blk);
    /* Legs */
    int ly = cy + r/2;
    gfx_fill_rect(cx - r/3,  ly, r/4, r/3, pyel); gfx_draw_rect(cx - r/3,  ly, r/4, r/3, blk);
    gfx_fill_rect(cx + r/12, ly, r/4, r/3, pyel); gfx_draw_rect(cx + r/12, ly, r/4, r/3, blk);
    /* Lightning bolt tail (zigzag to the right, 4 segments) */
    int tx = cx + r*2/5, ty = cy + r/5;
    gfx_fill_rect(tx,         ty - r/6,   r/5, r/3, pyel); gfx_draw_rect(tx,         ty - r/6,   r/5, r/3, blk);
    gfx_fill_rect(tx + r/5,   ty - r*3/8, r/5, r/3, pyel); gfx_draw_rect(tx + r/5,   ty - r*3/8, r/5, r/3, blk);
    gfx_fill_rect(tx + r*2/5, ty - r/6,   r/5, r/3, pyel); gfx_draw_rect(tx + r*2/5, ty - r/6,   r/5, r/3, blk);
    gfx_fill_rect(tx + r*3/5, ty - r*3/8, r/6, r/4, pyel); gfx_draw_rect(tx + r*3/5, ty - r*3/8, r/6, r/4, blk);
}

static void draw_gengar(int cx, int cy, int r, int back) {
    u16 gpur  = RGB(14, 6,18);
    u16 gpur2 = RGB(20,10,24);
    u16 gred  = RGB(28, 4, 4);
    u16 blk   = COL_BLACK;
    if (back) { cy += r/6; r = r*4/5; }
    /* Main round body */
    gfx_draw_ellipse(cx, cy, r*4/5, r*3/4, gpur, blk);
    /* Lighter belly */
    gfx_draw_ellipse(cx, cy + r/5, r*3/5, r*2/5, gpur2, blk);
    /* Top spikes (3 bumps) */
    gfx_fill_rect(cx - r/2 - r/10, cy - r*3/4 - r/5, r/5, r/4, gpur); gfx_draw_rect(cx-r/2-r/10, cy-r*3/4-r/5, r/5, r/4, blk);
    gfx_fill_rect(cx - r/10,        cy - r*3/4 - r/5, r/5, r/4, gpur); gfx_draw_rect(cx-r/10,     cy-r*3/4-r/5, r/5, r/4, blk);
    gfx_fill_rect(cx + r/3,         cy - r*3/4 - r/5, r/5, r/4, gpur); gfx_draw_rect(cx+r/3,      cy-r*3/4-r/5, r/5, r/4, blk);
    /* Side spikes */
    gfx_fill_rect(cx - r*4/5 - r/5, cy - r/8, r/4, r/5, gpur); gfx_draw_rect(cx-r*4/5-r/5, cy-r/8, r/4, r/5, blk);
    gfx_fill_rect(cx + r*4/5,        cy - r/8, r/4, r/5, gpur); gfx_draw_rect(cx+r*4/5,     cy-r/8, r/4, r/5, blk);
    /* Ear bumps */
    gfx_draw_ellipse(cx - r*2/5, cy - r*3/4, r/6, r/4, gpur, blk);
    gfx_draw_ellipse(cx + r*2/5, cy - r*3/4, r/6, r/4, gpur, blk);
    /* Red eyes */
    gfx_draw_circle(cx - r/3, cy - r/5, r/8, gred, blk);
    gfx_draw_circle(cx + r/3, cy - r/5, r/8, gred, blk);
    gfx_draw_pixel(cx - r/3, cy - r/5, blk);
    gfx_draw_pixel(cx + r/3, cy - r/5, blk);
    /* Wide grin */
    gfx_draw_hline(cx - r*2/5, cy + r/8, r*4/5, blk);
    /* Teeth (white pixel pairs under grin) */
    for (int t = -2; t <= 2; t++)
        gfx_fill_rect(cx + t*(r/5) - 1, cy + r/8 + 1, 2, r/8, COL_WHITE);
    /* Tongue */
    gfx_draw_ellipse(cx, cy + r/4, r/5, r/8, COL_RED, blk);
    /* Side hands */
    gfx_draw_circle(cx - r*4/5, cy + r/4, r/7, gpur, blk);
    gfx_draw_circle(cx + r*4/5, cy + r/4, r/7, gpur, blk);
    gfx_draw_circle(cx,          cy + r*3/4, r/7, gpur, blk);
}

static void draw_mewtwo(int cx, int cy, int r, int back) {
    u16 mbody = RGB(22,16,24);
    u16 minn  = RGB(28,20,28);
    u16 mpur  = RGB(14, 6,18);
    u16 blk   = COL_BLACK;
    if (back) { cy += r/6; r = r*4/5; }
    /* Psychic tube at back of skull */
    gfx_fill_rect(cx - r*3/5, cy - r*3/4, r/8, r/2, mpur);
    gfx_draw_rect(cx - r*3/5, cy - r*3/4, r/8, r/2, blk);
    /* Large round head (Mewtwo's most iconic feature) */
    gfx_draw_ellipse(cx, cy - r*3/8, r/2, r*2/5, mbody, blk);
    /* Lighter inner head area */
    gfx_draw_ellipse(cx + r/8, cy - r*3/8, r/4, r/5, minn, blk);
    /* Narrow menacing eyes */
    gfx_draw_hline(cx - r/3,  cy - r*3/8, r/5, blk);
    gfx_draw_hline(cx + r/10, cy - r*3/8, r/5, blk);
    /* Thin neck */
    gfx_fill_rect(cx - r/8, cy, r/4, r/5, mbody);
    /* Body (smaller oval below neck) */
    gfx_draw_ellipse(cx, cy + r/3, r/3, r/3, mbody, blk);
    gfx_draw_ellipse(cx, cy + r/3, r/5, r/4, minn, blk);
    /* Arms */
    gfx_draw_ellipse(cx - r*2/3, cy + r/5, r/6, r/3, mbody, blk);
    gfx_draw_ellipse(cx + r*2/3, cy + r/5, r/6, r/3, mbody, blk);
    /* Legs */
    int ly = cy + r*2/3;
    gfx_fill_rect(cx - r/3,  ly, r/4, r/3, mbody); gfx_draw_rect(cx - r/3,  ly, r/4, r/3, blk);
    gfx_fill_rect(cx + r/12, ly, r/4, r/3, mbody); gfx_draw_rect(cx + r/12, ly, r/4, r/3, blk);
    /* Thick tail (2 pixels wide, curves right) */
    int tx = cx + r/2, ty = cy + r/3;
    gfx_draw_vline(tx,     ty, r/2, mpur);
    gfx_draw_vline(tx + 1, ty, r/2, mpur);
    gfx_draw_circle(tx, ty + r*3/5, r/6, mpur, blk);
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

