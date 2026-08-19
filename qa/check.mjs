#!/usr/bin/env node
/**
 * Aruba Web Studio — automated QA gate
 *
 *   node qa/check.mjs <slug>          check sites/<slug>/index.html
 *   node qa/check.mjs <slug> --open   also write screenshots
 *
 * Exit code 0 = shippable. Anything else = do not deploy, do not email.
 * The script catches mechanics. It cannot catch taste — still do qa/checklist.md by hand.
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
if (!slug) { console.error('usage: node qa/check.mjs <slug>'); process.exit(2); }

const file = resolve(ROOT, 'sites', slug, 'index.html');
if (!existsSync(file)) { console.error(`not found: ${file}`); process.exit(2); }

const errors = [], warnings = [], passes = [];
const fail = m => errors.push(m);
const warn = m => warnings.push(m);
const ok   = m => passes.push(m);

const html = readFileSync(file, 'utf8');

/* ---------- client assets on disk ---------- */
const imgDir = resolve(ROOT, 'sites', slug, 'img');
if (existsSync(imgDir)) {
  const files = readdirSync(imgDir);
  const logo = files.find(f => /^logo\./i.test(f));
  if (!logo) fail('no logo file in sites/' + slug + '/img/ — get their logo before building');
  else ok(`logo asset present (${logo})`);

  const photos = files.filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f) && !/^logo\./i.test(f));
  if (photos.length === 0) fail('no client photos in img/ — run prospector/fetch_assets.py');
  else if (photos.length < 3) warn(`only ${photos.length} client photo(s) — build fewer, larger sections around them`);
  else ok(`${photos.length} client photos`);

  if (files.includes('ATTRIBUTION.txt')) {
    const credits = readFileSync(resolve(imgDir, 'ATTRIBUTION.txt'), 'utf8');
    const names = [...credits.matchAll(/—\s*([^(]+?)\s*\(/g)].map(m => m[1].trim()).filter(Boolean);
    const missing = [...new Set(names)].filter(n => !html.includes(n));
    if (missing.length)
      fail(`Google Places photo attribution missing from the page: ${missing.slice(0,3).join(', ')} — required by the Maps Platform terms`);
    else ok('Places photo attributions present');
  }
} else {
  fail('sites/' + slug + '/img/ does not exist — no client assets harvested');
}

/* ---------- static source checks ---------- */

const BANNED = [
  [/lorem ipsum/i,                 'lorem ipsum placeholder text'],
  [/\bTODO\b|\bFIXME\b/,           'TODO/FIXME left in source'],
  [/github\.(io|com)/i,            'GitHub reference — must never appear in output'],
  [/your-?(company|business|name)/i, 'unreplaced "your company" placeholder'],
  [/\bexample\.com\b/i,            'example.com placeholder'],
  [/123-?456-?7890|555-?\d{4}/,    'fake placeholder phone number'],
  [/\[\s*(insert|add|placeholder)/i, 'unfilled [insert ...] placeholder'],
  [/Placeholder|PLACEHOLDER/,      "literal Placeholder text"],
  // a dash joining words is a sentence break and is banned. A dash between numbers
  // (7:00 \u2013 10:00) is a range and is correct typography, so it is allowed.
  [/(?:[A-Za-z][\s]*[\u2014\u2013]|[\u2014\u2013][\s]*[A-Za-z$])/,
     "dash used as a sentence break. Use a full stop, comma or colon (number ranges are fine)"],
  [/REPLACE_WITH|YOUR_FORM_ID/,     "form ID not wired up — the form will not deliver"],
  [/aruba-?web-?studio/i,          'Aruba Web Studio branding in demo body (footer credit only)'],
];
for (const [re, msg] of BANNED) {
  if (re.test(html)) fail(`Banned content: ${msg}`);
}
if (!BANNED.some(([re]) => re.test(html))) ok('No placeholder / banned content');

if (!/<html[^>]+lang=/i.test(html)) fail('<html> missing lang attribute');
else ok('lang attribute set');

if (!/<meta[^>]+name=["']viewport["']/i.test(html)) fail('missing viewport meta tag');
else ok('viewport meta present');

if (!/<meta[^>]+name=["']description["']/i.test(html)) fail('missing meta description');
else ok('meta description present');

if (!/application\/ld\+json/i.test(html)) fail('missing JSON-LD structured data');
else {
  const m = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i);
  try {
    const data = JSON.parse(m[1].trim());
    const types = [].concat(data['@graph'] || data).map(d => d['@type']).flat();
    if (!types.some(t => /LocalBusiness|Restaurant|Hotel|Store|TouristAttraction|ProfessionalService|LodgingBusiness/.test(t)))
      fail(`JSON-LD @type is "${types}" — must be LocalBusiness or a subtype`);
    else ok(`JSON-LD present (${types})`);
  } catch { fail('JSON-LD is not valid JSON'); }
}

const ogCount = (html.match(/property=["']og:/gi) || []).length;
if (ogCount < 3) warn(`only ${ogCount} Open Graph tags — add og:title, og:description, og:image (WhatsApp shows these when the link is shared)`);
else ok('Open Graph tags present');

/* ---------- rendered checks ---------- */

const browser = await chromium.launch();

async function audit(width, height, label) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: width < 500,
    hasTouch: width < 500,
  });
  const page = await ctx.newPage();
  const consoleErrors = [], failedReqs = [];

  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(String(e)));
  page.on('requestfailed', r => {
    const u = r.url();
    if (!u.startsWith('data:') && !/google|gstatic|formspree|wa\.me/.test(u))
      failedReqs.push(`${u} (${r.failure()?.errorText})`);
  });

  await page.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  consoleErrors.forEach(e => fail(`[${label}] console error: ${e.slice(0, 160)}`));
  failedReqs.forEach(r  => fail(`[${label}] failed request: ${r.slice(0, 160)}`));
  if (!consoleErrors.length && !failedReqs.length) ok(`[${label}] no console errors, no failed requests`);

  const r = await page.evaluate(() => {
    const out = {};
    out.scrollW = document.documentElement.scrollWidth;
    out.clientW = document.documentElement.clientWidth;

    out.h1 = [...document.querySelectorAll('h1')].map(h => h.textContent.trim());
    out.headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .map(h => +h.tagName[1]);

    out.imgsNoAlt = [...document.querySelectorAll('img')]
      .filter(i => !i.hasAttribute('alt') || !i.alt.trim())
      .map(i => i.getAttribute('src') || '(no src)').slice(0, 10);
    out.imgCount = document.querySelectorAll('img').length;
    out.imgsNoDims = [...document.querySelectorAll('img')]
      .filter(i => !i.getAttribute('width') && !i.getAttribute('height') &&
                   !(i.style.aspectRatio || getComputedStyle(i).aspectRatio !== 'auto'))
      .length;
    out.imgsBroken = [...document.querySelectorAll('img')]
      .filter(i => i.complete && i.naturalWidth === 0)
      .map(i => i.getAttribute('src')).slice(0, 10);
    out.lazy = [...document.querySelectorAll('img')].filter(i => i.loading === 'lazy').length;

    const links = [...document.querySelectorAll('a')];
    out.tel = links.filter(a => a.href.startsWith('tel:')).map(a => a.href);
    out.wa  = links.filter(a => /wa\.me|whatsapp/i.test(a.href)).map(a => a.href);
    out.emptyLinks = links.filter(a => {
      const h = a.getAttribute('href');
      return !h || h === '#' || h === 'javascript:void(0)';
    }).length;
    out.badAnchors = links
      .map(a => a.getAttribute('href'))
      .filter(h => h && h.startsWith('#') && h.length > 1 && !document.querySelector(h))
      .slice(0, 10);
    out.extNoRel = links.filter(a =>
      a.target === '_blank' && !/noopener/.test(a.rel || '')).length;

    out.forms = document.querySelectorAll('form').length;
    out.formAction = [...document.querySelectorAll('form')].map(f => f.getAttribute('action') || '');
    out.inputsNoLabel = [...document.querySelectorAll('input:not([type=hidden]),textarea,select')]
      .filter(i => !i.labels?.length && !i.getAttribute('aria-label') &&
                   !i.getAttribute('aria-labelledby') && !i.getAttribute('placeholder'))
      .length;
    out.mapEmbed = !!document.querySelector('iframe[src*="google.com/maps"], iframe[src*="maps.google"]');

    // tap targets
    out.smallTaps = [...document.querySelectorAll('a,button,input[type=submit]')]
      .filter(el => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && (b.height < 40 || b.width < 40);
      })
      .map(el => (el.textContent || el.tagName).trim().slice(0, 34))
      .slice(0, 8);

    // overflowing elements
    out.overflow = [...document.querySelectorAll('body *')]
      .filter(el => el.getBoundingClientRect().right > document.documentElement.clientWidth + 2)
      .map(el => el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''))
      .slice(0, 8);

    // tiny text
    out.tinyText = [...document.querySelectorAll('p,li,span,a,td')]
      .filter(el => el.textContent.trim().length > 20 &&
                    parseFloat(getComputedStyle(el).fontSize) < 14).length;

    out.textLen = document.body.innerText.replace(/\s+/g, ' ').trim().length;

    const h1 = document.querySelector('h1');
    const cs = h1 ? getComputedStyle(h1) : null;
    out.heroFont = cs ? Math.round(parseFloat(cs.fontSize)) : 0;
    out.tracking = cs ? Math.round(parseFloat(cs.letterSpacing || '0') * 100) / 100 : 0;

    out.revealCount = document.querySelectorAll('.rv,[data-reveal],.reveal').length;

    const sheets = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
    out.hasGrain     = /feTurbulence|fractalNoise|grain|noise\.(png|svg)/i.test(sheets + document.body.innerHTML);
    out.hasHoverState= /:hover[^{]*\{[^}]*(background|box-shadow|color|border)/i.test(sheets);
    out.reducedMotion= /prefers-reduced-motion/i.test(sheets);
    out.infiniteAnims= (sheets.match(/animation:[^;]*infinite/gi) || []).length;
    out.smoothScroll = /scroll-behavior\s*:\s*smooth/i.test(sheets);
    out.scrollTransforms = /\.(rv|reveal)[^{]*\{[^}]*transform\s*:\s*translate/i.test(sheets);
    out.hiddenWithoutJs = [...document.querySelectorAll('body *')]
      .filter(el => el.textContent.trim().length > 30 &&
                    parseFloat(getComputedStyle(el).opacity) < 0.1).length;

    const imgs = [...document.querySelectorAll('img')].map(i => i.getAttribute('src') || '');
    out.logoInNav = !!document.querySelector(
      'header img[src*="logo"], nav img[src*="logo"], .nav img[src*="logo"], .logo img, .brand img');
    out.logoInFooter = !!document.querySelector('footer img[src*="logo"]');
    out.externalImgs = imgs.filter(u => /^https?:\/\//i.test(u) &&
      !/^https?:\/\/(localhost|127\.)/.test(u));
    out.stockish = imgs.filter(u =>
      /unsplash|pexels|pixabay|shutterstock|istockphoto|gettyimages|stock|placeholder|picsum|dummyimage/i.test(u));
    out.emptyAlt = [...document.querySelectorAll('img')]
      .filter(i => i.hasAttribute('alt') && !i.alt.trim()).length;

    const shadows = (sheets.match(/box-shadow:[^;]+/gi) || []).join(' ');
    const nums = (shadows.match(/(\d+)px/g) || []).map(n => parseInt(n));
    out.maxShadow = nums.length ? Math.max(...nums) : 0;

    return out;
  });

  if (r.scrollW > r.clientW + 2)
    fail(`[${label}] horizontal overflow: content ${r.scrollW}px in ${r.clientW}px viewport` +
         (r.overflow.length ? ` — culprits: ${r.overflow.join(', ')}` : ''));
  else ok(`[${label}] no horizontal scroll`);

  if (label === 'mobile') {
    if (r.h1.length === 0) fail('no <h1> on the page');
    else if (r.h1.length > 1) fail(`${r.h1.length} <h1> elements — there must be exactly one`);
    else ok(`single <h1>: "${r.h1[0].slice(0, 60)}"`);

    let prev = 0, skipped = false;
    for (const lv of r.headings) { if (prev && lv > prev + 1) skipped = true; prev = lv; }
    if (skipped) warn('heading levels skip a step (e.g. h2 -> h4)');
    else ok('heading hierarchy is sequential');

    if (r.imgsNoAlt.length) fail(`${r.imgsNoAlt.length} image(s) missing alt text: ${r.imgsNoAlt.join(', ')}`);
    else ok(`all ${r.imgCount} images have alt text`);

    if (r.imgsBroken.length) fail(`broken image(s): ${r.imgsBroken.join(', ')}`);
    if (r.imgCount && r.imgsNoDims > 0) warn(`${r.imgsNoDims} image(s) without width/height or aspect-ratio — causes layout shift`);
    if (r.imgCount > 3 && r.lazy === 0) warn('no images use loading="lazy"');

    if (!r.tel.length) fail('no click-to-call tel: link — mandatory');
    else ok(`click-to-call present (${r.tel[0]})`);

    if (!r.wa.length) fail('no WhatsApp link — mandatory in Aruba');
    else ok(`WhatsApp link present (${r.wa[0].slice(0, 48)})`);

    if (r.emptyLinks) fail(`${r.emptyLinks} link(s) with empty or "#" href`);
    else ok('no dead links');

    if (r.badAnchors.length) fail(`anchor link(s) pointing at nothing: ${r.badAnchors.join(', ')}`);
    if (r.extNoRel) warn(`${r.extNoRel} target="_blank" link(s) missing rel="noopener"`);

    if (!r.forms) warn('no contact form on the page');
    else if (r.formAction.some(a => !a || a === '#'))
      fail('form has no action — it will not deliver anything');
    else ok(`contact form wired to ${r.formAction[0].slice(0, 46)}`);

    if (r.inputsNoLabel) fail(`${r.inputsNoLabel} form field(s) with no label or aria-label`);
    if (!r.mapEmbed) warn('no Google Maps embed');

    if (r.smallTaps.length) fail(`tap target(s) under 40px: ${r.smallTaps.join(' | ')}`);
    else ok('all tap targets >= 40px');

    if (r.tinyText) warn(`${r.tinyText} element(s) with body text under 14px`);

    /* ---- CLIENT ASSET checks — their logo, their photos ---- */
    if (!r.logoInNav)
      fail('their logo is not in the nav — a demo without the client\'s own logo reads as a template');
    else ok('client logo in the nav');

    if (!r.logoInFooter) warn('logo not repeated in the footer');

    if (r.stockish.length)
      fail(`stock/placeholder imagery detected (${r.stockish.slice(0,3).join(', ')}) — only the client\'s own photos may be used`);
    else ok('no stock imagery');

    if (r.externalImgs.length)
      fail(`${r.externalImgs.length} image(s) hotlinked from another domain (${r.externalImgs.slice(0,2).join(', ')}) — harvest and self-host them`);
    else ok('all images self-hosted');

    /* ---- WOW STANDARD craft checks ---- */
    if (r.heroFont < 44)
      fail(`hero headline is only ${r.heroFont}px on mobile — the standard is a genuinely large display size (clamp to ~2.9rem+)`);
    else ok(`hero headline ${r.heroFont}px — commits to scale`);

    if (r.tracking > -0.2)
      warn(`display letter-spacing is ${r.tracking}px — tighten negative tracking on large type`);

    if (r.infiniteAnims)
      fail(`${r.infiniteAnims} looping animation(s) — nothing on the page may move on its own (no Ken Burns, no marquee, no pulse)`);
    else ok('nothing moves on its own');

    if (r.scrollTransforms)
      fail('elements translate on scroll — content must stay where it lands');
    else ok('no scroll-driven movement');

    if (r.smoothScroll)
      warn('scroll-behavior:smooth is set — anchor jumps will glide rather than land instantly');

    if (!r.hasGrain) warn('no grain/texture overlay — flat colour reads as a template');
    else ok('grain overlay present');

    if (!r.hasHoverState) warn('no hover states on cards/buttons — interactive elements feel dead');
    else ok('hover states respond (colour/shadow, not movement)');

    if (r.maxShadow < 20) warn('shadows are shallow — use real depth on lifted elements');

    if (!r.reducedMotion)
      fail('no prefers-reduced-motion block — animation must be switchable off');
    else ok('prefers-reduced-motion respected');

    if (r.hiddenWithoutJs)
      fail('content is hidden by CSS that only JS reveals — with JS disabled it stays invisible forever');
    if (r.textLen < 600) warn(`only ${r.textLen} characters of text — thin for SEO`);
    else ok(`${r.textLen} characters of real content`);
  }

  if (process.argv.includes('--open')) {
    const dir = resolve(ROOT, 'qa', 'screenshots');
    mkdirSync(dir, { recursive: true });
    // walk the page so scroll-reveals actually fire, then return to the top
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.7;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 110));
      }
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 500));
    });
    await page.screenshot({ path: resolve(dir, `${slug}-${label}.png`), fullPage: true });
  }
  await ctx.close();
}

await audit(375, 812, 'mobile');
await audit(1440, 900, 'desktop');
await browser.close();

/* ---------- report ---------- */
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';
console.log(`\n${D}${'-'.repeat(64)}${X}`);
console.log(`  QA — ${slug}`);
console.log(`${D}${'-'.repeat(64)}${X}`);
passes.forEach(p => console.log(`  ${G}pass${X}  ${p}`));
warnings.forEach(w => console.log(`  ${Y}warn${X}  ${w}`));
errors.forEach(e => console.log(`  ${R}FAIL${X}  ${e}`));
console.log(`${D}${'-'.repeat(64)}${X}`);
console.log(`  ${passes.length} passed · ${warnings.length} warnings · ${errors.length} failures`);
if (errors.length) {
  console.log(`  ${R}NOT SHIPPABLE${X}. Fix the failures, re-run, do not email this prospect.\n`);
  process.exit(1);
}
if (warnings.length) console.log(`  ${Y}Shippable, but read the warnings.${X}`);
else console.log(`  ${G}Clean.${X}`);
console.log(`  Now do qa/checklist.md by hand. The script cannot judge taste.\n`);
