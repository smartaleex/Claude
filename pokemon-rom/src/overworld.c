#include "game.h"

/* ── Tile types ──────────────────────────────────────────────────── */
#define T_GRASS  0
#define T_TGRASS 1   /* tall grass */
#define T_PATH   2
#define T_WATER  3
#define T_TREE   4
#define T_WALL   5
#define T_SAND   6
#define T_SIGN   7
#define T_FLOWER 8
#define T_CAVE   9

static const u16 TILE_COLORS[] = {
    RGB( 8,20, 6),   /* T_GRASS  */
    RGB( 4,16, 2),   /* T_TGRASS */
    RGB(22,18,12),   /* T_PATH   */
    RGB( 4,16,26),   /* T_WATER  */
    RGB( 4,12, 2),   /* T_TREE   */
    RGB(10,10,10),   /* T_WALL   */
    RGB(26,24,14),   /* T_SAND   */
    RGB(20,16, 6),   /* T_SIGN   */
    RGB( 8,22, 6),   /* T_FLOWER */
    RGB( 8, 8, 8),   /* T_CAVE   */
};

/* ── Map definition 20×15 tiles (each tile 16×16 px, fills 320×240 but
   we only show 15×10 tiles = 240×160) ──────────────────────────── */
#define MAP_W  40
#define MAP_H  40
#define TILE_SZ 16

static const u8 game_map[MAP_H][MAP_W] = {
  {4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4},
  {4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4},
  {4,4,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,4,4},
  {4,4,0,2,2,0,1,1,1,1,0,0,1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,0,8,0,8,0,8,0,0,4,4},
  {4,4,0,2,2,0,1,1,1,1,0,0,1,1,1,1,1,1,1,0,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4},
  {4,4,0,2,2,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,3,3,3,0,0,0,5,5,5,5,5,0,0,0,0,0,0,0,4,4},
  {4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,0,3,3,3,0,0,0,5,7,7,7,5,0,0,0,0,0,0,0,4,4},
  {4,4,0,0,1,1,1,1,1,1,1,1,0,0,0,2,2,0,0,0,3,3,3,0,0,0,5,7,9,7,5,0,0,0,0,0,0,0,4,4},
  {4,4,0,0,1,1,1,1,1,1,1,1,0,0,0,2,2,0,0,0,3,3,3,0,0,0,5,5,2,5,5,0,0,0,0,0,0,0,4,4},
  {4,4,0,0,1,1,1,1,1,1,1,1,0,0,0,2,2,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,4,4},
  {4,4,0,0,0,0,0,2,2,2,2,0,0,0,0,2,2,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,4,4},
  {4,4,0,0,0,0,0,2,2,2,2,0,0,0,0,2,2,0,0,0,1,1,1,1,1,1,0,0,2,0,0,0,1,1,1,1,1,0,4,4},
  {4,4,6,6,6,6,6,2,2,2,2,6,6,6,6,2,2,6,6,6,1,1,1,1,1,1,6,6,2,6,6,6,1,1,1,1,1,0,4,4},
  {4,4,6,6,6,6,6,2,2,2,2,6,6,6,6,2,2,6,6,6,1,1,1,1,1,1,6,6,2,6,6,6,1,1,1,1,1,0,4,4},
  {4,4,6,6,6,6,0,0,0,0,0,0,6,6,6,2,2,6,6,0,0,0,0,0,0,0,6,6,2,6,6,0,0,0,0,0,0,0,4,4},
  {4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,4,4},
  {4,4,0,0,1,1,1,0,0,0,0,0,0,0,0,2,2,0,0,1,1,1,1,1,1,1,1,0,2,0,1,1,1,1,0,0,0,0,4,4},
  {4,4,0,0,1,1,1,0,0,8,0,8,0,8,0,2,2,0,0,1,1,1,1,1,1,1,1,0,2,0,1,1,1,1,0,0,0,0,4,4},
  {4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,1,1,1,1,1,1,1,1,0,0,0,1,1,1,1,0,0,0,0,4,4},
  {4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4},
  {4,4,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4},
  {4,4,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,4,4},
  {4,4,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,4,4},
  {4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,4,4},
  {4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4},
  {4,4,0,0,0,0,1,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,4,4},
  {4,4,0,0,0,0,1,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,4,4},
  {4,4,0,0,0,0,0,0,0,2,2,2,2,0,0,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4},
  {4,4,0,0,0,0,0,0,0,2,2,2,2,0,0,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4},
  {4,4,0,0,0,0,0,0,0,2,2,2,2,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,4,4},
  {4,4,0,8,0,8,0,8,0,2,2,2,2,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,4,4},
  {4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4},
  {4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4},
  {4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4},
  {4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4},
  {4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4},
  {4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4},
  {4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4},
  {4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4},
  {4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4},
};

/* Encounter tables for tall grass (type biased by region position) */
/* Each entry: species_id, min_level, max_level, weight */
typedef struct { u16 species; u8 min_lv; u8 max_lv; u8 weight; } EncounterEntry;

/* Region encounter groups */
static const EncounterEntry enc_kanto[] = {
    {16,3,6,20},{19,2,5,18},{21,3,6,15},{10,2,4,12},{13,2,4,10},
    {41,4,6,8},{92,4,7,6},{25,4,8,5},{43,4,7,5},{54,5,8,3},
    {1,5,5,2},{4,5,5,2},{7,5,5,2},{52,4,7,4},{60,4,7,4}
};
#define ENC_KANTO_COUNT 15

static const EncounterEntry enc_johto[] = {
    {152,5,8,15},{155,5,8,15},{158,5,8,15},{163,3,6,15},{161,2,5,15},
    {165,3,6,10},{167,3,6,10},{183,4,7,8},{177,5,8,6},{191,3,6,5},
    {172,4,7,4},{173,3,5,3},{175,4,7,4},{198,6,9,4},{193,5,8,3}
};
#define ENC_JOHTO_COUNT 15

static const EncounterEntry enc_hoenn[] = {
    {252,5,8,15},{255,5,8,15},{258,5,8,15},{261,3,6,15},{263,3,6,15},
    {265,4,7,12},{273,4,7,10},{278,5,8,8},{283,4,6,7},{285,4,6,6},
    {287,5,8,5},{293,4,7,5},{300,3,6,4},{303,5,8,3},{315,5,8,3}
};
#define ENC_HOENN_COUNT 15

static const EncounterEntry enc_sinnoh[] = {
    {387,5,8,15},{390,5,8,15},{393,5,8,15},{396,3,6,15},{399,3,6,15},
    {401,4,7,12},{406,4,7,10},{412,4,6,8},{415,4,7,7},{418,5,8,6},
    {420,4,7,5},{422,4,6,4},{427,5,8,5},{431,5,8,3},{441,5,8,3}
};
#define ENC_SINNOH_COUNT 15

static const EncounterEntry enc_unova[] = {
    {495,5,8,15},{498,5,8,15},{501,5,8,15},{504,3,6,15},{506,3,6,15},
    {519,4,7,12},{522,4,7,10},{527,4,7,8},{529,4,6,7},{532,5,8,6},
    {535,4,7,5},{540,4,7,5},{543,4,7,4},{546,3,6,4},{551,5,8,3}
};
#define ENC_UNOVA_COUNT 15

/* Mixed table (all regions) for large tall-grass patches */
static const EncounterEntry enc_all[] = {
    {1,5,12,5},{4,5,12,5},{7,5,12,5},{152,5,12,4},{155,5,12,4},
    {158,5,12,4},{252,5,12,4},{255,5,12,4},{258,5,12,4},{387,5,12,3},
    {390,5,12,3},{393,5,12,3},{495,5,12,3},{498,5,12,3},{501,5,12,3},
    {650,8,15,3},{653,8,15,3},{656,8,15,3},{722,8,15,2},{725,8,15,2},
    {728,8,15,2},{810,8,15,2},{813,8,15,2},{816,8,15,2},{906,8,15,2},
    {909,8,15,2},{912,8,15,2},{25,5,15,3},{133,6,12,2},{116,5,10,2},
    {147,8,14,1},{246,10,15,1},{374,10,15,1},{443,10,15,1},{610,10,15,1}
};
#define ENC_ALL_COUNT 35

/* ── Player state ────────────────────────────────────────────────── */
static int player_x, player_y;  /* tile coordinates */
static int cam_x, cam_y;        /* camera in pixels */
static int move_anim;           /* walk animation frame */
static int step_counter;        /* steps taken */

/* Expose position to save system */
extern int player_x_save, player_y_save;

static int tiles_x(void) { return SCREEN_W / TILE_SZ; }
static int tiles_y(void) { return SCREEN_H / TILE_SZ; }

static int is_solid(int tx, int ty) {
    if ((unsigned)tx >= MAP_W || (unsigned)ty >= MAP_H) return 1;
    u8 t = game_map[ty][tx];
    return t == T_TREE || t == T_WALL || t == T_WATER;
}

static u16 pick_encounter(int tx, int ty) {
    /* pick encounter table based on x position for variety */
    const EncounterEntry* tbl;
    int cnt;
    int region_x = gba_div(tx, 8);
    if (region_x == 0) { tbl = enc_kanto; cnt = ENC_KANTO_COUNT; }
    else if (region_x == 1) { tbl = enc_johto; cnt = ENC_JOHTO_COUNT; }
    else if (region_x == 2) { tbl = enc_hoenn; cnt = ENC_HOENN_COUNT; }
    else if (region_x == 3) { tbl = enc_sinnoh; cnt = ENC_SINNOH_COUNT; }
    else if (region_x == 4) { tbl = enc_unova; cnt = ENC_UNOVA_COUNT; }
    else { tbl = enc_all; cnt = ENC_ALL_COUNT; }

    /* weighted pick */
    int total = 0;
    for (int i = 0; i < cnt; i++) total += tbl[i].weight;
    int roll = (int)rand_range(0, total - 1);
    for (int i = 0; i < cnt; i++) {
        roll -= tbl[i].weight;
        if (roll < 0) {
            u8 lv = (u8)rand_range(tbl[i].min_lv, tbl[i].max_lv);
            /* scale to player level slightly */
            int pl_lv = party[0].level;
            if (pl_lv > tbl[i].max_lv + 5) lv = (u8)(pl_lv + (int)rand_range(0, 4) - 2);
            if (lv < 2) lv = 2;
            if (lv > 100) lv = 100;
            battle_start(tbl[i].species, lv, 0);
            return tbl[i].species;
        }
    }
    battle_start(enc_all[0].species, 5, 0);
    return enc_all[0].species;
}

void overworld_init(void) {
    /* Use saved position if valid */
    player_x = (player_x_save >= 2 && player_x_save < MAP_W-2) ? player_x_save : 8;
    player_y = (player_y_save >= 2 && player_y_save < MAP_H-2) ? player_y_save : 10;
    move_anim = 0;
    step_counter = 0;
}

static void draw_tile(int screen_x, int screen_y, u8 tile) {
    u16 base = TILE_COLORS[tile];
    gfx_fill_rect(screen_x, screen_y, TILE_SZ, TILE_SZ, base);

    /* add detail */
    if (tile == T_TREE) {
        gfx_fill_rect(screen_x+4, screen_y+2, 8, 10, RGB(4,18,2));
        gfx_fill_rect(screen_x+6, screen_y+10, 4, 6, RGB(14,9,3));
    } else if (tile == T_TGRASS) {
        for (int i = 0; i < 4; i++)
            gfx_draw_vline(screen_x + 2 + i*4, screen_y + 8, 7, RGB(2,22,0));
    } else if (tile == T_WATER) {
        gfx_draw_hline(screen_x+1, screen_y+4,  TILE_SZ-2, RGB(8,20,30));
        gfx_draw_hline(screen_x+2, screen_y+10, TILE_SZ-4, RGB(8,20,30));
    } else if (tile == T_FLOWER) {
        gfx_draw_pixel(screen_x+4, screen_y+5, COL_YELLOW);
        gfx_draw_pixel(screen_x+10,screen_y+9, COL_PINK);
        gfx_draw_pixel(screen_x+7, screen_y+3, COL_WHITE);
    } else if (tile == T_PATH) {
        /* pebbles */
        gfx_draw_pixel(screen_x+3, screen_y+5,  RGB(18,16,10));
        gfx_draw_pixel(screen_x+11,screen_y+11, RGB(18,16,10));
        gfx_draw_pixel(screen_x+7, screen_y+2,  RGB(18,16,10));
    } else if (tile == T_SIGN) {
        gfx_fill_rect(screen_x+5, screen_y+4, 6, 5, RGB(24,20,8));
        gfx_fill_rect(screen_x+7, screen_y+9, 2, 6, RGB(14,9,3));
    } else if (tile == T_CAVE) {
        gfx_fill_rect(screen_x+3, screen_y+4, 10, 8, COL_BLACK);
        gfx_draw_rect(screen_x+3, screen_y+4, 10, 8, COL_DGRAY);
    } else if (tile == T_WALL) {
        gfx_draw_hline(screen_x, screen_y+8, TILE_SZ, RGB(7,7,7));
        gfx_draw_vline(screen_x+8, screen_y, TILE_SZ, RGB(7,7,7));
    }
}

static void draw_player(int sx, int sy) {
    /* simple 8×14 player sprite */
    u16 hair = RGB(22,12,0), skin = RGB(30,22,16), shirt = RGB(2,10,28), pants = RGB(6,4,20);
    /* shadow */
    gfx_fill_rect(sx+1, sy+13, 8, 3, RGB(2,4,2));
    /* body */
    gfx_fill_rect(sx+2, sy+6, 6, 8, shirt);
    gfx_fill_rect(sx+2, sy+10, 6, 4, pants);
    /* head */
    gfx_fill_rect(sx+2, sy+1, 6, 6, skin);
    gfx_fill_rect(sx+1, sy, 8, 3, hair);
    /* eyes */
    gfx_draw_pixel(sx+3, sy+4, COL_BLACK);
    gfx_draw_pixel(sx+6, sy+4, COL_BLACK);
    /* walk animation: move legs alternately */
    int leg = (move_anim >> 2) & 1;
    if (leg) {
        gfx_fill_rect(sx+2, sy+11, 3, 3, COL_DGRAY);
    } else {
        gfx_fill_rect(sx+5, sy+11, 3, 3, COL_DGRAY);
    }
}

void overworld_update(void) {
    static u16 prev_keys = 0;
    u16 cur  = keys_held();
    u16 just = cur & ~prev_keys;
    prev_keys = cur;

    int nx = player_x, ny = player_y;
    int moved = 0;

    if (just & KEY_UP)    { ny--; moved = 1; }
    if (just & KEY_DOWN)  { ny++; moved = 1; }
    if (just & KEY_LEFT)  { nx--; moved = 1; }
    if (just & KEY_RIGHT) { nx++; moved = 1; }

    if (moved && !is_solid(nx, ny)) {
        player_x = nx;
        player_y = ny;
        player_x_save = nx;
        player_y_save = ny;
        step_counter++;
        move_anim++;

        /* Random encounter in tall grass every ~7 steps */
        if (game_map[player_y][player_x] == T_TGRASS) {
            if ((int)rand_range(1, 7) == 1) {
                pick_encounter(player_x, player_y);
                return;
            }
        }
    }

    /* Camera: center on player */
    int target_cx = player_x * TILE_SZ - SCREEN_W/2 + TILE_SZ/2;
    int target_cy = player_y * TILE_SZ - SCREEN_H/2 + TILE_SZ/2;
    /* clamp to map bounds */
    if (target_cx < 0) target_cx = 0;
    if (target_cy < 0) target_cy = 0;
    if (target_cx > MAP_W * TILE_SZ - SCREEN_W) target_cx = MAP_W * TILE_SZ - SCREEN_W;
    if (target_cy > MAP_H * TILE_SZ - SCREEN_H) target_cy = MAP_H * TILE_SZ - SCREEN_H;
    cam_x = target_cx;
    cam_y = target_cy;

    /* Draw */
    vsync();

    /* Draw visible tiles */
    int tile_start_x = gba_div(cam_x, TILE_SZ);
    int tile_start_y = gba_div(cam_y, TILE_SZ);
    int px_off_x = gba_mod(cam_x, TILE_SZ);
    int px_off_y = gba_mod(cam_y, TILE_SZ);

    for (int ty = 0; ty <= tiles_y(); ty++) {
        for (int tx = 0; tx <= tiles_x(); tx++) {
            int map_tx = tile_start_x + tx;
            int map_ty = tile_start_y + ty;
            int screen_x = tx * TILE_SZ - px_off_x;
            int screen_y = ty * TILE_SZ - px_off_y;
            u8 t;
            if ((unsigned)map_tx < MAP_W && (unsigned)map_ty < MAP_H)
                t = game_map[map_ty][map_tx];
            else
                t = T_TREE;
            draw_tile(screen_x, screen_y, t);
        }
    }

    /* Draw player at center of screen */
    int player_sx = player_x * TILE_SZ - cam_x + (TILE_SZ/2 - 5);
    int player_sy = player_y * TILE_SZ - cam_y + (TILE_SZ/2 - 7);
    draw_player(player_sx, player_sy);

    /* HUD top-left: active Pokemon */
    gfx_fill_rect(0, 0, 115, 16, RGB(2,4,6));
    gfx_draw_rect(0, 0, 115, 16, COL_LGRAY);
    if (party_count > 0) {
        txt_draw_str(2, 3, party[0].nickname, COL_WHITE, RGB(2,4,6));
        txt_draw_str(56, 3, "Lv", COL_LGRAY, RGB(2,4,6));
        txt_draw_int(68, 3, party[0].level, COL_LGRAY, RGB(2,4,6));
        gfx_draw_hp_bar(2, 12, 108, 3, party[0].hp, party[0].max_hp);
    }

    /* HUD top-right: pokeballs and party count */
    gfx_fill_rect(145, 0, 95, 16, RGB(2,4,6));
    gfx_draw_rect(145, 0, 95, 16, COL_LGRAY);
    /* Pokeball icon (red circle) */
    gfx_fill_rect(148, 3, 8, 8, COL_RED);
    gfx_fill_rect(148, 7, 8, 4, COL_WHITE);
    gfx_draw_rect(148, 3, 8, 8, COL_BLACK);
    gfx_draw_hline(148, 7, 8, COL_BLACK);
    txt_draw_str(158, 4, "x", COL_LGRAY, RGB(2,4,6));
    txt_draw_int(164, 4, player_pokeballs, COL_YELLOW, RGB(2,4,6));
    /* Party count */
    txt_draw_str(185, 4, "Party:", COL_LGRAY, RGB(2,4,6));
    txt_draw_int(221, 4, party_count, COL_WHITE, RGB(2,4,6));
    txt_draw_str(228, 4, "/6", COL_DGRAY, RGB(2,4,6));

    /* Controls hint */
    txt_draw_str(0, 152, "Move:DPad  Battle in tall grass!", COL_DGRAY, 0xFFFF);
}
