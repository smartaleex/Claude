@ GBA startup file
    .section .crt0, "ax", %progbits
    .arm
    .global _start
    .global rng_state

_start:
    b       _gba_boot           @ 4 bytes: branch over header

    @ Nintendo logo data (required on real HW; emulators don't check)
    .fill   156, 1, 0

    @ Game title (12 bytes, padded with 0)
    .ascii  "POKEMONALLST"

    @ Game code (4 bytes)
    .ascii  "BPAS"

    @ Maker code (2 bytes)
    .ascii  "01"

    @ Fixed value
    .byte   0x96

    @ Main unit code
    .byte   0x00

    @ Device type
    .byte   0x00

    @ Reserved (7 bytes)
    .fill   7, 1, 0

    @ Software version
    .byte   0x00

    @ Complement check (patched by fix_header.py)
    .byte   0x00

    @ Reserved (2 bytes)
    .fill   2, 1, 0

    @ ─── Startup code at 0x080000C0 ─────────────────────────────
_gba_boot:
    @ Switch to IRQ mode, set IRQ stack pointer
    @ 0xD2 = 1101 0010 (IRQ mode | I-bit | F-bit)
    mov     r0, #0xD2
    msr     cpsr, r0
    ldr     sp, =_irq_stack

    @ Switch to System mode (0xDF = 1101 1111)
    mov     r0, #0xDF
    msr     cpsr, r0
    ldr     sp, =_sys_stack

    @ Init RNG seed with a constant (game overwrites this)
    ldr     r0, =rng_state
    ldr     r1, =0xDEADBEEF
    str     r1, [r0]

    @ Copy .data from ROM to EWRAM/IWRAM
    ldr     r0, =_lma_data_start
    ldr     r1, =_data_start
    ldr     r2, =_data_end
.Lcopy_data:
    cmp     r1, r2
    ldrlt   r3, [r0], #4
    strlt   r3, [r1], #4
    blt     .Lcopy_data

    @ Zero .bss
    ldr     r1, =_bss_start
    ldr     r2, =_bss_end
    mov     r0, #0
.Lclear_bss:
    cmp     r1, r2
    strlt   r0, [r1], #4
    blt     .Lclear_bss

    @ Call main
    bl      main

.Lhalt:
    b       .Lhalt
