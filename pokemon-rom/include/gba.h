#pragma once
#include <stdint.h>

typedef uint8_t  u8;
typedef uint16_t u16;
typedef uint32_t u32;
typedef int8_t   s8;
typedef int16_t  s16;
typedef int32_t  s32;

/* ── Memory map ─────────────────────────────────────────────────── */
#define EWRAM_BASE  0x02000000
#define IWRAM_BASE  0x03000000
#define IO_BASE     0x04000000
#define PAL_BASE    0x05000000
#define VRAM_BASE   0x06000000
#define OAM_BASE    0x07000000
#define ROM_BASE    0x08000000

/* ── Display registers ───────────────────────────────────────────── */
#define REG_DISPCNT   (*(volatile u32*)(IO_BASE + 0x000))
#define REG_DISPSTAT  (*(volatile u16*)(IO_BASE + 0x004))
#define REG_VCOUNT    (*(volatile u16*)(IO_BASE + 0x006))

#define DCNT_MODE3    0x0003
#define DCNT_BG2      0x0400
#define MODE3_ENABLE  (DCNT_MODE3 | DCNT_BG2)

/* ── Key input ───────────────────────────────────────────────────── */
#define REG_KEYINPUT  (*(volatile u16*)(IO_BASE + 0x130))

#define KEY_A       0x0001
#define KEY_B       0x0002
#define KEY_SELECT  0x0004
#define KEY_START   0x0008
#define KEY_RIGHT   0x0010
#define KEY_LEFT    0x0020
#define KEY_UP      0x0040
#define KEY_DOWN    0x0080
#define KEY_R       0x0100
#define KEY_L       0x0200

/* ── VRAM ────────────────────────────────────────────────────────── */
#define VRAM ((volatile u16*)(VRAM_BASE))
#define SCREEN_W 240
#define SCREEN_H 160

/* ── RGB color helpers (RGB15 format) ────────────────────────────── */
#define RGB(r,g,b) ((u16)((r) | ((g)<<5) | ((b)<<10)))

#define COL_BLACK     RGB( 0, 0, 0)
#define COL_WHITE     RGB(31,31,31)
#define COL_RED       RGB(31, 0, 0)
#define COL_GREEN     RGB( 0,24, 0)
#define COL_BLUE      RGB( 0, 0,31)
#define COL_YELLOW    RGB(31,31, 0)
#define COL_ORANGE    RGB(31,16, 0)
#define COL_PURPLE    RGB(20, 0,20)
#define COL_CYAN      RGB( 0,28,28)
#define COL_PINK      RGB(31,16,20)
#define COL_GRAY      RGB(14,14,14)
#define COL_DGRAY     RGB( 7, 7, 7)
#define COL_LGRAY     RGB(24,24,24)
#define COL_BROWN     RGB(18,12, 4)
#define COL_DARKBLUE  RGB( 0, 0,16)
#define COL_DARKGREEN RGB( 0,14, 0)
#define COL_DKRED     RGB(16, 0, 0)
#define COL_GOLD      RGB(31,27, 5)
#define COL_SILVER    RGB(22,22,24)
#define COL_TAN       RGB(28,22,14)
#define COL_SKYBLUE   RGB(12,22,31)
#define COL_GRASS     RGB( 6,20, 4)
#define COL_WATER     RGB( 0,16,28)
#define COL_SAND      RGB(28,26,16)
#define COL_BARK      RGB(14, 9, 3)

/* ── vsync / input ───────────────────────────────────────────────── */
static inline void vsync(void) {
    while (REG_VCOUNT >= 160);
    while (REG_VCOUNT < 160);
}

/* keys_held: currently pressed keys (active HIGH) */
static inline u16 keys_held(void) {
    return (~REG_KEYINPUT) & 0x03FF;
}

/* ── Integer math helpers ────────────────────────────────────────── */
/* ARM7TDMI has no hardware divide; arm-none-eabi-gcc + -lgcc
   compiles / and % to __aeabi_idiv/__aeabi_idivmod automatically. */
static inline s32 gba_div(s32 a, s32 b) { if (!b) return 0; return a / b; }
static inline s32 gba_mod(s32 a, s32 b) { if (!b) return 0; return a % b; }

/* LCG pseudo-random */
extern u32 rng_state;
static inline u32 rand_next(void) {
    rng_state = rng_state * 1664525u + 1013904223u;
    return rng_state;
}
static inline u32 rand_range(u32 lo, u32 hi) {
    return lo + gba_mod((s32)rand_next(), (s32)(hi - lo + 1));
}
