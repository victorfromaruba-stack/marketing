#!/usr/bin/env python3
"""
Aruba Web Studio — asset harvester

Pulls a prospect's REAL photos and logo, optimises them, and extracts their actual
brand palette straight out of those images. Writes it all into intake/<slug>.json.

A demo built from a business's own logo and photos converts several times better than
one built from generic imagery. This is the step that makes that possible.

  # from Google Places (needs GOOGLE_PLACES_KEY, uses the place_id in prospects.csv)
  python3 prospector/fetch_assets.py <slug> --place-id ChIJ...

  # from an existing site (og:image + touch icon as a logo candidate)
  python3 prospector/fetch_assets.py <slug> --from-site https://theirsite.com

  # from photos you saved by hand into intake/assets/<slug>/
  python3 prospector/fetch_assets.py <slug> --manual

  # palette only, from whatever is already in sites/<slug>/img/
  python3 prospector/fetch_assets.py <slug> --palette-only

Outputs:
  sites/<slug>/img/*.jpg          optimised photos
  sites/<slug>/img/logo.*         their logo, if found
  sites/<slug>/img/ATTRIBUTION.txt required if any photo came from Google Places
  intake/<slug>.json              palette + photo manifest merged in
"""
import os, sys, json, argparse, re, io, shutil
from pathlib import Path

try:
    import requests
    from PIL import Image
except ImportError:
    sys.exit("pip install requests pillow")

ROOT = Path(__file__).resolve().parent.parent
KEY = os.environ.get("GOOGLE_PLACES_KEY", "")
MAXW, QUALITY, MAXPHOTOS = 1600, 82, 8


# ---------------------------------------------------------------- palette
def dominant_palette(paths, n=6):
    """Pull the real brand colours out of their own images."""
    px = []
    for p in paths:
        try:
            im = Image.open(p).convert("RGB")
        except Exception:
            continue
        im.thumbnail((220, 220))
        q = im.quantize(colors=12, method=Image.MEDIANCUT)
        pal = q.getpalette()[:36]
        counts = sorted(q.getcolors(), reverse=True)
        for cnt, idx in counts:
            r, g, b = pal[idx * 3:idx * 3 + 3]
            px.append((cnt, (r, g, b)))

    # drop near-white, near-black and dead greys — they carry no brand signal
    def useful(c):
        r, g, b = c
        mx, mn = max(c), min(c)
        if mx > 242 and mn > 232: return False
        if mx < 26: return False
        if mx - mn < 14 and 60 < mx < 200: return False
        return True

    px.sort(reverse=True)
    out, seen = [], []
    for _, c in px:
        if not useful(c):
            continue
        if any(sum(abs(a - b) for a, b in zip(c, s)) < 68 for s in seen):
            continue
        seen.append(c)
        out.append("#%02X%02X%02X" % c)
        if len(out) >= n:
            break
    return out


def optimise(src_bytes, dest, maxw=MAXW):
    im = Image.open(io.BytesIO(src_bytes))
    if im.mode in ("RGBA", "P", "LA"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        im = im.convert("RGBA")
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert("RGB")
    if im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    im.save(dest, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    return dest


# ---------------------------------------------------------------- sources
def from_places(slug, place_id, imgdir):
    if not KEY:
        sys.exit("Set GOOGLE_PLACES_KEY first")
    r = requests.get(
        f"https://places.googleapis.com/v1/places/{place_id}",
        headers={"X-Goog-Api-Key": KEY,
                 "X-Goog-FieldMask": "photos,displayName,websiteUri,iconMaskBaseUri"},
        timeout=30)
    if r.status_code != 200:
        print(f"  ! Places {r.status_code}: {r.text[:180]}")
        return [], []
    data = r.json()
    photos, attribution = [], []
    for i, ph in enumerate(data.get("photos", [])[:MAXPHOTOS]):
        name = ph.get("name")
        media = requests.get(f"https://places.googleapis.com/v1/{name}/media",
                             params={"key": KEY, "maxWidthPx": MAXW, "skipHttpRedirect": "false"},
                             timeout=45)
        if media.status_code != 200:
            continue
        dest = imgdir / f"photo-{i+1}.jpg"
        try:
            optimise(media.content, dest)
        except Exception as e:
            print(f"  ! skipped photo {i+1}: {e}")
            continue
        photos.append(dest)
        for a in ph.get("authorAttributions", []):
            attribution.append(f"photo-{i+1}.jpg — {a.get('displayName','')} ({a.get('uri','')})")
        print(f"  + {dest.name}")
    return photos, attribution


def from_site(slug, url, imgdir):
    """Grab og:image and the best available touch icon as a logo candidate."""
    photos, logo = [], None
    try:
        html = requests.get(url, timeout=25,
                            headers={"User-Agent": "Mozilla/5.0 (compatible; AWS-assets/1.0)"}).text
    except Exception as e:
        print(f"  ! could not read {url}: {e}")
        return photos, logo

    def absolutise(u):
        if u.startswith("//"): return "https:" + u
        if u.startswith("http"): return u
        base = re.match(r"(https?://[^/]+)", url)
        return (base.group(1) if base else url.rstrip("/")) + "/" + u.lstrip("/")

    og = re.findall(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html, re.I)
    for i, u in enumerate(og[:4]):
        try:
            b = requests.get(absolutise(u), timeout=25).content
            dest = imgdir / f"site-{i+1}.jpg"
            optimise(b, dest); photos.append(dest); print(f"  + {dest.name}")
        except Exception:
            pass

    icons = re.findall(r'<link[^>]+rel=["\'](?:apple-touch-icon|icon|shortcut icon)["\'][^>]+href=["\']([^"\']+)', html, re.I)
    icons += re.findall(r'<img[^>]+(?:class|id|alt)=["\'][^"\']*logo[^"\']*["\'][^>]+src=["\']([^"\']+)', html, re.I)
    for u in icons:
        try:
            b = requests.get(absolutise(u), timeout=20).content
            im = Image.open(io.BytesIO(b))
            if min(im.size) < 48:      # favicon-sized: useless for a hero logo
                continue
            ext = "png" if im.mode in ("RGBA", "P", "LA") else "jpg"
            logo = imgdir / f"logo.{ext}"
            im.save(logo)              # keep transparency — do not flatten a logo
            print(f"  + {logo.name} ({im.size[0]}x{im.size[1]})")
            break
        except Exception:
            continue
    return photos, logo


def from_manual(slug, imgdir):
    src = ROOT / "intake" / "assets" / slug
    if not src.exists():
        sys.exit(f"Put their photos in {src} first (create the folder, drop the images in).\n"
                 f"Name their logo 'logo.png' or 'logo.jpg' and it will be picked up.")
    photos, logo = [], None
    for i, f in enumerate(sorted(src.iterdir())):
        if f.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        if f.stem.lower() == "logo":
            logo = imgdir / f"logo{f.suffix.lower()}"
            shutil.copy(f, logo); print(f"  + {logo.name}")
            continue
        dest = imgdir / f"photo-{i+1}.jpg"
        try:
            optimise(f.read_bytes(), dest); photos.append(dest); print(f"  + {dest.name}")
        except Exception as e:
            print(f"  ! skipped {f.name}: {e}")
    return photos, logo


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--place-id")
    ap.add_argument("--from-site")
    ap.add_argument("--manual", action="store_true")
    ap.add_argument("--palette-only", action="store_true")
    args = ap.parse_args()

    imgdir = ROOT / "sites" / args.slug / "img"
    imgdir.mkdir(parents=True, exist_ok=True)
    photos, logo, attribution = [], None, []

    if args.place_id:
        print("Google Places photos:")
        photos, attribution = from_places(args.slug, args.place_id, imgdir)
    if args.from_site:
        print(f"Their site ({args.from_site}):")
        p, l = from_site(args.slug, args.from_site, imgdir)
        photos += p; logo = logo or l
    if args.manual:
        print("Manual drop folder:")
        p, l = from_manual(args.slug, imgdir)
        photos += p; logo = logo or l
    if args.palette_only or not (args.place_id or args.from_site or args.manual):
        photos = [p for p in imgdir.iterdir()
                  if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")
                  and p.stem.lower() != "logo"]
        for cand in ("logo.png", "logo.jpg", "logo.svg", "logo.webp"):
            if (imgdir / cand).exists():
                logo = imgdir / cand; break

    if attribution:
        (imgdir / "ATTRIBUTION.txt").write_text(
            "Google Places photo attributions — MUST be shown on any page using these images.\n"
            "Required by Google Maps Platform terms.\n\n" + "\n".join(attribution) + "\n")
        print(f"  + ATTRIBUTION.txt ({len(attribution)} required credits)")

    # palette from THEIR material — logo weighted first, it carries the brand
    sources = ([logo] if logo else []) + list(photos)
    palette = dominant_palette(sources) if sources else []

    # merge into the intake brief
    intake = ROOT / "intake" / f"{args.slug}.json"
    if intake.exists():
        d = json.loads(intake.read_text())
        ident = d.setdefault("identity", {})
        if palette:
            ident["colors"] = palette
            ident["palette_source"] = "extracted from their own logo and photos"
        ident["logo_file"] = f"img/{logo.name}" if logo else ""
        ident["photos"] = [{"file": f"img/{p.name}", "alt": "", "source": "harvested"}
                           for p in photos]
        d["identity"] = ident
        intake.write_text(json.dumps(d, indent=2))
        print(f"\n  intake/{args.slug}.json updated")
    else:
        print(f"\n  ! no intake/{args.slug}.json yet — run /intake first, then re-run this")

    print(f"\n{'='*54}")
    print(f"  {len(photos)} photo(s)   logo: {'YES — ' + logo.name if logo else 'MISSING'}")
    print(f"  palette: {' '.join(palette) if palette else '(none extracted)'}")
    print(f"{'='*54}")
    if not logo:
        print("\n  NO LOGO. Do not build yet — get it from their Facebook profile picture,")
        print("  their signage, or their existing site, and drop it in")
        print(f"  intake/assets/{args.slug}/logo.png, then re-run with --manual.")
    if not photos:
        print("\n  NO PHOTOS. A demo with no images of their actual place is a weak demo.")


if __name__ == "__main__":
    main()
