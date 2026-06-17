#include "game.h"

GameState game_state = STATE_TITLE;

static int title_blink = 0;
static int intro_timer = 0;
static int starter_cursor = 0;
static int starter_confirmed = 0;
static u16 prev_keys = 0;

/* starter IDs: Bulbasaur, Charmander, Squirtle */
static const u16 STARTERS[3] = {1, 4, 7};
static const char* STARTER_NAMES[3] = {"Bulbasaur", "Charmander", "Squirtle"};
static const char* STARTER_DESC[3]  = {
    "Grass/Poison  Balanced",
    "Fire          Fast attack",
    "Water         High defense"
};

static void draw_title(u16 just) {
    gfx_fill(COL_DARKBLUE);

    /* Starfield effect using pseudo-random dots */
    for (int i = 0; i < 80; i++) {
        int sx = gba_mod((int)(rng_state >> (i & 15)) * 17 + i * 31, 240);
        int sy = gba_mod((int)(rng_state >> (i & 7))  * 13 + i * 19, 120);
        gfx_draw_pixel(sx, sy, COL_LGRAY);
    }

    /* Title banner */
    gfx_fill_rect(10, 20, 220, 40, RGB(2,6,18));
    gfx_draw_rect(10, 20, 220, 40, COL_GOLD);
    gfx_draw_rect(11, 21, 218, 38, COL_YELLOW);

    txt_draw_str_centered(28, "POKEMON ALL STARS",  COL_GOLD, RGB(2,6,18));
    txt_draw_str_centered(40, "ALL 1025 POKEMON!",  COL_LGRAY, RGB(2,6,18));

    /* Decorative Pokemon dots */
    gfx_draw_circle(35, 100, 18, TYPE_COLORS[TYPE_GRASS],  COL_BLACK);
    gfx_draw_circle(120, 95, 22, TYPE_COLORS[TYPE_FIRE],   COL_BLACK);
    gfx_draw_circle(205, 100, 18, TYPE_COLORS[TYPE_WATER], COL_BLACK);
    txt_draw_str(28,  95, "1",  COL_WHITE, 0xFFFF);
    txt_draw_str(113, 90, "4",  COL_WHITE, 0xFFFF);
    txt_draw_str(198, 95, "7",  COL_WHITE, 0xFFFF);

    /* Blink */
    title_blink++;
    if (title_blink < 45)
        txt_draw_str_centered(135, "Press START to Begin", COL_WHITE, 0xFFFF);
    if (title_blink >= 90) title_blink = 0;

    txt_draw_str_centered(150, "Move with D-pad, A to confirm", COL_DGRAY, 0xFFFF);

    if (just & KEY_START) {
        game_state = STATE_INTRO;
        intro_timer = 180;
    }
}

static void draw_intro(u16 just) {
    gfx_fill(COL_BLACK);
    txt_draw_str_centered(30,  "Welcome to Pokemon All Stars!",    COL_WHITE, COL_BLACK);
    txt_draw_str_centered(50,  "All 1025 Pokemon live here.",      COL_LGRAY, COL_BLACK);
    txt_draw_str_centered(65,  "Explore the world, battle wild",   COL_LGRAY, COL_BLACK);
    txt_draw_str_centered(78,  "Pokemon, level up, and evolve!",   COL_LGRAY, COL_BLACK);
    txt_draw_str_centered(100, "Walk into tall dark grass to",     COL_GREEN, COL_BLACK);
    txt_draw_str_centered(113, "trigger encounters.",              COL_GREEN, COL_BLACK);
    txt_draw_str_centered(135, "Choose your first Pokemon:",       COL_YELLOW, COL_BLACK);

    intro_timer--;
    if (intro_timer <= 0 || (just & (KEY_A | KEY_START))) {
        game_state = STATE_STARTER_SELECT;
        starter_cursor = 0;
        starter_confirmed = 0;
    }
}

static void draw_starter_select(u16 just) {
    gfx_fill(RGB(4,8,16));

    txt_draw_str_centered(5, "CHOOSE YOUR STARTER!", COL_GOLD, 0xFFFF);

    /* Draw three Pokemon */
    const int cx[3] = {50, 120, 190};
    const int cy = 70;
    for (int i = 0; i < 3; i++) {
        u16 highlight = (i == starter_cursor) ? COL_YELLOW : COL_DGRAY;
        int box_y = 20;
        gfx_fill_rect(cx[i]-35, box_y, 70, 95, (i == starter_cursor) ? RGB(4,8,20) : RGB(2,4,10));
        gfx_draw_rect(cx[i]-35, box_y, 70, 95, highlight);

        /* Draw Pokemon sprite */
        gfx_draw_pokemon(cx[i], cy, 24, STARTERS[i], 0);

        /* Name */
        int name_len = 0;
        const char* nm = STARTER_NAMES[i];
        while(nm[name_len]) name_len++;
        int nx = cx[i] - (name_len * 7) / 2;
        txt_draw_str(nx, 100, STARTER_NAMES[i], highlight, 0xFFFF);

        /* Type label */
        const SpeciesData* sp = &species_data[STARTERS[i]];
        u16 tc = TYPE_COLORS[sp->type1];
        int tw = 30;
        gfx_fill_rect(cx[i]-15, 110, tw, 8, tc);
        txt_draw_str(cx[i]-13, 111, TYPE_NAMES[sp->type1], COL_WHITE, tc);
    }

    /* Description */
    gfx_fill_rect(4, 120, SCREEN_W-8, 22, RGB(2,4,8));
    gfx_draw_rect(4, 120, SCREEN_W-8, 22, COL_LGRAY);
    txt_draw_str_centered(127, STARTER_DESC[starter_cursor], COL_WHITE, 0xFFFF);

    txt_draw_str_centered(148, "A: Select  <> Navigate", COL_DGRAY, 0xFFFF);

    if (just & KEY_LEFT)  { starter_cursor--; if (starter_cursor < 0) starter_cursor = 2; }
    if (just & KEY_RIGHT) { starter_cursor++; if (starter_cursor > 2) starter_cursor = 0; }

    if ((just & KEY_A) && !starter_confirmed) {
        starter_confirmed = 1;
        /* Init starter */
        init_pokemon(&party[0], STARTERS[starter_cursor], 5);
        party_count = 1;
        /* fade to overworld */
        for (int i = 0; i < 8; i++) {
            vsync();
            gfx_fill_rect(0, 0, SCREEN_W, SCREEN_H, COL_BLACK);
        }
        overworld_init();
        game_state = STATE_OVERWORLD;
    }
}

int main(void) {
    REG_DISPCNT = MODE4_ENABLE;
    rng_state = 0x12345678;
    gfx_init();

    /* Try to load a saved game */
    if (load_game() && party_count > 0) {
        overworld_init();
        game_state = STATE_OVERWORLD;
    }

    while (1) {
        u16 cur  = keys_held();
        u16 just = cur & ~prev_keys;
        prev_keys = cur;

        switch (game_state) {
        case STATE_TITLE:
            vsync();
            draw_title(just);
            break;
        case STATE_INTRO:
            vsync();
            draw_intro(just);
            break;
        case STATE_STARTER_SELECT:
            vsync();
            draw_starter_select(just);
            break;
        case STATE_OVERWORLD:
            overworld_update();
            break;
        case STATE_BATTLE:
            battle_update();
            break;
        case STATE_GAME_OVER:
            vsync();
            gfx_fill(COL_BLACK);
            txt_draw_str_centered(70,  "GAME OVER", COL_RED, COL_BLACK);
            txt_draw_str_centered(90,  "Press START", COL_WHITE, COL_BLACK);
            if (just & KEY_START) game_state = STATE_TITLE;
            break;
        }
    }
    return 0;
}
