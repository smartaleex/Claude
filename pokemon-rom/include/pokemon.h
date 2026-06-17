#pragma once
#include "gba.h"

/* ── Types ───────────────────────────────────────────────────────── */
typedef enum {
    TYPE_NORMAL=0, TYPE_FIRE, TYPE_WATER, TYPE_ELECTRIC, TYPE_GRASS,
    TYPE_ICE, TYPE_FIGHTING, TYPE_POISON, TYPE_GROUND, TYPE_FLYING,
    TYPE_PSYCHIC, TYPE_BUG, TYPE_ROCK, TYPE_GHOST, TYPE_DRAGON,
    TYPE_DARK, TYPE_STEEL, TYPE_FAIRY, TYPE_NONE=18
} PokemonType;

static const char* const TYPE_NAMES[] = {
    "Normal","Fire","Water","Electric","Grass","Ice","Fighting",
    "Poison","Ground","Flying","Psychic","Bug","Rock","Ghost",
    "Dragon","Dark","Steel","Fairy","---"
};

static const u16 TYPE_COLORS[] = {
    RGB(21,21,21),  /* Normal   */
    RGB(31,12, 2),  /* Fire     */
    RGB( 0,18,31),  /* Water    */
    RGB(31,28, 0),  /* Electric */
    RGB( 4,26, 4),  /* Grass    */
    RGB(16,28,31),  /* Ice      */
    RGB(24, 6, 2),  /* Fighting */
    RGB(20, 0,22),  /* Poison   */
    RGB(22,16, 0),  /* Ground   */
    RGB(12,20,30),  /* Flying   */
    RGB(31,14,31),  /* Psychic  */
    RGB(12,20, 4),  /* Bug      */
    RGB(24,18, 6),  /* Rock     */
    RGB( 6, 4,14),  /* Ghost    */
    RGB( 8, 4,31),  /* Dragon   */
    RGB( 8, 6,14),  /* Dark     */
    RGB(22,24,26),  /* Steel    */
    RGB(31,22,28),  /* Fairy    */
    RGB( 0, 0, 0)   /* None     */
};

/* ── Status ──────────────────────────────────────────────────────── */
typedef enum {
    STATUS_NONE=0, STATUS_BURN, STATUS_POISON, STATUS_PARALYSIS,
    STATUS_SLEEP, STATUS_FREEZE
} StatusEffect;

/* ── Move category ───────────────────────────────────────────────── */
typedef enum { CAT_PHYSICAL=0, CAT_SPECIAL, CAT_STATUS } MoveCategory;

/* ── Move effect ─────────────────────────────────────────────────── */
typedef enum {
    EFF_NONE=0,
    EFF_BURN, EFF_POISON, EFF_PARALYZE, EFF_SLEEP, EFF_FREEZE,
    EFF_CONFUSE,
    EFF_ATK_UP1,EFF_DEF_UP1,EFF_SPA_UP1,EFF_SPD_UP1,EFF_SPE_UP1,
    EFF_ATK_DN1,EFF_DEF_DN1,EFF_ACC_DN1,EFF_EVA_UP1,
    EFF_RECOIL25,  /* 25% recoil */
    EFF_DRAIN50,   /* 50% drain */
    EFF_FLINCH,
    EFF_OHKO,
    EFF_MULTI_HIT, /* 2-5 hits */
    EFF_CHARGE,    /* two-turn (like SolarBeam) */
    EFF_CRIT_UP,   /* high crit ratio */
    EFF_BADLY_POISON,
    EFF_LEECH_SEED,
    EFF_TRAP,
    EFF_WEATHER_SUN,
    EFF_WEATHER_RAIN,
    EFF_EXPLODE,
    EFF_COUNTER,
} MoveEffect;

/* ── Move data (from ROM) ────────────────────────────────────────── */
typedef struct {
    char         name[13];
    PokemonType  type;
    MoveCategory cat;
    u8           power;
    u8           accuracy; /* 0 = never miss */
    u8           pp;
    MoveEffect   effect;
    u8           effect_chance; /* % chance of secondary effect */
} MoveData;

/* ── Species data (const, in ROM) ────────────────────────────────── */
typedef struct {
    char        name[13];
    PokemonType type1;
    PokemonType type2;
    u8          base_hp;
    u8          base_atk;
    u8          base_def;
    u8          base_spa;
    u8          base_spd;
    u8          base_spe;
    u16         evolves_to;   /* species ID, 0 = none */
    u8          evolve_level; /* 0 = item/trade */
    u8          catch_rate;   /* 3=hard, 45=common, 255=very easy */
    u16         base_exp;
    u8          move1_id;     /* starting moves */
    u8          move2_id;
} SpeciesData;

/* ── In-party / in-battle Pokemon ────────────────────────────────── */
#define MAX_MOVES 4
typedef struct {
    u16   species_id;   /* 1-1025 */
    char  nickname[13];
    u8    level;
    u32   exp;
    s16   hp;
    s16   max_hp;
    s16   atk, def, spa, spd, spe; /* computed stats */
    u8    move_ids[MAX_MOVES];
    u8    move_pp[MAX_MOVES];
    u8    move_max_pp[MAX_MOVES];
    StatusEffect status;
    u8    stat_stages[7]; /* atk,def,spa,spd,spe,acc,eva  (offset +6 = neutral) */
} Pokemon;

#define PARTY_SIZE 6
extern Pokemon party[PARTY_SIZE];
extern int party_count;

/* ── Extern data tables ──────────────────────────────────────────── */
#define NUM_SPECIES 1026  /* index 0 unused */
#define NUM_MOVES   250

extern const SpeciesData species_data[NUM_SPECIES];
extern const MoveData    move_data[NUM_MOVES];

/* ── Stat calculation ────────────────────────────────────────────── */
void calc_stats(Pokemon* p);
u32  exp_for_level(u8 level);
u8   level_from_exp(u32 exp);
void give_exp(Pokemon* p, u32 amount);
void try_evolve(Pokemon* p);
void init_pokemon(Pokemon* p, u16 species_id, u8 level);
