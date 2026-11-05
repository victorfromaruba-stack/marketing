# The one check. Run: python3 check.py [https://arubawebstudio.com/]   (any deployment URL works; exit 1 = broken)
# URLs: every address the live site answered on 5 Nov 2026 (the files of a2ba323, the deploy's exclusions aside, plus
#   the pretty URLs) still answers 200, or redirects to something that does. /pricing lands on /#prices.
# 404: an unknown address answers 404 with the not-found page, never the home page with 200.
# Google: on the real domain no noindex (meta or header); canonical, title, description, OG image that loads, JSON-LD
#   that parses and whose prices, phone and email are the ones on the page; sitemap URLs answer 200; robots names it.
#   The demos host keeps noindex, so the copy of this page at /c/ is never indexed.
# Phone and laptop (390 and 1440 px): no console errors, no sideways scroll, every image loads, every #link has a
#   target, both "Start a project" buttons open WhatsApp +297 747 7794 with the brief intact (checked in the browser
#   after wa.me hands it on), and every outside link answers.
import json, re, subprocess, sys, urllib.error, urllib.request
from urllib.parse import urlsplit, parse_qs, unquote
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://arubawebstudio.com/').rstrip('/') + '/'
REAL = urlsplit(BASE).hostname in ('arubawebstudio.com', 'www.arubawebstudio.com')
BRIEF = "Hi Aruba Webstudio, I'd like to start a project.\nWhat the business sells:\nWhat a customer should be able to do:"
PRICES = ['US$800', 'ƒ1,432', 'US$4,500', 'ƒ8,055', 'US$1,200', 'ƒ2,148', 'Quoted']
UA = 'Mozilla/5.0 (arubawebstudio check.py)'
fails = []

class NoFollow(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a): return None
raw = urllib.request.build_opener(NoFollow)

def get(url, follow=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        r = (urllib.request.urlopen if follow else raw.open)(req, timeout=20)
        return r.status, r.headers, r.read().decode('utf-8', 'replace'), r.url
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read().decode('utf-8', 'replace'), url

# 1. every old URL still works
here = __file__.rsplit('/', 1)[0] or '.'
files = subprocess.run(['git', '-c', f'safe.directory={here}', '-C', here, 'ls-tree', '-r', '--name-only', 'a2ba323'], capture_output=True, text=True, check=True).stdout.split()
old = ['', 'pricing', 'pricing/', 'brand', 'brand/', '404'] + [f for f in files if f not in ('CNAME', 'Caddyfile', 'deploy.sh')]
for path in old:
    st, h, _, _ = get(BASE + path)
    if st in (301, 302, 307, 308):
        loc = h.get('Location', '')
        to = loc if loc.startswith('http') else BASE + loc.lstrip('/')
        st2 = get(to.split('#')[0])[0]
        if st2 != 200: fails.append(f'/{path} -> {loc} -> {st2}')
        if path.startswith('pricing') and urlsplit(to).fragment != 'prices': fails.append(f'/{path} -> {loc}, not /#prices')
    elif st != 200: fails.append(f'/{path} answers {st}')
print(f'{len(old)} old URLs requested')

# 2. a real 404
st, _, body, _ = get(BASE + 'no-such-page-' + 'x7q')
if st != 404 or 'Page not found | Aruba Webstudio' not in body or 'Shaped by the wind' in body: fails.append(f'unknown URL answers {st}, not the 404 page')

# 3. Google basics
st, h, home, _ = get(BASE)
meta = lambda name: (re.search(rf'<meta (?:name|property)="{name}" content="([^"]*)"', home) or [None, ''])[1]
if st != 200: fails.append(f'home answers {st}')
if REAL and ('noindex' in meta('robots') or 'noindex' in (h.get('X-Robots-Tag') or '')): fails.append('home is noindex on the real domain')
if '<link rel="canonical" href="https://arubawebstudio.com/">' not in home: fails.append('canonical missing')
title = re.search(r'<title>([^<]+)</title>', home)
if not title or 'Aruba Webstudio' not in title[1]: fails.append('title missing')
if not 120 <= len(meta('description')) <= 160: fails.append(f'description is {len(meta("description"))} chars')
og = meta('og:image')
st_og, h_og = get(og.replace('https://arubawebstudio.com/', BASE))[:2]
if st_og != 200 or 'image/' not in (h_og.get('Content-Type') or ''): fails.append(f'og:image {og} answers {st_og}')
try:
    ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', home, re.S)[1])
    studio = next(n for n in ld['@graph'] if n['@type'] == 'ProfessionalService')
    shown = re.sub(r'<[^>]+>', ' ', home)
    for o in studio['hasOfferCatalog']['itemListElement']:
        p = o.get('priceSpecification', {}).get('minPrice')
        if p and f'US${p:,}' not in shown: fails.append(f'JSON-LD price {p} is not on the page')
    if studio['telephone'] != '+297 747 7794' or f'mailto:{studio["email"]}' not in home: fails.append('JSON-LD phone or email not on the page')
except Exception as e: fails.append(f'JSON-LD: {e}')
for p in PRICES:
    if p not in home: fails.append(f'price {p} missing')
sm = get(BASE + 'sitemap.xml')[2]
locs = re.findall(r'<loc>([^<]+)</loc>', sm)
if not locs: fails.append('sitemap has no URLs')
for loc in locs:
    if get(loc.replace('https://arubawebstudio.com/', BASE))[0] != 200: fails.append(f'sitemap URL {loc} is not 200')
if 'Sitemap: https://arubawebstudio.com/sitemap.xml' not in get(BASE + 'robots.txt')[2]: fails.append('robots.txt does not name the sitemap')
if 'noindex' not in (get('https://demos.arubawebstudio.com/c/')[1].get('X-Robots-Tag') or ''): fails.append('demos host lost noindex')

# 4. phone and laptop
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    for w, hgt in ((390, 844), (1440, 900)):
        ctx = b.new_context(viewport={'width': w, 'height': hgt}, device_scale_factor=2, is_mobile=w < 600, has_touch=w < 600)
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(BASE, wait_until='networkidle')
        J = pg.evaluate
        if J('document.documentElement.scrollWidth') > w: fails.append(f'sideways scroll at {w}')
        J("Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode().catch(()=>{})}))")
        broken = J("[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.currentSrc||i.src)")
        if broken: fails.append(f'{w}: images not loading {broken}')
        missing = J("[...document.querySelectorAll('a[href^=\"#\"]')].map(a=>a.getAttribute('href').slice(1)).filter(id=>id&&!document.getElementById(id))")
        if missing: fails.append(f'#links without a target: {missing}')
        ctas = J("[...document.querySelectorAll('a.cta')].filter(a=>a.textContent.trim().startsWith('Start a project')).map(a=>a.href)")
        if len(ctas) != 2: fails.append(f'{w}: {len(ctas)} Start a project buttons, expected 2')
        for href in ctas:
            q = parse_qs(urlsplit(href).query)
            if not href.startswith('https://wa.me/2977477794?') or q.get('text') != [BRIEF]: fails.append(f'Start a project link is {href}')
        if w == 390:   # our page's errors are judged before the click; WhatsApp's own page logs its own
            if errs: fails.append(f'{w}: console errors {errs}')
            errs.clear()
            with pg.expect_navigation(url=re.compile(r'whatsapp\.com/'), wait_until='commit', timeout=30000): pg.locator('a.cta').first.click()
            q = parse_qs(urlsplit(pg.url).query)
            if q.get('text') != [BRIEF] or q.get('phone') != ['2977477794']: fails.append(f'WhatsApp opened as {unquote(pg.url)[:200]}')
            else: print('WhatsApp opened with the brief intact:', pg.url.split('?')[0], repr(q['text'][0]))
            errs.clear()
            pg.goto(BASE, wait_until='networkidle')
            outside = J("[...new Set([...document.querySelectorAll('a[href^=\"http\"]')].map(a=>a.href))].filter(h=>!h.includes('wa.me/'))")
        if errs: fails.append(f'{w}: console errors {errs}')
        ctx.close()
    b.close()
for url in outside:
    st = get(url, follow=True)[0]
    if st >= 400: fails.append(f'outside link {url} answers {st}')
print(f'{len(outside)} outside links requested')

print('FAIL\n' + '\n'.join(fails) if fails else f'OK {BASE}')
sys.exit(1 if fails else 0)
