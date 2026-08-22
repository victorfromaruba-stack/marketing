# Aruba Web Studio — arubawebstudio.com

The studio's own website. One static HTML file, no build step, no framework — which
is deliberate: it loads instantly, cannot break at deploy time, and demonstrates the
thing we sell.

```
index.html     the whole site
Caddyfile      TLS + redirects + caching for the VPS
robots.txt     crawler rules
sitemap.xml    one URL, for now
```

## Preview locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to the VPS

Caddy obtains and renews certificates automatically, so there is nothing to remember.

```bash
# on the server, once
sudo mkdir -p /srv/arubawebstudio
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy

# every deploy
rsync -avz --delete \
  index.html robots.txt sitemap.xml \
  user@<vps-ip>:/srv/arubawebstudio/
```

**Before it resolves:** the domain currently points at Namecheap parking
(`162.255.119.156`). Change the A record to the VPS IP and add a `www` CNAME to the
bare domain. DNS takes minutes to a few hours.

## Before this goes live

Three things are placeholders, marked in the source with `⚠`:

1. **Three more projects.** The House of Mosaic case study is real and detailed;
   the other three cards are empty slots. Fill them with real clients or delete
   them — never invent one. An honest single case study beats four padded ones.
2. **A social share image.** `og:image` is absent, so links currently unfurl as
   plain text. A 1200×630 screenshot of the House of Mosaic app would do it.
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
