#include "game.h"

/* GBA SRAM: 32KB at 0x0E000000 — 8-bit access ONLY */
#define SRAM ((volatile u8*)0x0E000000)
#define SAVE_MAGIC 0x504B4D4E  /* "PKMN" */

typedef struct {
    u32    magic;
    u32    checksum;
    int    party_count;
    int    player_x, player_y;
    int    pokeballs;
    u32    rng_state_save;
    u8     _pad[4];
    /* Party follows: up to PARTY_SIZE Pokemon */
    /* We serialize manually due to struct alignment issues with SRAM */
} SaveHeader;

/* ── 8-bit SRAM helpers ──────────────────────────────────────────── */

static void sram_write(u32 offset, const void* src, u32 len) {
    volatile u8* dst = SRAM + offset;
    const u8* s = (const u8*)src;
    for (u32 i = 0; i < len; i++) dst[i] = s[i];
}

static void sram_read(void* dst, u32 offset, u32 len) {
    const volatile u8* src = SRAM + offset;
    u8* d = (u8*)dst;
    for (u32 i = 0; i < len; i++) d[i] = src[i];
}

static u32 calc_checksum(void) {
    u32 sum = 0;
    for (int i = 0; i < party_count; i++) {
        const u8* p = (const u8*)&party[i];
        for (u32 j = 0; j < sizeof(Pokemon); j++) sum += p[j];
    }
    return sum ^ 0xDEADBEEF;
}

/* ── Global player state for save ───────────────────────────────── */
int player_pokeballs = 10;
extern int player_x_save, player_y_save;  /* written by overworld */

int player_x_save = 8;
int player_y_save = 10;

/* ── Public interface ────────────────────────────────────────────── */

void save_game(void) {
    SaveHeader hdr;
    hdr.magic          = SAVE_MAGIC;
    hdr.party_count    = party_count;
    hdr.player_x       = player_x_save;
    hdr.player_y       = player_y_save;
    hdr.pokeballs      = player_pokeballs;
    hdr.rng_state_save = rng_state;
    hdr.checksum       = calc_checksum();

    u32 off = 0;
    sram_write(off, &hdr, sizeof(hdr));
    off += sizeof(hdr);

    for (int i = 0; i < party_count; i++) {
        sram_write(off, &party[i], sizeof(Pokemon));
        off += sizeof(Pokemon);
    }
}

int load_game(void) {
    SaveHeader hdr;
    sram_read(&hdr, 0, sizeof(hdr));

    if (hdr.magic != SAVE_MAGIC) return 0;  /* no valid save */
    if (hdr.party_count < 0 || hdr.party_count > PARTY_SIZE) return 0;

    party_count    = hdr.party_count;
    player_x_save  = hdr.player_x;
    player_y_save  = hdr.player_y;
    player_pokeballs = hdr.pokeballs;
    rng_state      = hdr.rng_state_save;

    u32 off = sizeof(hdr);
    for (int i = 0; i < party_count; i++) {
        sram_read(&party[i], off, sizeof(Pokemon));
        off += sizeof(Pokemon);
    }

    /* Validate checksum */
    if (calc_checksum() != hdr.checksum) {
        party_count = 0;
        return 0;
    }
    return 1;
}
