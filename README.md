# Aruba Web Studio — arubawebstudio.com

The studio's own website. One static HTML file, no build step, no framework — which
is deliberate: it loads instantly, cannot break at deploy time, and demonstrates the
thing we sell.

```
index.html          the whole site
brand/              the design system — tokens, theme book, contrast check
  tokens.css        every project starts here
  index.html        the theme book
  check-contrast.py runs in CI
  build-logo.py     regenerates the vector logos below
  logo/             the artwork
    logo-mark*.svg        the mark: full, dark, mono, and the ringless small pair
    logo-lockup*.svg      name beside mark, with the font embedded
    favicon.svg           the small mark on a navy tile
    BodoniModa.ttf        input to build-logo.py; not deployed
    logo-*.png            the master raster artwork; not deployed
favicon.ico         built from the small-size mark
icon-*.png          32/48/180/192/512 + small-size variants
og-image.png        1200×630 social card
site.webmanifest    installable web app
Caddyfile           TLS + redirects + caching
robots.txt · sitemap.xml
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

A `CNAME` file was added, which means GitHub Pages serves this repository at
arubawebstudio.com. Two consequences worth holding onto:

**Pages serves the whole repo, not just `index.html`.** Every file committed here
is reachable as a URL on the studio's own domain. That is why the studio's
operating machinery — the prospect list, pricing, cold-email templates, memory —
lives in the private repo under `system/studio/` and not here. The test for
adding a file is not "is this secret" but "would I be happy for this to answer a
GET request on our domain".

**`.nojekyll` is deliberate.** Without it Pages runs the files through Jekyll,
which silently skips anything whose name starts with an underscore. Nothing here
does today, and the empty file means nothing here ever has to.

## Deploy

Two paths exist and only one is live.

**GitHub Pages — live.** Push to `main` and it publishes. Nothing else to do.

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

## Before this goes live

Three things are placeholders, marked in the source with `⚠`:

1. **Three more projects.** The House of Mosaic case study is real and detailed;
   the other three cards are empty slots. Fill them with real clients or delete
   them — never invent one. An honest single case study beats four padded ones.
2. ~~A social share image.~~ **Done** — `og-image.png` is generated from the mark.
3. **Prices.** The figures in the services section come from
   `system/service/OFFERS.md` in the other repo. Confirm they match what you will
   actually quote — a price on a public page is a promise.

## Decisions worth keeping

**No build step.** A framework would add tooling, a deploy pipeline and a way for
the site to break, in exchange for nothing a five-section page needs.

**Papiamento named, not translated.** Listing the four languages signals local
fluency; four full translations is real work with no evidence yet that anyone wants
them. Add them when a client asks.

**Prices published.** Most studios hide them. Publishing filters out people who were
never going to pay, and starts every conversation past the awkward part.

**Dark mode included.** Roughly half of phone users have it on, and a site that
ignores it looks broken to them.

**AR led with, not buried.** It is the one thing on this page a competitor in this
market probably cannot match. It belongs in the first paragraph.
