# Aruba Webstudio — arubawebstudio.com

The studio's own website. One static HTML file, no build step, no framework — which
is deliberate: it loads instantly, cannot break at deploy time, and demonstrates the
thing we sell.

```
index.html          the whole site on one page since 5 Nov 2026 (was demo C): hero with the live contour
                    land (WebGL, inline), Work, How it works, Prices, Contact. Direction: agency/demos/c-DIRECTION.md
404.html            "page not found"; Cloudflare Pages serves it with status 404 for any unknown address
_redirects          /pricing, /pricing/ -> /#prices (301): the price list moved into the page, same prices
check.py            the one check: old URLs, 404, Google basics, phone + laptop, WhatsApp brief, outside links
assets/             Familjen Grotesk + Martian Mono (woff2, OFL, Latin-1 subsets), og.jpg (1200x630 card)
work/v2/            every image the page uses: AVIF + WebP at two widths, the AR loop
brand/              the design system: tokens, theme book, contrast check
  logo/             the vector marks and lockups
favicon.ico         built from the small-size mark
icon-*.png          32/48/180/192/512 + small-size variants
og-image.png        the old social card, kept so its URL still answers (pages use assets/og.jpg)
site.webmanifest    installable web app (relative paths: works on a subpath)
llms.txt            plain-text summary of offer, prices and live work for AI search
Caddyfile           TLS + redirects + caching (VPS path, dormant)
robots.txt, sitemap.xml
```
Assets sit at the repo root, not in a `public/` folder — the site is served flat,
and a nested folder meant every icon reference 404'd. Found by serving it, not by
reading it.

## The logos are vector

`brand/logo/*.svg` are traced paths — sharp at any size, under 2 KB each, and the
source of truth for every raster icon in this repo. The PNG set stays for the
places that still demand one: the `.ico`, the Apple touch icon, the manifest, and
the social card.

Two things about them are worth knowing before you edit one.

**The lockups embed their own font.** Bodoni Moda is inlined as a data URI in each
lockup file. An SVG loaded through `<img>` is sandboxed against external
resources, so a lockup that merely *names* a webfont renders in whatever serif the
viewer happens to have — which is what the original kit files did, in a macOS-only
face. Embedding costs about 60 KB per lockup, which is why they are for handing
out and the site's own header sets the name in live HTML instead.

**Converting the type to outlines was tried and abandoned.** opentype.js does not
apply this variable font's deltas correctly — its capital A came out as the
crossbar with no diagonals, and it was only visible on render. The browser's font
engine gets it right, so the browser is what draws it.

```bash
python3 brand/build-logo.py     # rebuilds favicon, small marks, and lockups
```

## Preview locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## This repo is public, and it is the website

Cloudflare Pages serves this repository at arubawebstudio.com (since 28 Oct 2026; GitHub Pages
only redirects the old github.io address). Two consequences worth holding onto:

**Pages serves the whole repo, not just `index.html`.** Every file committed here (except
`Caddyfile`, `deploy.sh` and `CNAME`, which the deploy leaves out)
is reachable as a URL on the studio's own domain. That is why the studio's
operating machinery — the prospect list, pricing, cold-email templates, memory —
lives in the private repo under `system/studio/` and not here. The test for
adding a file is not "is this secret" but "would I be happy for this to answer a
GET request on our domain".

**`.nojekyll` is deliberate.** Without it Pages runs the files through Jekyll,
which silently skips anything whose name starts with an underscore. Nothing here
does today, and the empty file means nothing here ever has to.

## Deploy

**Cloudflare Pages, project `arubawebstudio` — live.** A push alone is not live. Push to `main`, then
`sudo -u openclaw /home/openclaw/tools/deploy-arubawebstudio.sh` (wrangler uploads `origin/main`), then
`python3 check.py` against https://arubawebstudio.com/. Roll back by promoting the previous deployment
(Cloudflare dashboard, Pages, arubawebstudio, Deployments, "Rollback to this deployment", or the API's
`.../deployments/<id>/rollback`). `.github/workflows/brand.yml` is the brand checks, not a deploy.

**The VPS — set up, not in use.** `system/vps/deploy-agent.sh` in the private
repo installs a systemd timer that pulls this branch over HTTPS and runs
`deploy.sh`. It is the right answer if the site ever needs something Pages
cannot do: server-side anything, a private staging host, or the studio's own
tooling on the same box. Until then Pages is simpler and free, and the Caddyfile
and `deploy.sh` below are dormant rather than wrong.

## Deploy to the VPS

Caddy obtains and renews certificates automatically, so there is nothing to remember.

```bash
# on the server, once
sudo mkdir -p /srv/arubawebstudio
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy

# every deploy
rsync -avz --delete \
  index.html robots.txt sitemap.xml site.webmanifest \
  favicon.ico icon-*.png og-image.png \
  user@<vps-ip>:/srv/arubawebstudio/
```

**Before it resolves:** the domain pointed at Namecheap parking
(`162.255.119.156`) when this was written. For **Pages**, point the apex at
GitHub's four A records (185.199.108–111.153) and `www` at
`victorfromaruba-stack.github.io`. For the **VPS** instead, point the apex at the
server IP and `www` at the bare domain. Do one or the other, not both — split
records are how a site half-works for half its visitors.

## What the page claims, and where each claim comes from

Every number on the page is read from code or a live site, never estimated.
House of Mosaic: 13 artworks = `app-test/content/artworks/`, 5 interface
languages = `app-test/src/i18n/`. Store release is NOT claimed: the Play
developer account is still open in `STORE-LISTING.md`. Client descriptions
match what each live site shows. Re-check them when a client site changes.

Screens in the work rail are captures of the live sites at 390px
(tools in the scratch folder: capture.mjs, img.mjs). Pidi kitchen and driver
screens show sample orders and say so.

## Decisions worth keeping

**No build step.** A framework would add tooling, a deploy pipeline and a way for
the site to break, in exchange for nothing a five-section page needs.

**Papiamento named, not translated.** Listing the four languages signals local
fluency; four full translations is real work with no evidence yet that anyone wants
them. Add them when a client asks.

**Prices published.** Most studios hide them. Publishing filters out people who were
never going to pay, and starts every conversation past the awkward part.

**Day and night.** The page follows the system theme: night navy with limestone type and amber only on the
button, day limestone with ink. The land in the hero reads its colours from the same CSS variables.

**The land.** The hero's contours are WebGL, drawn from a height field; they rise once on load, drift with the
wind, lift under a finger, and stop when the hero scrolls away or the tab hides. No WebGL or reduced motion =
a still SVG frame in the same composition. Below the hero the land is the real Aruba (Copernicus DEM GLO-30,
OpenStreetMap coastline), drawn once into static paths; credits are in the footer.

**Plain static, any host.** No build step, every URL relative (404.html uses absolute ones, because it is
served at any depth), so the same folder serves from Cloudflare Pages or a subpath preview.

**Fonts.** One type family per site, chosen for the brand (Victor, 1 Nov: "every website different"): Familjen
Grotesk for everything, Martian Mono for survey notes and labels, self-hosted, about 23 KB together. The logo
lockups keep their embedded Bodoni wordmark because a logo is artwork.

**The email stays a plain link.** Cloudflare's Email Address Obfuscation is on for the zone and rewrites every
`mailto:` into `/cdn-cgi/l/email-protection` plus an injected script. The footer address sits between
`<!--email_off-->` markers so it stays a real link with nothing injected.

**AR led with, not buried.** It is the one thing on this page a competitor in this
market probably cannot match. It belongs in the first paragraph.
