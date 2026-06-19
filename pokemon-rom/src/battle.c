#include "game.h"

/* ── Type effectiveness table ────────────────────────────────────── */
/* Rows = attacker type, Cols = defender type (0=Normal..17=Fairy).
   Values: 0=immune, 5=half, 10=normal, 20=super. */
static const u8 type_chart[18][18] = {
/*         NRM FIR WAT ELE GRS ICE FGT PSN GRD FLY PSY BUG ROC GHO DRG DRK STL FAI */
/* NRM */ { 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,  5,  0, 10, 10,  5, 10},
/* FIR */ { 10,  5,  5, 10, 20, 20, 10, 10, 10, 10, 10, 20,  5, 10,  5, 10, 20, 10},
/* WAT */ { 10, 20,  5, 10,  5, 10, 10, 10, 20, 10, 10, 10, 20, 10,  5, 10, 10, 10},
/* ELE */ { 10, 10, 20,  5, 10, 10, 10, 10,  0, 20, 10, 10, 10, 10,  5, 10, 10, 10},
/* GRS */ { 10,  5, 20, 10,  5, 10, 10,  5, 20,  5, 10,  5, 20, 10,  5, 10,  5, 10},
/* ICE */ { 10, 10, 10, 10, 20,  5, 10, 10, 20, 20, 10, 10, 10, 10, 20, 10,  5, 10},
/* FGT */ { 20, 10, 10, 10, 10, 20,  5,  5, 10,  5,  5,  5, 20,  0, 10, 20, 20,  5},
/* PSN */ { 10, 10, 10, 10, 20, 10, 10,  5, 10, 10, 10, 10,  5, 10, 10, 10,  0, 20},
/* GRD */ { 10, 20, 10, 20,  5, 10, 10, 20, 10,  0, 10, 10, 20, 10, 10, 10, 20, 10},
/* FLY */ { 10, 10, 10,  5, 20, 10, 20, 10, 10, 10, 10, 20,  5, 10, 10, 10,  5, 10},
/* PSY */ { 10, 10, 10, 10, 10, 10, 20, 20, 10, 10,  5, 10, 10, 10, 10,  0,  5, 10},
/* BUG */ { 10, 10, 10, 10, 20, 10,  5, 10, 10,  5, 20, 10,  5, 10, 10, 20,  5,  5},
/* ROC */ { 10, 20, 10, 10, 10, 20,  5, 10, 10, 20, 10, 20, 10, 10, 10, 10,  5, 10},
/* GHO */ {  0, 10, 10, 10, 10, 10, 10, 10, 10, 10, 20, 10, 10, 20, 10,  5, 10, 10},
/* DRG */ { 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 20, 10,  5,  0},
/* DRK */ { 10, 10, 10, 10, 10, 10,  5, 10, 10, 10, 20, 10, 10, 20, 10,  5, 10,  5},
/* STL */ { 10,  5, 10, 10, 10, 20, 10, 10, 10, 10, 10, 10, 20, 10, 10, 10,  5, 20},
/* FAI */ { 10, 10, 10, 10, 10, 10, 20,  5, 10, 10, 10, 10, 10, 10, 20, 20,  5, 10},
};

static u8 get_effectiveness(PokemonType atk, PokemonType def1, PokemonType def2) {
    u32 e = type_chart[atk][def1];
    if (def2 != TYPE_NONE && def2 != def1)
        e = gba_div(e * type_chart[atk][def2], 10);
    return (u8)e;
}

/* ── Battle state ────────────────────────────────────────────────── */
typedef enum {
    BS_DRAW=0, BS_MSG, BS_PLAYER_MENU, BS_MOVE_SELECT,
    BS_TURN_EXEC, BS_ANIMATE, BS_LEVELUP, BS_WIN, BS_LOSE, BS_FLEE,
    BS_CATCH_ANIM
} BattlePhase;

typedef struct {
    Pokemon* pl;    /* player's active mon */
    Pokemon  enemy;
    int      is_trainer;
    BattlePhase phase;
    int      msg_timer;
    char     msg[64];
    int      player_move;   /* chosen move index */
    int      enemy_move;
    int      turn;
    int      anim_timer;
    int      cursor;        /* menu cursor */
    int      flee_attempts;
    u32      pending_exp;
    u8       last_eff;      /* last type effectiveness */
    int      pokeballs;     /* inventory */
    int      catch_shakes;
    int      catch_success;
} BattleState;

static BattleState bs;

/* ── Drawing ─────────────────────────────────────────────────────── */

static void draw_battle_bg(void) {
    /* sky */
    gfx_fill_rect(0, 0, SCREEN_W, 90, COL_SKYBLUE);
    /* ground strips */
    gfx_fill_rect(0, 90, SCREEN_W, 10, RGB(20,24,12));
    gfx_fill_rect(0, 100, SCREEN_W, 5, RGB(14,18,8));
    /* player platform */
    gfx_fill_rect(20, 115, 80, 8, RGB(18,20,10));
    gfx_fill_rect(22, 123, 76, 4, RGB(12,14,6));
    /* enemy platform */
    gfx_fill_rect(140, 70, 80, 8, RGB(18,20,10));
    gfx_fill_rect(142, 78, 76, 4, RGB(12,14,6));
}

static void draw_enemy_info(void) {
    /* info box */
    gfx_fill_rect(2, 4, 115, 34, RGB(4,6,8));
    gfx_draw_rect(2, 4, 115, 34, COL_LGRAY);

    txt_draw_str(5, 7,  bs.enemy.nickname,  COL_WHITE, RGB(4,6,8));
    txt_draw_str(5, 16, "Lv", COL_LGRAY, RGB(4,6,8));
    txt_draw_int(17, 16, bs.enemy.level, COL_LGRAY, RGB(4,6,8));
    txt_draw_str(5, 24, "HP", COL_LGRAY, RGB(4,6,8));
    gfx_draw_hp_bar(18, 26, 90, 5, bs.enemy.hp, bs.enemy.max_hp);

    /* type badge */
    const SpeciesData* sp = &species_data[bs.enemy.species_id];
    u16 tc = TYPE_COLORS[sp->type1];
    gfx_fill_rect(80, 7, 35, 7, tc);
    txt_draw_str(82, 8, TYPE_NAMES[sp->type1], COL_WHITE, tc);
}

static void draw_player_info(void) {
    gfx_fill_rect(125, 97, 112, 34, RGB(4,6,8));
    gfx_draw_rect(125, 97, 112, 34, COL_LGRAY);

    txt_draw_str(128, 100, bs.pl->nickname,   COL_WHITE, RGB(4,6,8));
    txt_draw_str(128, 109, "Lv", COL_LGRAY, RGB(4,6,8));
    txt_draw_int(140, 109, bs.pl->level,      COL_LGRAY, RGB(4,6,8));
    txt_draw_str(128, 117, "HP", COL_LGRAY, RGB(4,6,8));
    gfx_draw_hp_bar(140, 119, 90, 5, bs.pl->hp, bs.pl->max_hp);
    /* HP numbers */
    txt_draw_int(186, 117, bs.pl->hp,     COL_LGRAY, RGB(4,6,8));
    txt_draw_str(204, 117, "/",            COL_DGRAY, RGB(4,6,8));
    txt_draw_int(210, 117, bs.pl->max_hp, COL_DGRAY, RGB(4,6,8));
}

static void draw_status_label(int x, int y, StatusEffect st) {
    if (st == STATUS_NONE) return;
    const char* names[] = {"","BRN","PSN","PAR","SLP","FRZ"};
    const u16   colors[] = {0,COL_ORANGE,COL_PURPLE,COL_YELLOW,COL_BLUE,COL_CYAN};
    gfx_fill_rect(x, y, 24, 8, colors[st]);
    txt_draw_str(x+1, y+1, names[st], COL_WHITE, colors[st]);
}

static void draw_textbox(void) {
    gfx_fill_rect(0, 133, SCREEN_W, 27, RGB(2,4,6));
    gfx_draw_rect(0, 133, SCREEN_W, 27, COL_LGRAY);
    txt_draw_str(4, 137, bs.msg, COL_WHITE, RGB(2,4,6));
}

static void draw_move_menu(void) {
    gfx_fill_rect(0, 133, SCREEN_W, 27, RGB(2,4,6));
    gfx_draw_rect(0, 133, SCREEN_W, 27, COL_LGRAY);

    for (int i = 0; i < MAX_MOVES; i++) {
        int mx = (i & 1) ? 122 : 4;
        int my = 137 + (i >> 1) * 11;
        u8 mid = bs.pl->move_ids[i];
        if (mid == 0) continue;
        u16 bg = (i == bs.cursor) ? COL_GRAY : RGB(2,4,6);
        gfx_fill_rect(mx-2, my-1, 116, 10, bg);
        txt_draw_str(mx, my, move_data[mid].name, COL_WHITE, bg);
        /* PP */
        txt_draw_str(mx+68, my, "PP", COL_LGRAY, bg);
        txt_draw_int(mx+80, my, bs.pl->move_pp[i], COL_LGRAY, bg);
        /* type badge */
        u16 tc = TYPE_COLORS[move_data[mid].type];
        gfx_fill_rect(mx+92, my, 22, 8, tc);
        txt_draw_str(mx+93, my+1, TYPE_NAMES[move_data[mid].type], COL_WHITE, tc);
    }
    /* cursor arrow */
    txt_draw_str(
        (bs.cursor & 1) ? 120 : 2,
        137 + (bs.cursor >> 1) * 11,
        ">", COL_YELLOW, RGB(2,4,6)
    );
}

static void draw_main_menu(void) {
    gfx_fill_rect(0, 133, SCREEN_W, 27, RGB(2,4,6));
    gfx_draw_rect(0, 133, SCREEN_W, 27, COL_LGRAY);
    /* Show Pokeball count */
    txt_draw_str(182, 134, "Ball:", COL_LGRAY, RGB(2,4,6));
    txt_draw_int(214, 134, bs.pokeballs, COL_YELLOW, RGB(2,4,6));
    const char* opts[] = {"FIGHT","POKEMON","BALL","RUN"};
    for (int i = 0; i < 4; i++) {
        int mx = (i & 1) ? 130 : 10;
        int my = 137 + (i >> 1) * 11;
        u16 bg = (i == bs.cursor) ? COL_GRAY : RGB(2,4,6);
        gfx_fill_rect(mx-2, my-1, 90, 10, bg);
        if (i == bs.cursor) txt_draw_str(mx-6, my, ">", COL_YELLOW, bg);
        txt_draw_str(mx, my, opts[i], COL_WHITE, bg);
    }
}

static void redraw_battle(void) {
    draw_battle_bg();

    /* enemy sprite */
    gfx_draw_pokemon(180, 55, 28, bs.enemy.species_id, 0);
    draw_status_label(152, 40, bs.enemy.status);
    draw_enemy_info();

    /* player sprite */
    gfx_draw_pokemon(60, 100, 28, bs.pl->species_id, 1);
    draw_status_label(36, 88, bs.pl->status);
    draw_player_info();

    switch (bs.phase) {
        case BS_PLAYER_MENU: draw_main_menu();   break;
        case BS_MOVE_SELECT: draw_move_menu();   break;
        default:             draw_textbox();     break;
    }
}

/* ── Helpers ─────────────────────────────────────────────────────── */

static void set_msg(const char* m) {
    int i = 0;
    while (m[i] && i < 63) { bs.msg[i] = m[i]; i++; }
    bs.msg[i] = '\0';
    bs.msg_timer = 90;   /* frames */
    bs.phase = BS_MSG;
}

static void msg_append_str(char* dst, const char* src) {
    int i = 0; while (dst[i]) i++;
    while (*src && i < 63) dst[i++] = *src++;
    dst[i] = '\0';
}

static void msg_append_int(char* dst, int n) {
    char tmp[8]; int j = 6; tmp[7] = '\0';
    if (n == 0) { tmp[j--] = '0'; }
    while (n > 0) { tmp[j--] = '0' + gba_mod(n,10); n = gba_div(n,10); }
    msg_append_str(dst, tmp + j + 1);
}

/* ── Damage calculation (Gen 3 formula) ─────────────────────────── */

static int calc_damage(Pokemon* atk, Pokemon* def, int move_idx) {
    u8 mid = atk->move_ids[move_idx];
    if (mid == 0) return 0;
    const MoveData* mv = &move_data[mid];
    if (mv->power == 0) return 0;

    int level  = atk->level;
    int power  = mv->power;
    int a_stat, d_stat;
    if (mv->cat == CAT_PHYSICAL) {
        a_stat = atk->atk; d_stat = def->def;
    } else {
        a_stat = atk->spa; d_stat = def->spd;
    }

    /* apply stat stages */
    static const int stage_mul[13] = {25,29,33,40,50,66,100,150,200,250,300,350,400};
    int a_stage = atk->stat_stages[mv->cat == CAT_PHYSICAL ? 0 : 2] + 6;
    int d_stage = def->stat_stages[mv->cat == CAT_PHYSICAL ? 1 : 3] + 6;
    if (a_stage < 0) a_stage = 0; if (a_stage > 12) a_stage = 12;
    if (d_stage < 0) d_stage = 0; if (d_stage > 12) d_stage = 12;
    a_stat = gba_div(a_stat * stage_mul[a_stage], 100);
    d_stat = gba_div(d_stat * stage_mul[d_stage], 100);

    /* base damage */
    int dmg = gba_div((2 * level + 10) * power * a_stat, d_stat * 250) + 2;

    /* STAB */
    const SpeciesData* sp = &species_data[atk->species_id];
    if (mv->type == sp->type1 || mv->type == sp->type2)
        dmg = dmg + gba_div(dmg, 2);   /* ×1.5 */

    /* type effectiveness */
    const SpeciesData* dsp = &species_data[def->species_id];
    u8 eff = get_effectiveness(mv->type, dsp->type1, dsp->type2);
    bs.last_eff = eff;
    dmg = gba_div(dmg * eff, 10);

    /* random variance ±15% */
    int rv = (int)rand_range(85, 100);
    dmg = gba_div(dmg * rv, 100);

    if (dmg < 1) dmg = 1;
    if (eff == 0) dmg = 0;
    return dmg;
}

/* ── AI move selection ───────────────────────────────────────────── */

static int ai_pick_move(void) {
    int best = -1, best_dmg = -1;
    for (int i = 0; i < MAX_MOVES; i++) {
        u8 mid = bs.enemy.move_ids[i];
        if (mid == 0 || bs.enemy.move_pp[i] == 0) continue;
        /* calculate expected damage */
        const MoveData* mv = &move_data[mid];
        int dmg = 0;
        if (mv->power > 0) {
            const SpeciesData* dsp = &species_data[bs.pl->species_id];
            u8 eff = get_effectiveness(mv->type, dsp->type1, dsp->type2);
            dmg = mv->power * eff;
        } else {
            dmg = 10; /* status moves are worth something */
        }
        if (dmg > best_dmg) { best_dmg = dmg; best = i; }
    }
    if (best < 0) {
        /* no usable move – pick Struggle (move 1) */
        return 0;
    }
    return best;
}

/* ── Apply move effects ──────────────────────────────────────────── */

static void apply_effect(Pokemon* target, const MoveData* mv) {
    if (mv->effect == EFF_NONE) return;
    u32 roll = rand_range(1, 100);
    if (roll > mv->effect_chance && mv->effect_chance != 100) return;

    switch (mv->effect) {
    case EFF_BURN:
        if (target->status == STATUS_NONE && species_data[target->species_id].type1 != TYPE_FIRE)
            target->status = STATUS_BURN;
        break;
    case EFF_POISON: case EFF_BADLY_POISON:
        if (target->status == STATUS_NONE)
            target->status = STATUS_POISON;
        break;
    case EFF_PARALYZE:
        if (target->status == STATUS_NONE)
            target->status = STATUS_PARALYSIS;
        break;
    case EFF_SLEEP:
        if (target->status == STATUS_NONE)
            target->status = STATUS_SLEEP;
        break;
    case EFF_FREEZE:
        if (target->status == STATUS_NONE)
            target->status = STATUS_FREEZE;
        break;
    case EFF_ATK_UP1:   target->stat_stages[0]++; break;
    case EFF_DEF_UP1:   target->stat_stages[1]++; break;
    case EFF_SPA_UP1:   target->stat_stages[2]++; break;
    case EFF_SPD_UP1:   target->stat_stages[3]++; break;
    case EFF_SPE_UP1:   target->stat_stages[4]++; break;
    case EFF_ATK_DN1:   target->stat_stages[0]--; break;
    case EFF_DEF_DN1:   target->stat_stages[1]--; break;
    default: break;
    }
}

/* ── Execute one move ────────────────────────────────────────────── */

static void execute_move(Pokemon* attacker, Pokemon* defender, int move_idx, int is_enemy) {
    u8 mid = attacker->move_ids[move_idx];
    if (mid == 0) { set_msg("But nothing happened!"); return; }
    const MoveData* mv = &move_data[mid];

    /* deduct PP */
    if (attacker->move_pp[move_idx] > 0)
        attacker->move_pp[move_idx]--;

    /* paralysis check */
    if (attacker->status == STATUS_PARALYSIS && rand_range(1,4) == 1) {
        bs.msg[0] = '\0';
        msg_append_str(bs.msg, attacker->nickname);
        msg_append_str(bs.msg, " is paralyzed!");
        bs.msg_timer = 60; bs.phase = BS_MSG; return;
    }
    /* sleep check */
    if (attacker->status == STATUS_SLEEP) {
        bs.msg[0] = '\0';
        msg_append_str(bs.msg, attacker->nickname);
        msg_append_str(bs.msg, " is fast asleep!");
        /* 33% wake up */
        if (rand_range(1,3) == 1) attacker->status = STATUS_NONE;
        bs.msg_timer = 60; bs.phase = BS_MSG; return;
    }
    /* freeze check */
    if (attacker->status == STATUS_FREEZE) {
        if (mv->type == TYPE_FIRE || rand_range(1,5) == 1)
            attacker->status = STATUS_NONE;
        else {
            bs.msg[0] = '\0';
            msg_append_str(bs.msg, attacker->nickname);
            msg_append_str(bs.msg, " is frozen solid!");
            bs.msg_timer = 60; bs.phase = BS_MSG; return;
        }
    }

    /* accuracy check */
    if (mv->accuracy > 0) {
        int acc_stage = attacker->stat_stages[5];
        int eva_stage = defender->stat_stages[6];
        int net = acc_stage - eva_stage;
        if (net < -6) net = -6; if (net > 6) net = 6;
        static const int acc_mul[13] = {33,36,43,50,60,75,100,133,166,200,233,266,300};
        int hit_chance = gba_div(mv->accuracy * acc_mul[net+6], 100);
        if ((int)rand_range(1,100) > hit_chance) {
            bs.msg[0] = '\0';
            msg_append_str(bs.msg, attacker->nickname);
            msg_append_str(bs.msg, " missed!");
            bs.msg_timer = 60; bs.phase = BS_MSG; return;
        }
    }

    /* compose use-message */
    bs.msg[0] = '\0';
    msg_append_str(bs.msg, attacker->nickname);
    msg_append_str(bs.msg, " used ");
    msg_append_str(bs.msg, mv->name);
    msg_append_str(bs.msg, "!");

    int dmg = calc_damage(attacker, defender, move_idx);
    if (dmg > 0) {
        defender->hp -= dmg;
        if (defender->hp < 0) defender->hp = 0;
        if (bs.last_eff == 0) {
            msg_append_str(bs.msg, " Immune!");
        } else if (bs.last_eff > 10) {
            msg_append_str(bs.msg, " Super eff!");
        } else if (bs.last_eff < 10) {
            msg_append_str(bs.msg, " Not eff...");
        }
        /* recoil */
        if (mv->effect == EFF_RECOIL25) {
            attacker->hp -= gba_div(dmg, 4);
            if (attacker->hp < 0) attacker->hp = 0;
        }
        /* drain */
        if (mv->effect == EFF_DRAIN50) {
            attacker->hp += gba_div(dmg, 2);
            if (attacker->hp > attacker->max_hp)
                attacker->hp = attacker->max_hp;
        }
        /* explosion */
        if (mv->effect == EFF_EXPLODE) {
            attacker->hp = 0;
        }
    } else if (dmg == 0 && mv->power == 0) {
        apply_effect(defender, mv);
        apply_effect(attacker, mv);
    }

    apply_effect(defender, mv);

    bs.msg_timer = 90;
    bs.phase = BS_MSG;
}

/* ── Apply status damage at end of turn ─────────────────────────── */

static void apply_status_damage(Pokemon* p) {
    if (p->status == STATUS_BURN || p->status == STATUS_POISON) {
        int dmg = gba_div(p->max_hp, 8);
        if (dmg < 1) dmg = 1;
        p->hp -= dmg;
        if (p->hp < 0) p->hp = 0;
    }
}

/* ── Battle init / update ────────────────────────────────────────── */

void battle_start(u16 enemy_species_id, u8 enemy_level, int is_trainer) {
    bs.pl = &party[0];
    init_pokemon(&bs.enemy, enemy_species_id, enemy_level);
    bs.is_trainer = is_trainer;
    bs.phase = BS_DRAW;
    bs.turn = 0;
    bs.cursor = 0;
    bs.flee_attempts = 0;
    bs.pending_exp = 0;
    bs.last_eff = 10;
    bs.pokeballs = player_pokeballs;
    bs.catch_shakes = 0;
    bs.catch_success = 0;

    bs.msg[0] = '\0';
    if (is_trainer) {
        msg_append_str(bs.msg, "Trainer sent out ");
    } else {
        msg_append_str(bs.msg, "Wild ");
    }
    msg_append_str(bs.msg, bs.enemy.nickname);
    msg_append_str(bs.msg, "!");
    bs.msg_timer = 90;
    bs.phase = BS_DRAW;

    game_state = STATE_BATTLE;
}

void battle_update(void) {
    static u16 prev_keys = 0;
    u16 cur  = keys_held();
    u16 just = cur & ~prev_keys;
    prev_keys = cur;

    switch (bs.phase) {

    case BS_DRAW:
        vsync();
        redraw_battle();
        bs.phase = BS_MSG;
        break;

    case BS_MSG:
        vsync();
        redraw_battle();
        bs.msg_timer--;
        if (bs.msg_timer <= 0 || (just & KEY_A)) {
            if (bs.catch_success && bs.catch_shakes >= 4) {
                player_pokeballs = bs.pokeballs;
                save_game();
                game_state = STATE_OVERWORLD;
                bs.catch_success = 0; bs.catch_shakes = 0;
                break;
            }
            if (bs.enemy.hp <= 0) { bs.phase = BS_WIN; break; }
            if (bs.pl->hp <= 0)   { bs.phase = BS_LOSE; break; }
            bs.phase = BS_PLAYER_MENU;
            bs.cursor = 0;
        }
        break;

    case BS_PLAYER_MENU:
        vsync();
        redraw_battle();
        if (just & KEY_RIGHT) bs.cursor = (bs.cursor & ~1) | 1;
        if (just & KEY_LEFT)  bs.cursor = bs.cursor & ~1;
        if (just & KEY_DOWN)  bs.cursor = (bs.cursor & ~2) | 2;
        if (just & KEY_UP)    bs.cursor = bs.cursor & ~2;
        if (bs.cursor > 3) bs.cursor = 3;

        if (just & KEY_A) {
            if (bs.cursor == 0) { /* FIGHT */
                bs.phase = BS_MOVE_SELECT;
                bs.cursor = 0;
                /* skip empty move slots */
                while (bs.cursor < MAX_MOVES && bs.pl->move_ids[bs.cursor] == 0)
                    bs.cursor++;
            } else if (bs.cursor == 3) { /* RUN */
                if (bs.is_trainer) {
                    set_msg("Can't flee trainer battle!");
                } else {
                    bs.flee_attempts++;
                    /* flee formula */
                    int f = gba_div((bs.pl->spe * 32), (bs.enemy.spe / 4 + 1)) + 30 * bs.flee_attempts;
                    if (f > 255 || (int)rand_range(0,255) < f) {
                        set_msg("Got away safely!");
                        bs.phase = BS_FLEE;
                    } else {
                        set_msg("Can't escape!");
                    }
                }
            } else if (bs.cursor == 1) { /* POKEMON - not yet */
                set_msg("No switch yet!");
            } else if (bs.cursor == 2) { /* ITEM / Pokeball */
                if (bs.is_trainer) {
                    set_msg("Can't catch trainers!");
                } else if (bs.pokeballs <= 0) {
                    set_msg("No Pokeballs left!");
                } else {
                    bs.pokeballs--;
                    /* Catch rate formula */
                    const SpeciesData* esp = &species_data[bs.enemy.species_id];
                    int a = gba_div((3 * bs.enemy.max_hp - 2 * bs.enemy.hp) * esp->catch_rate, 3 * bs.enemy.max_hp);
                    /* status bonus */
                    if (bs.enemy.status == STATUS_SLEEP || bs.enemy.status == STATUS_FREEZE)
                        a = a * 5 / 2;
                    else if (bs.enemy.status != STATUS_NONE)
                        a = a * 3 / 2;
                    if (a > 255) a = 255;
                    /* number of shakes: 0-3, then either escape or caught */
                    int b = gba_div(65535, (int)(65536 / (a + 1)));
                    bs.catch_success = 1;
                    bs.catch_shakes = 0;
                    for (int k = 0; k < 4; k++) {
                        if ((int)rand_range(0, 65535) > b) {
                            bs.catch_shakes = k;
                            bs.catch_success = 0;
                            break;
                        }
                    }
                    if (bs.catch_success) bs.catch_shakes = 4;
                    bs.msg_timer = 30;
                    bs.phase = BS_CATCH_ANIM;
                }
            }
        }
        break;

    case BS_MOVE_SELECT:
        vsync();
        redraw_battle();
        if (just & KEY_RIGHT) { bs.cursor = (bs.cursor & ~1) | 1; }
        if (just & KEY_LEFT)  { bs.cursor = bs.cursor & ~1; }
        if (just & KEY_DOWN)  { bs.cursor = (bs.cursor & ~2) | 2; }
        if (just & KEY_UP)    { bs.cursor = bs.cursor & ~2; }
        if (bs.cursor >= MAX_MOVES) bs.cursor = MAX_MOVES - 1;
        /* skip empty slots */
        if (bs.pl->move_ids[bs.cursor] == 0) {
            for (int i = 0; i < MAX_MOVES; i++)
                if (bs.pl->move_ids[i]) { bs.cursor = i; break; }
        }

        if (just & KEY_B) { bs.phase = BS_PLAYER_MENU; bs.cursor = 0; break; }

        if (just & KEY_A) {
            if (bs.pl->move_pp[bs.cursor] == 0) {
                set_msg("No PP left!");
            } else {
                bs.player_move = bs.cursor;
                bs.enemy_move  = ai_pick_move();
                bs.phase = BS_TURN_EXEC;
            }
        }
        break;

    case BS_TURN_EXEC: {
        /* determine order: higher speed goes first */
        int pl_spd  = bs.pl->spe;
        int en_spd  = bs.enemy.spe;
        if (bs.pl->status == STATUS_PARALYSIS)   pl_spd /= 2;
        if (bs.enemy.status == STATUS_PARALYSIS) en_spd /= 2;

        int pl_first = (pl_spd >= en_spd);
        if (pl_spd == en_spd) pl_first = (rand_range(0,1) == 0);

        if (pl_first) {
            execute_move(bs.pl, &bs.enemy, bs.player_move, 0);
            if (bs.enemy.hp > 0)
                execute_move(&bs.enemy, bs.pl, bs.enemy_move, 1);
        } else {
            execute_move(&bs.enemy, bs.pl, bs.enemy_move, 1);
            if (bs.pl->hp > 0)
                execute_move(bs.pl, &bs.enemy, bs.player_move, 0);
        }
        apply_status_damage(bs.pl);
        apply_status_damage(&bs.enemy);
        bs.turn++;
        /* Let BS_MSG display the attack message, then it checks HP. */
        /* execute_move always sets bs.phase = BS_MSG already. */
        break;
    }

    case BS_WIN: {
        vsync();
        redraw_battle();
        /* XP gain: (base_exp * level) / 7  (simplified) */
        const SpeciesData* esp = &species_data[bs.enemy.species_id];
        u32 xp = (u32)gba_div(esp->base_exp * bs.enemy.level, 7);
        if (xp < 1) xp = 1;
        bs.msg[0] = '\0';
        msg_append_str(bs.msg, bs.pl->nickname);
        msg_append_str(bs.msg, " gained ");
        msg_append_int(bs.msg, (int)xp);
        msg_append_str(bs.msg, " EXP!");
        give_exp(bs.pl, xp);
        try_evolve(bs.pl);
        bs.msg_timer = 120;
        bs.phase = BS_LEVELUP;
        break;
    }

    case BS_LEVELUP:
        vsync();
        redraw_battle();
        bs.msg_timer--;
        if (bs.msg_timer <= 0 || (just & KEY_A)) {
            player_pokeballs = bs.pokeballs;
            save_game();
            game_state = STATE_OVERWORLD;
        }
        break;

    case BS_LOSE:
        vsync();
        gfx_fill(COL_DGRAY);
        txt_draw_str_centered(60, "You ran out of", COL_WHITE, COL_DGRAY);
        txt_draw_str_centered(72, "usable Pokemon!", COL_RED, COL_DGRAY);
        txt_draw_str_centered(100, "Press START to retry", COL_LGRAY, COL_DGRAY);
        if (just & KEY_START) {
            /* heal party and go back */
            for (int i = 0; i < party_count; i++) {
                party[i].hp = party[i].max_hp;
                party[i].status = STATUS_NONE;
                for (int j = 0; j < MAX_MOVES; j++)
                    party[i].move_pp[j] = party[i].move_max_pp[j];
            }
            game_state = STATE_OVERWORLD;
        }
        break;

    case BS_FLEE:
        vsync();
        redraw_battle();
        bs.msg_timer--;
        if (bs.msg_timer <= 0 || (just & KEY_A)) {
            game_state = STATE_OVERWORLD;
        }
        break;

    case BS_CATCH_ANIM: {
        vsync();
        /* Animate: draw Pokeball bouncing over enemy */
        draw_battle_bg();
        gfx_draw_pokemon(60, 100, 28, bs.pl->species_id, 1);
        draw_player_info();
        /* enemy only if not caught yet */
        if (!bs.catch_success || bs.catch_shakes < 4)
            gfx_draw_pokemon(180, 55, 28, bs.enemy.species_id, 0);
        /* Draw pokeball (red circle) at enemy position */
        int bx = 180, by = 30;
        int phase_frame = (bs.catch_shakes * 30) - bs.msg_timer;
        if (phase_frame < 15) by -= phase_frame;   /* ball flying up */
        else by -= (29 - phase_frame);              /* ball falling */
        gfx_fill_rect(bx-5, by-5, 10, 10, COL_RED);
        gfx_fill_rect(bx-5, by,   10,  5, COL_WHITE);
        gfx_draw_rect(bx-5, by-5, 10, 10, COL_BLACK);
        gfx_draw_hline(bx-5, by, 10, COL_BLACK);
        /* shake count text */
        if (bs.catch_shakes == 0) txt_draw_str_centered(118, "...", COL_WHITE, 0xFFFF);
        else {
            char shake_msg[20] = "Shake! ";
            shake_msg[7] = '0' + bs.catch_shakes;
            shake_msg[8] = '\0';
            txt_draw_str_centered(118, shake_msg, COL_YELLOW, 0xFFFF);
        }

        bs.msg_timer--;
        if (bs.msg_timer <= 0) {
            bs.catch_shakes++;
            if (bs.catch_shakes >= 4) {
                if (bs.catch_success) {
                    /* Caught! Add to party */
                    bs.msg[0] = '\0';
                    msg_append_str(bs.msg, bs.enemy.nickname);
                    msg_append_str(bs.msg, " was caught!");
                    if (party_count < PARTY_SIZE) {
                        party[party_count] = bs.enemy;
                        party_count++;
                    }
                    bs.msg_timer = 120;
                    bs.phase = BS_MSG;
                    /* After message, go to overworld */
                } else {
                    /* Escaped */
                    bs.msg[0] = '\0';
                    msg_append_str(bs.msg, bs.enemy.nickname);
                    msg_append_str(bs.msg, " broke free!");
                    bs.msg_timer = 60;
                    bs.phase = BS_MSG;
                }
            } else {
                bs.msg_timer = 30; /* next shake */
            }
        }
        break;
    }

    default: break;
    }
}
