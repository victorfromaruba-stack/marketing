# Aruba Web Studio — logo

**This is your artwork.** The divi-divi you generated, traced from the original PNG into vector.
Same shapes, same composition — nothing redrawn.

What changed, and only this:
- Raster → vector. `logo-mark.svg` is 1.9 KB and stays sharp at any size.
- Background removed. Transparent, so it sits on anything.
- Colours snapped to exact brand hex (they were approximate in the generated file).
- The stray white sparkle in the bottom-right corner is gone.
- Cropped square to the artwork with an even margin.

## Files

| File | Use |
|---|---|
| `logo-lockup.svg` | Default — site header, invoices, proposals, email signature |
| `logo-lockup-dark.svg` | Same, on dark backgrounds |
| `logo-lockup-strap.svg` | With `ORANJESTAD · ARUBA` — footers and print |
| `logo-mark.svg` | Mark alone — social avatar, Google Business Profile, favicon |
| `logo-mark-dark.svg` · `logo-mark-mono.svg` | On dark; one-colour for stamps and embroidery |
| `favicon.svg` · `favicon-32.png` · `apple-touch-icon-180.png` | Browser and phone |
| `email-signature.html` | Gmail signature — upload the logo via Gmail's Insert image button; data URIs get stripped |
| `*-512.png` · `*-1024.png` · `*-1760.png` | Raster, for anywhere that will not take SVG |

Use the SVG wherever it is accepted.

## Rules

- **Clear space** — at least the ring's stroke width on every side.
- **Minimum size** — 22px for the mark, 120px wide for the lockup. Below that the canopy fills in.
- **Never** stretch, rotate, add a shadow or gradient, recolour outside the palette, or put the
  light version on a light background.
- **The strapline version never goes in a nav.** At nav height it renders about 4px tall.

## Palette

| | Hex |
|---|---|
| Deep navy (tree) | `#0A2F4E` |
| Gold (ring, "WEB STUDIO") | `#FFC06B` |
| Sea (strapline) | `#1C7FA8` |
| Cream (background) | `#F7F3EC` |
