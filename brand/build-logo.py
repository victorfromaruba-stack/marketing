#!/usr/bin/env python3
"""Build the vector logo assets: the lockups and the SVG favicon.

    python3 brand/build-logo.py

WHY THIS SCRIPT EXISTS

The lockups that arrived in the brand kit set their type with an SVG <text>
element in "Iowan Old Style". Two things are wrong with that. Iowan ships with
macOS and nowhere else, so on Windows and Android the logo silently falls back
to Georgia and the letterfit changes — a logo that reflows per device is not a
logo. And an SVG loaded through <img> is sandboxed against external resources,
so naming the right family would not have saved it either: the webfont would
never load.

The fix is to embed the font in the file as a data URI. A data URI is inline,
not external, so the sandbox permits it and the lockup renders identically
everywhere with nothing to fetch.

The obvious alternative — converting the type to outlines — was tried first and
abandoned. opentype.js does not apply this variable font's deltas correctly:
its capital A came out as the crossbar alone, no diagonals, and it was wrong in
a way that only showed up on render. The browser's own font engine gets it
right, so the browser is what draws it.

Embedding also buys the right optical size. Bodoni Moda is a variable font with
an `opsz` axis, and this asks for 96 — the display cut, with the fine hairlines
and high contrast that a Bodoni is for and that the text cut deliberately
tones down.

The mark is lifted verbatim out of logo-mark.svg so the lockup and the
standalone mark cannot drift apart.
"""
import base64
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
LOGO = HERE / "logo"
FONT = LOGO / "BodoniModa.ttf"

NAVY, AMBER, CREAM, SEA = "#0A2F4E", "#FFC06B", "#FFFDF9", "#1C7FA8"

SIZE = 84          # cap size of the two name lines
STRAP_SIZE = 21
TRACK = 3.4        # set by eye at display size; Bodoni caps need air
STRAP_TRACK = 7.4
MARK_BOX = 240     # the mark files are drawn on a 240 grid
MARK_SIZE = 200
PAD = 14
GAP = 46           # mark to type
BASE1, BASE2 = 108, 194
STRAP_BASE = 260

if not FONT.exists():
    sys.exit(
        f"Missing {FONT}\n\n"
        "Fetch the Bodoni Moda variable font once. The URL is versioned, so read\n"
        "it out of the stylesheet rather than hardcoding it:\n\n"
        '  curl -s "https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400" \\\n'
        "    | grep -o 'https://[^)]*\\.ttf' | head -1 | xargs curl -s -o " + str(FONT) + "\n"
    )

FONT_URI = "data:font/ttf;base64," + base64.b64encode(FONT.read_bytes()).decode()


def mark_group(name: str) -> str:
    """Pull the <g> straight out of a mark file.

    Re-tracing the tree here would make two sources of truth for one shape.
    """
    src = (LOGO / name).read_text()
    m = re.search(r"<g transform=[^>]*>.*</g>", src, re.S)
    if not m:
        raise SystemExit(f"no <g> found in {name}")
    return m.group(0)


def build(mark_file, top, bottom, strap=None, strap_color=SEA, width=900):
    """Emit one lockup. `width` is provisional; measure() tightens it."""
    text_x = PAD + MARK_SIZE + GAP
    height = STRAP_BASE + 24 if strap else MARK_BOX
    mark_y = round((MARK_BOX - MARK_SIZE) / 2)
    scale = round(MARK_SIZE / MARK_BOX, 5)

    strap_el = ""
    if strap:
        strap_el = (
            f'\n<text class="strap" x="{text_x + 2}" y="{STRAP_BASE}" '
            f'fill="{strap_color}">{strap}</text>'
        )

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" role="img" aria-label="Aruba Web Studio">
<title>Aruba Web Studio</title>
<defs><style>
@font-face{{font-family:"BodoniModaLockup";src:url({FONT_URI}) format("truetype");font-weight:400 700;}}
.wm{{font-family:"BodoniModaLockup",Georgia,"Times New Roman",serif;font-size:{SIZE}px;letter-spacing:{TRACK}px;font-variation-settings:"opsz" 96,"wght" 500;}}
.strap{{font-family:"BodoniModaLockup",Georgia,"Times New Roman",serif;font-size:{STRAP_SIZE}px;letter-spacing:{STRAP_TRACK}px;font-variation-settings:"opsz" 96,"wght" 400;}}
</style></defs>
<g transform="translate({PAD},{mark_y}) scale({scale})">{mark_group(mark_file)}</g>
<text class="wm" x="{text_x}" y="{BASE1}" fill="{top}">ARUBA</text>
<text class="wm" x="{text_x}" y="{BASE2}" fill="{bottom}">WEB STUDIO</text>{strap_el}
</svg>
'''


def measure(svgs: dict) -> dict:
    """Ask a real browser how wide the type actually set, and tighten the box.

    Text width depends on the font engine, so it cannot be computed here. A
    provisional viewBox goes in, the rendered bounding box comes back, and the
    viewBox is rewritten to fit. Without this the lockup carries dead space on
    its right edge, which shows up the moment anyone centres it.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright not available — leaving the provisional viewBox alone")
        return svgs

    # The bundled Playwright revision does not match this image, so the binary
    # is named explicitly. Same as system/plan/build.py.
    CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

    out = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME)
        page = browser.new_page()
        for name, svg in svgs.items():
            page.set_content(svg)
            page.wait_for_timeout(250)
            box = page.evaluate(
                """() => {
                    const els = [...document.querySelectorAll('text')];
                    let right = 0;
                    for (const el of els) {
                        const b = el.getBBox();
                        right = Math.max(right, b.x + b.width);
                    }
                    return right;
                }"""
            )
            new_w = int(round(box + PAD))
            out[name] = re.sub(
                r'viewBox="0 0 \d+ (\d+)" width="\d+"',
                lambda m: f'viewBox="0 0 {new_w} {m.group(1)}" width="{new_w}"',
                svg,
                count=1,
            )
            print(f"  {name}: type ends at {box:.1f}, width -> {new_w}")
        browser.close()
    return out


def small_mark(fill: str, ground: str | None) -> str:
    """The mark at sizes where the ring stops working.

    At tab and nav sizes the ring closes up into a solid hoop and the canopy
    layers inside it collapse into noise — magnify a 16px render of the full
    mark and there is nothing legible left. So the small mark drops the ring
    and fills the frame with the tree alone.

    `ground` set gives the favicon: a navy tile, because a favicon lands on
    browser chrome of unknown colour and needs to bring its own. `ground` of
    None gives the transparent version the site's own header uses, where the
    navy is already behind it and a tile would show as a patch.
    """
    src = (LOGO / "logo-mark.svg").read_text()
    # Path 0 is the ring, path 1 is the tree. Only the tree survives.
    tree = re.findall(r'<path[^>]*d="([^"]*)"', src)[1]

    # Measured off the tree path in the mark's own coordinate space.
    cx, cy = 532.0, 511.5
    scale = round(206 / 548, 5)

    tile = f'<rect width="240" height="240" rx="40" fill="{ground}"/>\n' if ground else ""

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" role="img" aria-label="Aruba Web Studio">
<title>Aruba Web Studio</title>
{tile}<g transform="translate(120,120) scale({scale}) translate({-cx},{-cy})">
<path d="{tree}" fill="{fill}" fill-rule="evenodd"/>
</g>
</svg>
'''


def main():
    # A browser given an SVG favicon uses it at every size, so favicon.svg has
    # to be the small design rather than the full mark scaled down.
    small = {
        "favicon.svg":              small_mark(CREAM, NAVY),
        "logo-mark-small-dark.svg": small_mark(CREAM, None),
        "logo-mark-small.svg":      small_mark(NAVY, None),
    }
    for name, svg in small.items():
        (LOGO / name).write_text(svg)
        print(f"{name}  {len(svg)} bytes")

    svgs = {
        "logo-lockup.svg": build("logo-mark.svg", NAVY, AMBER),
        "logo-lockup-dark.svg": build("logo-mark-dark.svg", CREAM, AMBER),
        "logo-lockup-strap.svg": build("logo-mark.svg", NAVY, AMBER,
                                       strap="ORANJESTAD &#183; ARUBA"),
    }
    svgs = measure(svgs)
    for name, svg in svgs.items():
        (LOGO / name).write_text(svg)
        print(f"{name}  {len(svg) // 1024} KB")


if __name__ == "__main__":
    main()
