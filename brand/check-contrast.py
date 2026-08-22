#!/usr/bin/env python3
"""Verify every foreground/background pair in the palette meets WCAG.

A design system whose contrast fails is worse than no system — it makes the
failure consistent. This runs in CI so the palette cannot regress.

    python3 check-contrast.py          # exits 1 on any AA failure
"""
from __future__ import annotations
import sys

LIGHT = {
    "ground": "#F7F5F1", "panel": "#FFFFFF", "panel-2": "#EFEBE4",
    "ink": "#101619", "ink-soft": "#414B51", "muted": "#5F696F",
    "rule": "#DCD6CC", "sea": "#1B6CA8", "sand": "#A8761F",
}
DARK = {
    "ground": "#0D1215", "panel": "#141B1F", "panel-2": "#1B2429",
    "ink": "#EDEFEF", "ink-soft": "#AEB8BD", "muted": "#7F8B91",
    "rule": "#232E34", "sea": "#5AA6DC", "sand": "#E7B75A",
}

# (foreground, background, minimum ratio, what it is)
PAIRS = [
    ("ink", "ground", 4.5, "body text"),
    ("ink", "panel", 4.5, "text on cards"),
    ("ink", "panel-2", 4.5, "text on tinted panels"),
    ("ink-soft", "ground", 4.5, "secondary text"),
    ("ink-soft", "panel", 4.5, "secondary on cards"),
    ("muted", "ground", 4.5, "labels and captions"),
    ("sea", "ground", 4.5, "links"),
    ("sea", "panel", 4.5, "links on cards"),
    ("ground", "ink", 4.5, "inverted — dark CTA blocks"),
    ("sand", "ground", 3.0, "accent marks (non-text use)"),
    ("rule", "ground", 1.2, "hairline rules must be visible"),
]

def srgb_to_lin(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def luminance(hexcolor: str) -> float:
    h = hexcolor.lstrip("#")
    r, g, b = (int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
    return 0.2126*srgb_to_lin(r) + 0.7152*srgb_to_lin(g) + 0.0722*srgb_to_lin(b)

def ratio(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

def run(name: str, pal: dict) -> int:
    print(f"\n  {name}")
    print(f"  {'pair':<26}{'ratio':>8}  {'min':>5}   verdict")
    print("  " + "-" * 58)
    fails = 0
    for fg, bg, need, what in PAIRS:
        r = ratio(pal[fg], pal[bg])
        ok = r >= need
        if not ok:
            fails += 1
        mark = "PASS" if ok else "FAIL"
        print(f"  {fg + ' on ' + bg:<26}{r:>7.2f}:1{need:>6.1f}   {mark}  {what}")
    return fails

if __name__ == "__main__":
    total = run("LIGHT", LIGHT) + run("DARK", DARK)
    print()
    if total:
        print(f"  {total} contrast failure(s). Fix the palette before shipping.\n")
        sys.exit(1)
    print("  All pairs meet their WCAG target.\n")
