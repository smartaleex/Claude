#!/usr/bin/env python3
"""
skins.py — the look of Alex HQ, defined once, generated into CSS.

    python3 tools/skins.py          writes assets/css/skins.css, prints a contrast report
    python3 tools/skins.py --check  report only; exits non-zero if any text pair is too faint

A skin is a complete set of design tokens: colour (light and dark), type,
shape, borders and elevation. The components in app.css read only tokens,
so a new skin is a new entry here, not new component CSS.

Every colour pair that carries text is checked against WCAG AA (4.5:1) so a
skin cannot ship with grey-on-grey. "faint" is decoration and exempt.
"""
import sys, re, pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'css' / 'skins.css'

# --------------------------------------------------------------------------
#  Colour palettes. `hues` = five ink colours: accent first, then four more.
#  They drive: day colours (d1-d4), equipment badges, macro colours, charts.
# --------------------------------------------------------------------------
SKINS = {

  # ---- PAPER ------------------------------------------------------------
  # A field notebook. Warm paper, black ink, one vermilion. Serif headlines,
  # typewriter labels, hairline rules, almost no rounding, no shadows.
  'paper': dict(
    name='Paper', blurb='Warm paper, black ink, one red. Serif headlines, ruled lines.',
    auto='system',
    light=dict(
      bg='#EEE9DD', bg_sunk='#E0D9C7', surface='#F8F4EA', surface_2='#EAE4D5',
      line='#C9C1AB', line_soft='#DCD5C2',
      ink='#1C1A15', ink_2='#443F37', muted='#665F52', faint='#888270',
      accent='#AC2F10', accent_2='#1C1A15', on_accent='#FBF5E8',
      good='#2A6747', warn='#8F5300', bad='#A3261B',
      hues=['#AC2F10', '#2E4E7E', '#566B2A', '#69395B', '#8F5F08'],
    ),
    dark=dict(
      bg='#15130E', bg_sunk='#0E0C08', surface='#1F1C15', surface_2='#29251C',
      line='#3A352A', line_soft='#2D291F',
      ink='#EFE9DA', ink_2='#CBC4B1', muted='#A39C88', faint='#746F5F',
      accent='#F0714A', accent_2='#EFE9DA', on_accent='#1E0D06',
      good='#6FC499', warn='#E3A63D', bad='#F0786C',
      hues=['#F0714A', '#86A4D6', '#A8BE72', '#CC93BC', '#E3A63D'],
    ),
    shared={
      'f-display': "'Newsreader','Iowan Old Style','Palatino Linotype',Georgia,serif",
      'f-body': "'Public Sans',system-ui,-apple-system,'Segoe UI',sans-serif",
      'f-mono': "'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace",
      'f-num': 'var(--f-display)',
      'w-display': '600', 'ls-display': '-.014em', 'tt-display': 'none', 'st-display': '100%', 'lh-display': '1.06',
      'fs-h1': '36px', 'fs-hero': '58px', 'fs-stat': '30px', 'fs-card': '19px',
      'f-label': 'var(--f-mono)', 'fs-label': '10.5px', 'ls-label': '.14em', 'tt-label': 'uppercase', 'w-label': '500',
      'f-btn': 'var(--f-body)', 'tt-btn': 'none', 'ls-btn': '0', 'w-btn': '600',
      'r-xs': '2px', 'r-sm': '3px', 'r-md': '4px', 'r-lg': '5px', 'r-xl': '6px',
      'r-ctl': '3px', 'r-bar': '1px', 'r-av': '2px', 'r-round': '999px',
      'bd': '1px solid var(--line)', 'bd-soft': '1px solid var(--line-soft)', 'bd-strong': '1px solid var(--ink)',
      'sh-card': 'none', 'sh-pop': '0 14px 34px -16px rgba(28,26,21,.38)', 'sh-inset': 'none', 'sh-press': 'none',
      'clay': '0 0 0 1px var(--line)', 'clay-sm': '0 0 0 1px var(--line)', 'clay-in': 'inset 0 0 0 1px var(--line)',
      'clay-press': 'inset 0 0 0 1px var(--ink)',
      'focus': '0 0 0 2px var(--accent-1)',
      'bar-h': '6px', 'meter-h': '6px',
      'tabbar-h': '56px', 'tb-inset': '0px', 'tb-bottom': '0px', 'tb-r': '0px',
      'tb-wrap-bg': 'var(--surface)', 'tb-wrap-bd': '1px solid var(--ink)', 'tb-in-bg': 'transparent', 'tb-in-bd': 'none', 'tb-sh': 'none',
      'seg-on-bg': 'var(--surface)', 'seg-on-fg': 'var(--ink)', 'seg-on-bd': '1px solid var(--ink)',
      'tab-ind': '2px', 'tab-on-bg': 'transparent', 'tab-on-fg': 'var(--accent-1)', 'tab-on-sh': 'none', 'tab-r': '0px',
      'icon-w': '1.5', 'icon-cap': 'round', 'icon-join': 'round',
      'ease-squish': 'cubic-bezier(.2,.7,.2,1)',
      'wash': 'none',
      'grain': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .1 0 0 0 0 .08 0 0 0 0 .05 0 0 0 .07 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      'hero-bg': 'var(--ink)', 'hero-fg': 'var(--bg)', 'hero-deco': 'none',
      'now-bg': 'var(--accent-1)', 'now-fg': 'var(--on-accent)',
      'calm-bg': 'var(--surface-2)', 'calm-fg': 'var(--ink)',
      'tile-bg': 'var(--ink)', 'tile-fg': 'var(--bg)',
      'sec-rule': '1px solid var(--line)', 'hero-bd': 'none', 'now-bd': 'none',
      'scrim': 'color-mix(in srgb, var(--ink) 48%, transparent)', 'scrim-blur': '0px',
      'grip-w': '34px', 'grip-h': '2px',
      'av-s': '28%', 'av-l': '38%',
    },
  ),

  # ---- INSTRUMENT -------------------------------------------------------
  # A gauge cluster. Near-black, amber, condensed capitals, monospaced
  # readouts, square corners, graph-paper hero. Built for the gym at night.
  'instrument': dict(
    name='Instrument', blurb='Near-black with amber. Condensed caps, mono readouts, square corners.',
    auto='dark',
    light=dict(
      bg='#E5E5DE', bg_sunk='#D6D6CD', surface='#F2F2EC', surface_2='#E1E1D8',
      line='#BDBDB1', line_soft='#D2D2C7',
      ink='#10110E', ink_2='#3A3B34', muted='#5F6056', faint='#7E7F76',
      accent='#9A4600', accent_2='#10110E', on_accent='#FFF7EE',
      good='#1D6633', warn='#8E5200', bad='#B3261B',
      hues=['#9A4600', '#0A64B0', '#2B7A38', '#7436B5', '#B3261B'],
    ),
    dark=dict(
      bg='#0B0C0A', bg_sunk='#070806', surface='#141512', surface_2='#1C1D19',
      line='#2C2E28', line_soft='#21231E',
      ink='#ECEBE3', ink_2='#BEBDB2', muted='#92938A', faint='#696A61',
      accent='#FFB000', accent_2='#ECEBE3', on_accent='#171000',
      good='#7BDB9B', warn='#FF8F3F', bad='#FF6A5E',
      hues=['#FFB000', '#62BDFF', '#8EE093', '#C9A0FF', '#FF6A5E'],
    ),
    shared={
      'f-display': "'Archivo','Arial Narrow','Helvetica Neue',Arial,sans-serif",
      'f-body': "'Archivo',system-ui,-apple-system,'Segoe UI',sans-serif",
      'f-mono': "'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace",
      'f-num': 'var(--f-mono)', 'w-num': '500', 'st-num': '100%', 'ls-num': '-.02em',
      'w-display': '800', 'ls-display': '.004em', 'tt-display': 'uppercase', 'st-display': '76%', 'lh-display': '1',
      'fs-h1': '38px', 'fs-hero': '60px', 'fs-stat': '28px', 'fs-card': '17px',
      'f-label': 'var(--f-mono)', 'fs-label': '10.5px', 'ls-label': '.16em', 'tt-label': 'uppercase', 'w-label': '500',
      'f-btn': 'var(--f-mono)', 'tt-btn': 'uppercase', 'ls-btn': '.08em', 'w-btn': '500',
      'r-xs': '1px', 'r-sm': '2px', 'r-md': '2px', 'r-lg': '3px', 'r-xl': '3px',
      'r-ctl': '2px', 'r-bar': '0px', 'r-av': '2px', 'r-round': '999px',
      'bd': '1px solid var(--line)', 'bd-soft': '1px solid var(--line-soft)', 'bd-strong': '1px solid var(--ink-2)',
      'sh-card': 'none', 'sh-pop': '0 18px 40px -18px rgba(0,0,0,.7)', 'sh-inset': 'none', 'sh-press': 'none',
      'clay': '0 0 0 1px var(--line)', 'clay-sm': '0 0 0 1px var(--line)', 'clay-in': 'inset 0 0 0 1px var(--line)',
      'clay-press': 'inset 0 0 0 1px var(--accent-1)',
      'focus': '0 0 0 1px var(--accent-1), 0 0 0 3px color-mix(in srgb, var(--accent-1) 35%, transparent)',
      'bar-h': '4px', 'meter-h': '4px',
      'tabbar-h': '56px', 'tb-inset': '0px', 'tb-bottom': '0px', 'tb-r': '0px',
      'tb-wrap-bg': 'var(--surface)', 'tb-wrap-bd': '1px solid var(--line)', 'tb-in-bg': 'transparent', 'tb-in-bd': 'none', 'tb-sh': 'none',
      'seg-on-bg': 'var(--surface-2)', 'seg-on-fg': 'var(--accent-1)', 'seg-on-bd': '1px solid var(--accent-1)',
      'tab-ind': '3px', 'tab-on-bg': 'transparent', 'tab-on-fg': 'var(--accent-1)', 'tab-on-sh': 'none', 'tab-r': '0px',
      'icon-w': '1.6', 'icon-cap': 'square', 'icon-join': 'miter',
      'ease-squish': 'cubic-bezier(.2,.7,.2,1)',
      'wash': 'none', 'grain': 'none',
      'hero-bg': 'var(--accent-1)', 'hero-fg': 'var(--on-accent)',
      'hero-deco': 'repeating-linear-gradient(0deg, transparent 0 15px, rgba(0,0,0,.10) 15px 16px), repeating-linear-gradient(90deg, transparent 0 15px, rgba(0,0,0,.10) 15px 16px)',
      'now-bg': 'var(--ink)', 'now-fg': 'var(--bg)',
      'calm-bg': 'var(--surface-2)', 'calm-fg': 'var(--ink)',
      'tile-bg': 'var(--surface-2)', 'tile-fg': 'var(--accent-1)',
      'sec-rule': '1px solid var(--line)', 'hero-bd': 'none', 'now-bd': 'none',
      'scrim': 'color-mix(in srgb, #000 62%, transparent)', 'scrim-blur': '0px',
      'grip-w': '28px', 'grip-h': '3px',
      'av-s': '0%', 'av-l': '30%',
    },
  ),

  # ---- POSTER -----------------------------------------------------------
  # Swiss poster. White, black rules, one cobalt, one signal yellow.
  # Heavy grotesk, enormous numerals, zero rounding, no shadows anywhere.
  'poster': dict(
    name='Poster', blurb='White, black rules, cobalt and signal yellow. Heavy type, no curves.',
    auto='system',
    light=dict(
      bg='#F3F3EF', bg_sunk='#E6E6E0', surface='#FFFFFF', surface_2='#EDEDE7',
      line='#C9C9C0', line_soft='#DEDED6',
      ink='#0D0D0D', ink_2='#383836', muted='#5C5C56', faint='#878780',
      accent='#1B3BD6', accent_2='#FFD400', on_accent='#FFFFFF',
      good='#0A6E3C', warn='#8A5000', bad='#C0190A',
      hues=['#1B3BD6', '#CC2A18', '#0A6E3C', '#0D0D0D', '#8A6A00'],
    ),
    dark=dict(
      bg='#0B0B0C', bg_sunk='#050506', surface='#151517', surface_2='#1E1E21',
      line='#3A3A3F', line_soft='#27272B',
      ink='#F3F3EF', ink_2='#CFCFC9', muted='#9D9D96', faint='#696962',
      accent='#7C93FF', accent_2='#FFD400', on_accent='#0A1030',
      good='#4FD08A', warn='#FFB43D', bad='#FF6B5A',
      hues=['#7C93FF', '#FF6F5E', '#4FD08A', '#F3F3EF', '#FFD400'],
    ),
    shared={
      'f-display': "'Archivo','Helvetica Neue',Helvetica,Arial,sans-serif",
      'f-body': "'Archivo',system-ui,-apple-system,'Segoe UI',sans-serif",
      'f-mono': "'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace",
      'f-num': 'var(--f-display)',
      'w-display': '800', 'ls-display': '-.035em', 'tt-display': 'none', 'st-display': '100%', 'lh-display': '.98',
      'fs-h1': '42px', 'fs-hero': '72px', 'fs-stat': '32px', 'fs-card': '19px',
      'f-label': 'var(--f-mono)', 'fs-label': '10.5px', 'ls-label': '.12em', 'tt-label': 'uppercase', 'w-label': '500',
      'f-btn': 'var(--f-body)', 'tt-btn': 'none', 'ls-btn': '-.005em', 'w-btn': '700',
      'r-xs': '0px', 'r-sm': '0px', 'r-md': '0px', 'r-lg': '0px', 'r-xl': '0px',
      'r-ctl': '0px', 'r-bar': '0px', 'r-av': '0px', 'r-round': '0px',
      'bd': '1.5px solid var(--ink)', 'bd-soft': '1px solid var(--line)', 'bd-strong': '1.5px solid var(--ink)',
      'sh-card': 'none', 'sh-pop': 'none', 'sh-inset': 'none', 'sh-press': 'none',
      'clay': '0 0 0 1.5px var(--ink)', 'clay-sm': '0 0 0 1.5px var(--ink)', 'clay-in': 'inset 0 0 0 1px var(--line)',
      'clay-press': 'inset 0 0 0 2px var(--ink)',
      'focus': '0 0 0 3px var(--accent-2)',
      'bar-h': '10px', 'meter-h': '8px',
      'tabbar-h': '56px', 'tb-inset': '0px', 'tb-bottom': '0px', 'tb-r': '0px',
      'tb-wrap-bg': 'var(--surface)', 'tb-wrap-bd': '1.5px solid var(--ink)', 'tb-in-bg': 'transparent', 'tb-in-bd': 'none', 'tb-sh': 'none',
      'seg-on-bg': 'var(--ink)', 'seg-on-fg': 'var(--bg)', 'seg-on-bd': '1.5px solid var(--ink)',
      'tab-ind': '0px', 'tab-on-bg': 'var(--ink)', 'tab-on-fg': 'var(--bg)', 'tab-on-sh': 'none', 'tab-r': '0px',
      'icon-w': '1.9', 'icon-cap': 'butt', 'icon-join': 'miter',
      'ease-squish': 'cubic-bezier(.2,.7,.2,1)',
      'wash': 'none', 'grain': 'none',
      'hero-bg': 'var(--accent-1)', 'hero-fg': 'var(--on-accent)', 'hero-deco': 'none',
      'now-bg': 'var(--accent-2)', 'now-fg': '#0D0D0D',
      'calm-bg': 'var(--ink)', 'calm-fg': 'var(--bg)',
      'tile-bg': 'var(--ink)', 'tile-fg': 'var(--bg)',
      'sec-rule': '2px solid var(--ink)', 'hero-bd': 'none', 'now-bd': '1.5px solid var(--ink)',
      'scrim': 'color-mix(in srgb, #000 55%, transparent)', 'scrim-blur': '0px',
      'grip-w': '0px', 'grip-h': '0px',
      'av-s': '0%', 'av-l': '12%',
    },
  ),

  # ---- LICHEN -----------------------------------------------------------
  # Calm and warm. Sage ground, deep moss, a little terracotta. Soft serif
  # headlines, rounded but flat, pebble shapes. For the heavy days.
  'lichen': dict(
    name='Lichen', blurb='Sage and moss with a touch of terracotta. Soft serif, rounded, calm.',
    auto='system',
    light=dict(
      bg='#E6EBDF', bg_sunk='#D6DDCB', surface='#F5F8F0', surface_2='#E0E7D6',
      line='#BFC9B2', line_soft='#D2DAC6',
      ink='#19231C', ink_2='#3B493F', muted='#586659', faint='#788579',
      accent='#2F5E46', accent_2='#A9532E', on_accent='#F3F8EE',
      good='#27704A', warn='#865406', bad='#A8312A', now_fg='#FFF8F2',
      hues=['#2F5E46', '#A9532E', '#356B8A', '#76527F', '#8E6B12'],
    ),
    dark=dict(
      bg='#101612', bg_sunk='#0B100D', surface='#18201A', surface_2='#212B23',
      line='#344036', line_soft='#27322A',
      ink='#E7EEE3', ink_2='#C3CEBF', muted='#95A495', faint='#677569',
      accent='#8DC6A3', accent_2='#E58A62', on_accent='#0B1A10',
      good='#7BD1A0', warn='#E3AE45', bad='#F28074', now_fg='#1B0E07',
      hues=['#8DC6A3', '#E58A62', '#83B6D4', '#BE97CB', '#DDB650'],
    ),
    shared={
      'f-display': "'Young Serif','Iowan Old Style',Georgia,serif",
      'f-body': "'Karla',system-ui,-apple-system,'Segoe UI',sans-serif",
      'f-mono': "'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace",
      'f-num': 'var(--f-body)', 'w-num': '700', 'ls-num': '-.02em',
      'w-display': '400', 'ls-display': '-.005em', 'tt-display': 'none', 'st-display': '100%', 'lh-display': '1.1',
      'fs-h1': '34px', 'fs-hero': '54px', 'fs-stat': '28px', 'fs-card': '18px',
      'f-label': 'var(--f-body)', 'fs-label': '11.5px', 'ls-label': '.1em', 'tt-label': 'uppercase', 'w-label': '700',
      'f-btn': 'var(--f-body)', 'tt-btn': 'none', 'ls-btn': '0', 'w-btn': '700',
      'r-xs': '9px', 'r-sm': '12px', 'r-md': '16px', 'r-lg': '20px', 'r-xl': '26px',
      'r-ctl': '14px', 'r-bar': '999px', 'r-av': '50%', 'r-round': '999px',
      'bd': '1px solid var(--line)', 'bd-soft': '1px solid var(--line-soft)', 'bd-strong': '1px solid var(--line)',
      'sh-card': 'none', 'sh-pop': '0 16px 34px -18px rgba(25,35,28,.42)', 'sh-inset': 'none', 'sh-press': 'none',
      'clay': '0 0 0 1px var(--line)', 'clay-sm': '0 0 0 1px var(--line)', 'clay-in': 'inset 0 0 0 1px var(--line)',
      'clay-press': 'inset 0 0 0 1px var(--accent-1)',
      'focus': '0 0 0 2px var(--accent-1)',
      'bar-h': '9px', 'meter-h': '9px',
      'tabbar-h': '62px', 'tb-inset': '14px', 'tb-bottom': '12px', 'tb-r': '22px',
      'tb-wrap-bg': 'transparent', 'tb-wrap-bd': 'none', 'tb-in-bg': 'var(--surface)', 'tb-in-bd': '1px solid var(--line)', 'tb-sh': 'var(--sh-pop)',
      'seg-on-bg': 'var(--surface)', 'seg-on-fg': 'var(--ink)', 'seg-on-bd': '1px solid var(--line)',
      'tab-ind': '0px', 'tab-on-bg': 'var(--accent-tint)', 'tab-on-fg': 'var(--accent-1)', 'tab-on-sh': 'none', 'tab-r': '16px',
      'icon-w': '1.7', 'icon-cap': 'round', 'icon-join': 'round',
      'ease-squish': 'cubic-bezier(.22,.8,.3,1)',
      'wash': 'none', 'grain': 'none',
      'hero-bg': 'var(--accent-1)', 'hero-fg': 'var(--on-accent)', 'hero-deco': 'none',
      'now-bg': 'var(--accent-2)',
      'calm-bg': 'var(--surface-2)', 'calm-fg': 'var(--ink)',
      'tile-bg': 'var(--accent-1)', 'tile-fg': 'var(--on-accent)',
      'sec-rule': 'none', 'hero-bd': 'none', 'now-bd': 'none',
      'scrim': 'color-mix(in srgb, var(--ink) 40%, transparent)', 'scrim-blur': '3px',
      'grip-w': '40px', 'grip-h': '4px',
      'av-s': '30%', 'av-l': '40%',
    },
  ),
}

DEFAULT = 'paper'

# --------------------------------------------------------------------------
#  Contrast
# --------------------------------------------------------------------------
def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def lum(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= .03928 else ((v + .055) / 1.055) ** 2.4
    r, g, b = (f(x) for x in c)
    return .2126 * r + .7152 * g + .0722 * b

def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + .05) / (lo + .05)

def mix(a, b, pct):          # pct of a over b
    return tuple(round(a[i] * pct + b[i] * (1 - pct)) for i in range(3))

def resolve(skin, mode):
    """The concrete colours a skin resolves to, for the checks."""
    p = skin[mode]
    c = {k: rgb(v) for k, v in p.items() if isinstance(v, str) and v.startswith('#')}
    return c

def checks(key, skin):
    bad = []
    for mode in ('light', 'dark'):
        c = resolve(skin, mode)
        sh = skin['shared']
        def pair(label, fg, bg, need=4.5):
            r = ratio(fg, bg)
            if r < need: bad.append(f'{key}/{mode}: {label} {r:.2f} < {need}')
            return r
        pair('faint on surface (secondary numerals)', c['faint'], c['surface'], 3.0)
        pair('faint on bg', c['faint'], c['bg'], 3.0)
        pair('faint on surface-2', c['faint'], c['surface_2'], 3.0)
        pair('ink on bg', c['ink'], c['bg'])
        pair('ink on surface', c['ink'], c['surface'])
        pair('ink-2 on surface', c['ink_2'], c['surface'])
        pair('muted on surface', c['muted'], c['surface'])
        pair('muted on bg', c['muted'], c['bg'])
        pair('muted on surface-2', c['muted'], c['surface_2'])
        pair('accent on surface (text)', c['accent'], c['surface'])
        pair('accent on bg (text)', c['accent'], c['bg'])
        pair('on-accent on accent', c['on_accent'], c['accent'])
        for t in ('good', 'warn', 'bad'):
            pair(f'{t} on surface', c[t], c['surface'])
            pair(f'{t} on its tint', c[t], mix(c[t], c['surface'], .14))
        # tinted accent chip: accent text on accent-tint
        pair('accent on accent-tint', c['accent'], mix(c['accent'], c['surface'], .14))
        # hero / now / tile pairs depend on how the skin points them
        def tok(name):
            if name == 'now-fg' and 'now_fg' in skin[mode]: return rgb(skin[mode]['now_fg'])
            v = sh[name]
            m = re.fullmatch(r'var\(--([a-z0-9-]+)\)', v)
            if m:
                k = m.group(1).replace('-', '_')
                k = {'accent_1': 'accent'}.get(k, k)
                if k in c: return c[k]
            if v.startswith('#'): return rgb(v)
            raise KeyError(v)
        for fg, bgk in (('hero-fg', 'hero-bg'), ('now-fg', 'now-bg'), ('calm-fg', 'calm-bg'), ('tile-fg', 'tile-bg')):
            pair(f'{fg} on {bgk}', tok(fg), tok(bgk), 3.0 if fg == 'tile-fg' else 4.5)
        # data hues are used as text on the surface in badges and day labels
        for i, h in enumerate(c_hues(skin, mode)):
            pair(f'hue{i} on surface', h, c['surface'], 3.0)
    return bad

def c_hues(skin, mode):
    return [rgb(h) for h in skin[mode]['hues']]

# --------------------------------------------------------------------------
#  CSS generation
# --------------------------------------------------------------------------
def colour_block(skin, mode):
    p = skin[mode]
    out = []
    names = ['bg', 'bg-sunk', 'surface', 'surface-2', 'line', 'line-soft', 'ink', 'ink-2', 'muted', 'faint',
             'accent-1', 'accent-2', 'on-accent', 'good', 'warn', 'bad']
    src = {'accent-1': 'accent', 'accent-2': 'accent_2'}
    for n in names:
        k = src.get(n, n.replace('-', '_'))
        out.append(f'--{n}:{p[k]};')
    if 'now_fg' in p: out.append(f"--now-fg:{p['now_fg']};")
    h = p['hues']
    for i, v in enumerate(h[:4]): out.append(f'--d{i+1}:{v};')
    out.append(f'--g-barbell:{h[0]}; --g-machine:{h[1]}; --g-cable:{h[2]}; --g-dumbbell:{h[3]}; --g-body:{h[4]};')
    out.append(f'--pro:{h[0]}; --carb:{h[1]}; --fat:{h[4]};')
    out.append(f'--hue-0:{h[0]}; --hue-1:{h[1]}; --hue-2:{h[2]}; --hue-3:{h[3]}; --hue-4:{h[4]};')
    out.append(f'color-scheme:{mode};')
    return '\n  '.join(out)

DERIVED = """
  --accent-tint: color-mix(in srgb, var(--accent-1) 14%, var(--surface));
  --good-tint: color-mix(in srgb, var(--good) 14%, var(--surface));
  --warn-tint: color-mix(in srgb, var(--warn) 14%, var(--surface));
  --bad-tint:  color-mix(in srgb, var(--bad) 14%, var(--surface));
  --pro-tint:  color-mix(in srgb, var(--pro) 14%, var(--surface));
  --carb-tint: color-mix(in srgb, var(--carb) 14%, var(--surface));
  --fat-tint:  color-mix(in srgb, var(--fat) 14%, var(--surface));
  --pro-bar:   color-mix(in srgb, var(--pro) 38%, var(--surface));
  --carb-bar:  color-mix(in srgb, var(--carb) 38%, var(--surface));
  --fat-bar:   color-mix(in srgb, var(--fat) 38%, var(--surface));
  --brand-tint: var(--accent-tint);
  --accent-grad: var(--accent-1);
  --brand-grad: var(--accent-1);
  --brand-1: var(--accent-1);
  --clay-tint: none;
  --clay-tint-lg: none;
"""

def shared_block(skin):
    return '\n  '.join(f'--{k}:{v};' for k, v in skin['shared'].items())

def emit():
    css = ['/* GENERATED by tools/skins.py. Do not edit by hand; change the script and rerun. */', '']
    css.append('/* Base tokens: the things no skin changes. */')
    css.append(""":root{
  --ease: cubic-bezier(.32,.72,.28,1);
  --ease-out: cubic-bezier(.16,1,.3,1);
  --fast:.16s; --base:.26s; --slow:.42s;
  --sat: env(safe-area-inset-top, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --shell-w: 620px;
}
""")
    for key, skin in SKINS.items():
        # Any element, not just :root, so the settings screen can render a
        # live preview of a skin inside another one.
        sel_light = f'[data-skin="{key}"]'
        sel_dark = f'[data-skin="{key}"][data-theme="dark"]'
        sel_auto = f'[data-skin="{key}"][data-theme="auto"]'
        if key == DEFAULT:
            sel_light += ', :root:not([data-skin])'
            sel_dark += ', :root:not([data-skin])[data-theme="dark"]'
            sel_auto += ', :root:not([data-skin])[data-theme="auto"]'
        css.append(f'/* ---- {skin["name"]}: {skin["blurb"]} */')
        css.append(f'{sel_light}{{\n  {shared_block(skin)}\n  {colour_block(skin, "light")}\n{DERIVED}}}')
        if skin['auto'] == 'dark':
            css.append(f'{sel_dark}, {sel_auto}{{\n  {colour_block(skin, "dark")}\n}}')
        else:
            css.append(f'{sel_dark}{{\n  {colour_block(skin, "dark")}\n}}')
            css.append(f'@media (prefers-color-scheme: dark){{\n{sel_auto}{{\n  {colour_block(skin, "dark")}\n}}\n}}')
        css.append('')
    OUT.write_text('\n'.join(css))

def manifest():
    """The small table the settings screen needs: name, blurb, swatches per mode."""
    rows = []
    for key, s in SKINS.items():
        rows.append((key, s['name'], s['blurb'], s['auto']))
    return rows

if __name__ == '__main__':
    problems = []
    for k, s in SKINS.items():
        problems += checks(k, s)
    if '--check' not in sys.argv:
        emit()
        print(f'wrote {OUT.relative_to(OUT.parent.parent.parent)} ({OUT.stat().st_size} bytes, {len(SKINS)} skins)')
    if problems:
        print(f'{len(problems)} contrast problem(s):')
        for p in problems: print('  ', p)
        sys.exit(1)
    print('contrast: every text pair passes')
