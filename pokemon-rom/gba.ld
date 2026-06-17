OUTPUT_FORMAT("elf32-littlearm")
OUTPUT_ARCH(arm)

MEMORY {
    ROM   (rx)  : ORIGIN = 0x08000000, LENGTH = 32M
    EWRAM (rwx) : ORIGIN = 0x02000000, LENGTH = 256K
    IWRAM (rwx) : ORIGIN = 0x03000000, LENGTH = 32K
}

ENTRY(_start)

SECTIONS {
    .crt0 0x08000000 : {
        KEEP(*(.crt0))
    } > ROM

    .text : {
        *(.text*)
        *(.rodata*)
        . = ALIGN(4);
    } > ROM

    _lma_data_start = LOADADDR(.data);
    .data : {
        _data_start = .;
        *(.data*)
        . = ALIGN(4);
        _data_end = .;
    } > IWRAM AT > ROM

    .bss (NOLOAD) : {
        _bss_start = .;
        *(.bss*)
        *(COMMON)
        . = ALIGN(4);
        _bss_end = .;
    } > IWRAM

    /* Stack areas (top of IWRAM) */
    . = 0x03007F00;
    _irq_stack = 0x03007FA0;
    _sys_stack = 0x03008000;
}
