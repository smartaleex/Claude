#include "game.h"

Pokemon party[PARTY_SIZE];
int    party_count = 0;
u32    rng_state   = 0xDEADBEEF;

/* ── Stat calculation ────────────────────────────────────────────── */
/* Simplified: stat = floor((2 * base + 63) * level / 100) + 5
   HP:         stat = floor((2 * base + 63) * level / 100) + level + 10  */

void calc_stats(Pokemon* p) {
    const SpeciesData* sp = &species_data[p->species_id];
    int lv = p->level;

    p->max_hp  = gba_div((2 * sp->base_hp  + 63) * lv, 100) + lv + 10;
    p->atk     = gba_div((2 * sp->base_atk + 63) * lv, 100) + 5;
    p->def     = gba_div((2 * sp->base_def + 63) * lv, 100) + 5;
    p->spa     = gba_div((2 * sp->base_spa + 63) * lv, 100) + 5;
    p->spd     = gba_div((2 * sp->base_spd + 63) * lv, 100) + 5;
    p->spe     = gba_div((2 * sp->base_spe + 63) * lv, 100) + 5;
}

/* ── Experience ──────────────────────────────────────────────────── */

u32 exp_for_level(u8 level) {
    /* Medium Fast: EXP = level^3 */
    u32 l = level;
    return l * l * l;
}

u8 level_from_exp(u32 exp) {
    for (u8 lv = 100; lv >= 2; lv--) {
        if (exp >= exp_for_level(lv)) return lv;
    }
    return 1;
}

void give_exp(Pokemon* p, u32 amount) {
    if (p->level >= 100) return;
    p->exp += amount;
    u8 new_lv = level_from_exp(p->exp);
    if (new_lv > p->level) {
        int old_max_hp = p->max_hp;
        p->level = new_lv;
        calc_stats(p);
        /* increase current HP by the difference in max HP */
        p->hp += (p->max_hp - old_max_hp);
        if (p->hp > p->max_hp) p->hp = p->max_hp;
        if (p->level >= 100) { p->level = 100; p->exp = exp_for_level(100); }
    }
}

/* ── Evolution ───────────────────────────────────────────────────── */

void try_evolve(Pokemon* p) {
    const SpeciesData* sp = &species_data[p->species_id];
    if (sp->evolves_to > 0 && sp->evolve_level > 0 && p->level >= sp->evolve_level) {
        p->species_id = sp->evolves_to;
        /* Copy nickname = species name if it was the default */
        const SpeciesData* new_sp = &species_data[p->species_id];
        int same = 1;
        for (int i = 0; i < 12 && (sp->name[i] || p->nickname[i]); i++)
            if (sp->name[i] != p->nickname[i]) { same = 0; break; }
        if (same) {
            for (int i = 0; i < 13; i++) p->nickname[i] = new_sp->name[i];
        }
        /* Recalculate stats for new species */
        calc_stats(p);
    }
}

/* ── Init a Pokemon ──────────────────────────────────────────────── */

static void str_copy(char* dst, const char* src, int max) {
    int i = 0;
    while (src[i] && i < max-1) { dst[i] = src[i]; i++; }
    dst[i] = '\0';
}

void init_pokemon(Pokemon* p, u16 species_id, u8 level) {
    if (species_id >= NUM_SPECIES) species_id = 1;
    const SpeciesData* sp = &species_data[species_id];

    p->species_id = species_id;
    str_copy(p->nickname, sp->name, 13);
    p->level  = level;
    p->exp    = exp_for_level(level);
    p->status = STATUS_NONE;

    for (int i = 0; i < 7; i++) p->stat_stages[i] = 0;

    calc_stats(p);
    p->hp = p->max_hp;

    /* Assign starting moves */
    p->move_ids[0] = sp->move1_id;
    p->move_ids[1] = sp->move2_id;
    p->move_ids[2] = 0;
    p->move_ids[3] = 0;

    /* Add a few level-appropriate moves */
    /* give Tackle + type move to everything */
    if (p->move_ids[0] == 0) p->move_ids[0] = 1; /* Tackle */

    /* level-up bonus moves */
    if (level >= 15) {
        PokemonType t = sp->type1;
        /* pick a decent STAB move by type */
        u8 bonus = 0;
        if (t == TYPE_FIRE)     bonus = 52;  /* Ember */
        if (t == TYPE_WATER)    bonus = 55;  /* Water Gun */
        if (t == TYPE_GRASS)    bonus = 71;  /* Absorb */
        if (t == TYPE_ELECTRIC) bonus = 84;  /* Thundershock */
        if (t == TYPE_PSYCHIC)  bonus = 93;  /* Confusion */
        if (t == TYPE_FIGHTING) bonus = 66;  /* Karate Chop */
        if (t == TYPE_POISON)   bonus = 40;  /* Poison Sting */
        if (t == TYPE_GROUND)   bonus = 28;  /* Sand Attack */
        if (t == TYPE_ROCK)     bonus = 88;  /* Rock Throw */
        if (t == TYPE_BUG)      bonus = 33;  /* String Shot */
        if (t == TYPE_GHOST)    bonus = 101; /* Lick */
        if (t == TYPE_DRAGON)   bonus = 82;  /* DragonRage */
        if (t == TYPE_ICE)      bonus = 58;  /* IcePunch */
        if (t == TYPE_DARK)     bonus = 185; /* Bite */
        if (t == TYPE_STEEL)    bonus = 232; /* Metal Claw */
        if (t == TYPE_FAIRY)    bonus = 3;   /* Growl (placeholder) */
        if (t == TYPE_FLYING)   bonus = 16;  /* Gust */
        if (t == TYPE_NORMAL)   bonus = 10;  /* Scratch */
        if (bonus != 0 && p->move_ids[1] == 0) p->move_ids[1] = bonus;
        else if (bonus != 0 && p->move_ids[2] == 0) p->move_ids[2] = bonus;
    }
    if (level >= 30) {
        if (p->move_ids[2] == 0) p->move_ids[2] = 14; /* Hyper Fang (Normal) */
    }
    if (level >= 50) {
        if (p->move_ids[3] == 0) p->move_ids[3] = 99; /* Earthquake */
    }

    for (int i = 0; i < MAX_MOVES; i++) {
        u8 mid = p->move_ids[i];
        if (mid > 0 && mid < NUM_MOVES) {
            p->move_pp[i]     = move_data[mid].pp;
            p->move_max_pp[i] = move_data[mid].pp;
        } else {
            p->move_pp[i] = 0; p->move_max_pp[i] = 0;
        }
    }
}
