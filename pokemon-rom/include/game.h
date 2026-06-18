#pragma once
#include "pokemon.h"

typedef enum {
    STATE_TITLE = 0,
    STATE_INTRO,
    STATE_STARTER_SELECT,
    STATE_OVERWORLD,
    STATE_BATTLE,
    STATE_GAME_OVER
} GameState;

extern GameState game_state;
extern u32 rng_state;

/* battle interface */
void battle_start(u16 enemy_species_id, u8 enemy_level, int is_trainer);
void battle_update(void);

/* overworld interface */
void overworld_init(void);
void overworld_update(void);

/* graphics init (call once at startup after setting MODE4_ENABLE) */
void gfx_init(void);

/* graphics primitives */
void gfx_fill(u16 color);
void gfx_fill_rect(int x, int y, int w, int h, u16 color);
void gfx_draw_pixel(int x, int y, u16 color);
u8   gfx_color_idx(u16 color);
void gfx_draw_pixel_idx(int x, int y, u8 idx);
void gfx_draw_hline(int x, int y, int w, u16 color);
void gfx_draw_vline(int x, int y, int h, u16 color);
void gfx_draw_rect(int x, int y, int w, int h, u16 color);
void gfx_draw_circle(int cx, int cy, int r, u16 fill, u16 border);
void gfx_draw_ellipse(int cx, int cy, int rx, int ry, u16 fill, u16 border);
void gfx_draw_hp_bar(int x, int y, int w, int h, int hp, int max_hp);

/* text rendering */
void txt_draw_char(int x, int y, char c, u16 fg, u16 bg);
void txt_draw_str(int x, int y, const char* s, u16 fg, u16 bg);
void txt_draw_int(int x, int y, int n, u16 fg, u16 bg);
void txt_draw_str_centered(int y, const char* s, u16 fg, u16 bg);

/* Pokemon sprite (type-colored silhouette) */
void gfx_draw_pokemon(int cx, int cy, int radius, u16 species_id, int back);

/* Sprite bitmap table [6 pokemon][front=0/back=1] — sprite_data.c */
extern const u8* const spr_table[6][2];

/* Save/load */
void save_game(void);
int  load_game(void);   /* returns 1 if loaded successfully */
extern int player_pokeballs;
extern int player_x_save;
extern int player_y_save;
