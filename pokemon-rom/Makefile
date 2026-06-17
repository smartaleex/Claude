TARGET  = pokemon_all_stars
# Generate pokemon_data.c first so wildcard can find it
POKEMON_DATA = src/pokemon_data.c
SOURCES_C = $(filter-out $(POKEMON_DATA), $(wildcard src/*.c)) $(POKEMON_DATA)
SOURCES   = crt0.s $(SOURCES_C)

PREFIX  = arm-none-eabi-
CC      = $(PREFIX)gcc
OBJCOPY = $(PREFIX)objcopy

ARCH    = -mcpu=arm7tdmi -mthumb-interwork
CFLAGS  = $(ARCH) -O2 -Wall -Wno-unused-function \
          -fno-strict-aliasing -ffunction-sections -fdata-sections \
          -Iinclude -nostdlib
LDFLAGS = -T gba.ld -Wl,--gc-sections -nostartfiles -lgcc

OBJECTS = $(patsubst %.s,%.o,$(patsubst %.c,%.o,$(SOURCES_C))) crt0.o

all: $(POKEMON_DATA) $(TARGET).gba

$(TARGET).gba: $(TARGET).elf
	$(OBJCOPY) -O binary $< $@
	python3 fix_header.py $@
	@echo ""
	@echo "  ╔═══════════════════════════════════════╗"
	@echo "  ║  Pokemon All Stars ROM built!         ║"
	@echo "  ║  Load $(TARGET).gba in Delta    ║"
	@echo "  ╚═══════════════════════════════════════╝"
	@echo ""

$(TARGET).elf: $(POKEMON_DATA) $(OBJECTS)
	$(CC) $(ARCH) $(LDFLAGS) $(OBJECTS) -o $@

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

%.o: %.s
	$(CC) $(ARCH) -c $< -o $@

clean:
	rm -f $(OBJECTS) crt0.o $(TARGET).elf $(TARGET).gba

.PHONY: all clean
