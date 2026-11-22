// The /ai page never shows a date that has already gone by. Exit 1 = a stale date is on the page.
//   node ai/check-dates.mjs                          the working copy (ai/index.html, page.js, field.js)
//   node ai/check-dates.mjs https://arubawebstudio.com/ai/   the live page (its HTML and the two scripts)
//   node ai/check-dates.mjs <folder> --today=2026-12-01      any copy, as of any day
// What counts: what a visitor or Google can read. Visible text, meta tags, JSON-LD and the strings in the scripts.
// HTML comments and code comments are skipped (they carry build notes like "Victor 7 Nov").
// Formats: "Mon 23 Nov", "24 November", "Nov 24", "24 Nov 2026", "2026-11-24", "24/11/2026" (day first, as in Aruba),
// in English and Spanish. A date without a year is read as this year; if that is more than 180 days ago it is taken
// as next year's (so "5 Jan" in late November is a coming date, not a stale one).
// Today is Aruba's today (UTC-4, no daylight saving). Kept out of the deploy by .gitattributes (export-ignore).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const where = args.find((a) => !a.startsWith('--')) || fileURLToPath(new URL('.', import.meta.url));
const t = (args.find((a) => a.startsWith('--today=')) || '').slice(8) || new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
const today = Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10));
if (!/^\d{4}-\d\d-\d\d$/.test(t) || Number.isNaN(today)) { console.error(`bad --today ${t}`); process.exit(2); }

const FILES = ['index.html', 'page.js', 'field.js'];
const load = async (f) => /^https?:/.test(where)
  ? (async () => { const r = await fetch(new URL(f === 'index.html' ? '' : f, where.replace(/\/?$/, '/'))); if (!r.ok) throw new Error(`${f} answers ${r.status}`); return r.text(); })()
  : readFile(join(where, f), 'utf8');

// Keep what a reader sees: drop HTML comments, CSS, and comments inside scripts (not "https://").
const jsReadable = (js) => js.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');
const htmlReadable = (h) => h.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (_, at, body) => (/ld\+json/.test(at) ? body : jsReadable(body)))
  .replace(/&nbsp;| |⁠/g, ' ');

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'ma[yi]', 'jun', 'jul', 'aug|ago', 'sep', 'o[ck]t', 'nov', 'd[ei][cz]'];
const monthOf = (w) => MONTHS.findIndex((m) => new RegExp(`^(${m})`, 'i').test(w));
const MON = '(jan(?:uary)?|enero|feb(?:ruary)?|febrero|mar(?:ch)?|marzo|apr(?:il)?|abr(?:il)?|may|mayo|june?|junio|july?|julio|aug(?:ust)?|ago(?:sto)?|sept?(?:ember)?|sept?iembre|oct(?:ober)?|octubre|nov(?:ember)?|noviembre|dec(?:ember)?|dic(?:iembre)?)\\.?';
const PATTERNS = [
  [/\b(20\d\d)-(\d\d)-(\d\d)\b/g, (m) => [+m[1], +m[2] - 1, +m[3]]],
  [/\b(\d{1,2})\/(\d{1,2})\/(20\d\d)\b/g, (m) => [+m[3], +m[2] - 1, +m[1]]],
  [new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?: de)? ${MON}(?:,? (20\\d\\d))?(?![a-z])`, 'gi'), (m) => [m[3] && +m[3], monthOf(m[2]), +m[1]]],
  [new RegExp(`\\b${MON} (\\d{1,2})(?:st|nd|rd|th)?(?:,? (20\\d\\d))?\\b`, 'gi'), (m) => [m[3] && +m[3], monthOf(m[1]), +m[2]]],
];

const found = [], stale = [];
for (const f of FILES) {
  let text;
  try { text = await load(f); } catch (e) { console.error(`cannot read ${f} from ${where}: ${e.message}`); process.exit(2); }
  text = f.endsWith('.html') ? htmlReadable(text) : jsReadable(text);
  const seen = new Set();
  for (const [re, parts] of PATTERNS) for (const m of text.matchAll(re)) {
    const at = `${f}@${m.index}`;
    if (seen.has(at)) continue;
    seen.add(at);
    let [y, mo, d] = parts(m);
    if (mo < 0 || d < 1 || d > 31) continue;
    let when = Date.UTC(y || new Date(today).getUTCFullYear(), mo, d);
    if (!y && today - when > 180 * 864e5) when = Date.UTC(new Date(today).getUTCFullYear() + 1, mo, d);
    const line = `${f}: "${m[0]}" = ${new Date(when).toISOString().slice(0, 10)}`;
    found.push(line);
    if (when < today) stale.push(line);
  }
}
console.log(`${where}, as of ${t}: ${found.length} date(s) on the page${found.length ? '\n  ' + found.join('\n  ') : ''}`);
if (stale.length) { console.error(`FAIL: ${stale.length} date(s) already gone by:\n  ${stale.join('\n  ')}`); process.exit(1); }
console.log('ok: no date on the page is before today');
