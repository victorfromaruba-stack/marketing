#!/usr/bin/env python3
"""Verify every foreground/background pair in the palette meets WCAG.

A design system whose contrast fails is worse than no system — it makes the
failure consistent across every project. This runs in CI so the palette cannot
regress, and it has already earned its place twice: it caught two failing
colours in the first palette, and it caught a bad pairing when the logo
colours were adopted.

    python3 check-contrast.py          # exits 1 on any failure

Palette source of truth: brand/tokens.css. Keep these in step.
"""

from __future__ import annotations

import sys

# Derived from the logo: navy #0B2F48, amber #FABA5E, cream #F3EFE3.
# The neutral ramp is the navy mixed toward the cream, so every grey in the
# system carries a trace of the brand rather than being an imported neutral.
LIGHT = {
    "ground":     "#F3EFE3",   # logo cream
    "panel":      "#FBF9F3",
    "panel-2":    "#E9E4D6",
    "ink":        "#0B2F48",   # logo navy
    "ink-soft":   "#3E596A",
    "muted":      "#506876",
    "rule":       "#D7D2C4",
    "sea":        "#1B6CA8",   # links
    "amber":      "#FABA5E",   # logo amber — DECORATIVE ONLY, see below
    "amber-deep": "#896633",   # the text-safe amber
}

# Dark mode grounds in the navy rather than a neutral black, so the brand
# survives the theme switch. Amber needs no darkened variant here — it has
# plenty of contrast against a dark ground.
DARK = {
    "ground":     "#08222F",
    "panel":      "#0E2C3C",
    "panel-2":    "#143546",
    "ink":        "#EAF0F3",
    "ink-soft":   "#A9BCC7",
    "muted":      "#7C93A1",
    "rule":       "#1D4257",
    "sea":        "#6DB4E5",
    "amber":      "#FABA5E",
    "amber-deep": "#FABA5E",
}

# (foreground, background, minimum ratio, what it is)
#
# `dark_surface` is a placeholder resolved per theme: it is `ink` in the light
# palette (amber on navy type) and `ground` in the dark palette. Naming a
# literal token here was a real bug — in dark mode it asked whether amber
# reads on near-white, which is not a pairing this system ever produces.
COMMON_PAIRS = [
    ("ink",         "ground",        4.5, "body text"),
    ("ink",         "panel",         4.5, "text on cards"),
    ("ink",         "panel-2",       4.5, "text on tinted panels"),
    ("ink-soft",    "ground",        4.5, "secondary text"),
    ("muted",       "ground",        4.5, "labels and captions"),
    ("sea",         "ground",        4.5, "links"),
    ("sea",         "panel",         4.5, "links on cards"),
    ("ground",      "ink",           4.5, "inverted blocks"),
    ("amber",       "dark_surface",  4.5, "amber on navy — the logo pairing"),
    ("amber-deep",  "ground",        4.5, "amber where it must carry text"),
    ("rule",        "ground",        1.2, "hairlines must be visible"),
]

# --amber (#FABA5E) is 1.49:1 on cream. It is the logo colour and it is
# DECORATIVE ONLY: the ring, large graphic shapes, marks on navy. It is
# deliberately absent from the light-mode text pairs. Anything that must carry
# text takes --amber-deep. This is the most important constraint in the
# palette, because the logo colour is the one everybody reaches for first.
WATCH_DECORATIVE = [("amber", "ground", "logo amber on cream")]


def srgb_to_lin(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hexcolor: str) -> float:
    h = hexcolor.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * srgb_to_lin(r) + 0.7152 * srgb_to_lin(g) + 0.0722 * srgb_to_lin(b)


def ratio(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def resolve(token: str, palette: dict, theme: str) -> str:
    if token == "dark_surface":
        return palette["ink"] if theme == "LIGHT" else palette["ground"]
    return palette[token]


def run(theme: str, pal: dict) -> int:
    print(f"\n  {theme}")
    print(f"  {'pair':<30}{'ratio':>8}  {'min':>5}   verdict")
    print("  " + "-" * 64)
    fails = 0
    for fg, bg, need, what in COMMON_PAIRS:
        r = ratio(resolve(fg, pal, theme), resolve(bg, pal, theme))
        ok = r >= need
        fails += 0 if ok else 1
        print(f"  {fg + ' on ' + bg:<30}{r:>7.2f}:1{need:>6.1f}   "
              f"{'PASS' if ok else 'FAIL'}  {what}")

    # Flag if the decorative colour ever stops being decorative. Someone
    # "fixing" amber to pass as text has changed the logo colour — that should
    # be a deliberate branding decision, not a quiet commit.
    if theme == "LIGHT":
        for fg, bg, what in WATCH_DECORATIVE:
            r = ratio(pal[fg], pal[bg])
            if r >= 4.5:
                print(f"  {'NOTE ' + fg + ' now passes as text':<30}{r:>7.2f}:1"
                      f"{'':>6}   CHECK  {what} — was the logo changed?")
    return fails


if __name__ == "__main__":
    total = run("LIGHT", LIGHT) + run("DARK", DARK)
    print()
    if total:
        print(f"  {total} contrast failure(s). Fix the palette before shipping.\n")
        sys.exit(1)
    print("  All pairs meet their WCAG target.")
    print("  --amber stays decorative-only by design (1.49:1 on cream).\n")
