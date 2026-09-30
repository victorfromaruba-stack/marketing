// The agency's studio in Oranjestad: the office and the bots in it, drawn in code
// (no image files, no libraries). Loaded before agency.js, which feeds it the
// cleaned report. There's no inline script anywhere, so the page's
// Content-Security-Policy can refuse any script a bot's text might try to smuggle
// in, and bot text only ever reaches the canvas through fillText, never as HTML.
"use strict";

// Never inside another page's frame: a hidden frame could trick a tap into sending an answer
// (clickjacking). tailscale serve can't add a frame-ancestors header, so the page refuses itself.
if ((() => { try { return window.top !== window.self; } catch { return true; } })()) {
  document.documentElement.hidden = true;
  throw new Error("The agency control center won't run inside a frame.");
}

/* ---------- kit ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const HEX = /^#[0-9a-fA-F]{6}$/;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");
// The page's own animation switch, remembered on this device only.
let ANIM_OFF = false;
try { ANIM_OFF = localStorage.getItem("aws-agency-anim") === "off"; } catch { /* private mode: default on */ }
const still = () => REDUCED.matches || ANIM_OFF;
// Each state has one place and one pose. Only the report moves a bot.
const STATES = {
  working: { word: "working", where: "desk" },
  waiting: { word: "waiting on you", where: "desk" },
  stuck: { word: "stuck", where: "desk" },
  studying: { word: "studying", where: "library" },
  meeting: { word: "in a meeting", where: "meeting" },
  lunch: { word: "on a break", where: "cafe" },
  off: { word: "off duty", where: "lounge" },
};
const isState = (s) => typeof s === "string" && Object.prototype.hasOwnProperty.call(STATES, s);
const C = { night: "#071A26", cream: "#F3EFE3", faint: "#8B9AA3", amber: "#FABA5E", sea: "#6DB4E5", bad: "#FF6B8B", ink: "#0B2F48" };

/* ---------- colour ---------- */
const _rgb = new Map(), _mix = new Map();
function rgb(h) { let v = _rgb.get(h); if (!v) { const n = parseInt(h.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; _rgb.set(h, v); } return v; }
const toHex = (r, g, b) => "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
function mix(a, b, t) {
  t = clamp(t, 0, 1);
  const k = a + b + t.toFixed(3);
  let v = _mix.get(k);
  if (!v) { const A = rgb(a), B = rgb(b); v = toHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); if (_mix.size > 5000) _mix.clear(); _mix.set(k, v); }
  return v;
}
const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${clamp(a, 0, 1).toFixed(3)})`; };

/* ---------- Aruba time (UTC-4 all year) ---------- */
const ARUBA = new Intl.DateTimeFormat("en-US", { timeZone: "America/Aruba", hour: "numeric", minute: "2-digit", hourCycle: "h23" });
function aruba(t = Date.now()) {
  const p = ARUBA.formatToParts(new Date(t)), h = Number(p.find((x) => x.type === "hour").value) % 24, m = Number(p.find((x) => x.type === "minute").value);
  return { h, m, hf: h + m / 60 };
}
const clockText = ({ h, m }) => `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;

/* ---------- the cast: a build, a face, a colour, and one thing you'd know each bot by ---------- */
const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const GEO = {
  box:     { tw: 28, th: 22, tr: 7,  hw: 32, hh: 26, hr: 8,                vw: 24, vh: 14, vr: 5 },
  capsule: { tw: 24, th: 23, tr: 10, hw: 27, hh: 31, hr: [13, 13, 11, 11], vw: 21, vh: 16, vr: 7 },
  dome:    { tw: 28, th: 21, tr: 10, hw: 32, hh: 27, hr: [16, 16, 7, 7],   vw: 24, vh: 13, vr: 6 },
  wide:    { tw: 30, th: 20, tr: 7,  hw: 38, hh: 23, hr: 8,                vw: 30, vh: 13, vr: 6 },
  egg:     { tw: 34, th: 52, tr: 0,  hw: 30, hh: 34, hr: 0,                vw: 21, vh: 13, vr: 6, egg: true },
};
// build = [torso width, torso height, head size]: the silhouette, so no two bots stand alike.
const CAST = {
  muddy:  { shape: "box",     acc: "captain",    eyes: "wide",    mouth: "smile",    ears: "bolts", chest: "badge",   build: [1, 1, 1] },
  atlas:  { shape: "capsule", acc: "glasses",    eyes: "dot",     mouth: "line",     ears: "none",  chest: "pocket",  build: [0.94, 1.24, 1] },
  spark:  { shape: "dome",    acc: "bulb",       eyes: "oval",    mouth: "grin",     ears: "none",  chest: "dial",    build: [0.9, 0.8, 1.08] },
  scout:  { shape: "capsule", acc: "safari",     eyes: "pixel",   mouth: "smirk",    ears: "fins",  chest: "stripe",  build: [1, 0.95, 0.96] },
  wire:   { shape: "wide",    acc: "newsboy",    eyes: "bar",     mouth: "none",     ears: "bolts", chest: "buttons", build: [1.04, 0.96, 1] },
  hype:   { shape: "wide",    acc: "shades",     eyes: "none",    mouth: "grin",     ears: "none",  chest: "zip",     build: [1.14, 1.08, 1.04] },
  buzz:   { shape: "dome",    acc: "antennae",   eyes: "wide",    mouth: "w",        ears: "none",  chest: "stripe",  build: [0.86, 0.84, 0.97] },
  rank:   { shape: "box",     acc: "crown",      eyes: "pixel",   mouth: "smile",    ears: "fins",  chest: "dial",    build: [0.98, 1, 1] },
  reel:   { shape: "dome",    acc: "headphones", eyes: "oval",    mouth: "smile",    ears: "none",  chest: "screen",  build: [1, 0.94, 1] },
  forge:  { shape: "box",     acc: "hardhat",    eyes: "bar",     mouth: "grill",    ears: "bolts", chest: "panel",   build: [1.16, 1.06, 1.02] },
  pixel:  { shape: "dome",    acc: "beret",      eyes: "lash",    mouth: "smile",    ears: "none",  chest: "buttons", build: [0.92, 1.02, 0.98] },
  closer: { shape: "wide",    acc: "fedora",     eyes: "round",   mouth: "mustache", ears: "none",  chest: "none",    build: [1.1, 1.1, 1] },
  ledger: { shape: "box",     acc: "eyeshade",   eyes: "dot",     mouth: "line",     ears: "bolts", chest: "pocket",  build: [1, 1.04, 0.96] },
  clerk:  { shape: "capsule", acc: "bowtie",     eyes: "round",   mouth: "small",    ears: "none",  chest: "buttons", build: [0.86, 1.18, 0.94] },
  ticker: { shape: "capsule", acc: "tophat",     eyes: "monocle", mouth: "line",     ears: "none",  chest: "stripe",  build: [0.96, 1.1, 1] },
  eggbot: { shape: "egg",     acc: "mirror",     eyes: "cyclops", mouth: "none",     ears: "none",  chest: "none",    build: [1, 1, 1] },
};
const ROLE_ACC = [[/chief|staff/i, "captain"], [/design/i, "beret"], [/sales/i, "fedora"], [/seo/i, "crown"], [/idea/i, "bulb"], [/news|brief/i, "newsboy"],
  [/video|youtube|film/i, "headphones"], [/social/i, "antennae"], [/market.*research|trad|stock/i, "tophat"], [/marketing/i, "shades"], [/financ|legal|account/i, "eyeshade"],
  [/paper|admin|clerk/i, "bowtie"], [/product|engineer|build/i, "hardhat"], [/sizing|scout/i, "safari"], [/research|strategy/i, "glasses"], [/help/i, "mirror"]];
const EYES = ["round", "dot", "pixel", "oval", "wide", "bar", "lash"], MOUTHS = ["smile", "line", "w", "grin", "smirk", "small", "grill"];
const EARS = ["none", "bolts", "fins"], CHESTS = ["panel", "dial", "stripe", "buttons", "pocket", "zip"];
const BUILDS = [[1, 1, 1], [0.9, 1.18, 0.96], [1.12, 0.9, 1.04], [0.9, 0.84, 1.08], [1.06, 1.08, 0.96]];
const FALLBACK = ["#2FB36D", "#1FB5A8", "#8B5CF6", "#A0703C", "#EF4444", "#F59E2A", "#2F7BF6", "#EC4899"];
function geoOf(shape, [bw, bh, hs]) {
  const g0 = GEO[shape];
  if (g0.egg) return g0;
  const k = (v) => (typeof v === "number" ? v * hs : v.map((x) => x * hs));
  return { tw: g0.tw * bw, th: g0.th * bh, tr: g0.tr, hw: g0.hw * hs, hh: g0.hh * hs, hr: k(g0.hr), vw: g0.vw * hs, vh: g0.vh * hs, vr: g0.vr * hs };
}
const _cast = new Map();
function castOf(b) {
  const key = b.id + "|" + b.role;
  if (_cast.has(key)) return _cast.get(key);
  const h = hash(b.id), hit = ROLE_ACC.find(([re]) => re.test(b.role || ""));
  // an own-property check: a bot called "constructor" or "__proto__" gets a generated look, not Object's
  const c = (Object.prototype.hasOwnProperty.call(CAST, b.id) && CAST[b.id]) || {
    shape: ["box", "capsule", "dome", "wide"][h % 4], acc: hit ? hit[1] : "antenna",
    eyes: EYES[(h >>> 3) % EYES.length], mouth: MOUTHS[(h >>> 7) % MOUTHS.length], ears: EARS[(h >>> 11) % EARS.length],
    chest: CHESTS[(h >>> 13) % CHESTS.length], build: BUILDS[(h >>> 17) % BUILDS.length],
  };
  const out = { ...c, G: geoOf(c.shape, c.build) };
  _cast.set(key, out);
  return out;
}
function dress(b) { const h = hash(b.id); return { ...b, h, ph: (h % 997) / 997 * 40, cast: castOf(b), color: b.color || FALLBACK[h % FALLBACK.length] }; }

/* ---------- drawing kit ---------- */
function rr(p, x, y, w, h, r) {
  const [a, b, c, d] = typeof r === "number" ? [r, r, r, r] : r;
  p.moveTo(x + a, y); p.lineTo(x + w - b, y); p.quadraticCurveTo(x + w, y, x + w, y + b);
  p.lineTo(x + w, y + h - c); p.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
  p.lineTo(x + d, y + h); p.quadraticCurveTo(x, y + h, x, y + h - d);
  p.lineTo(x, y + a); p.quadraticCurveTo(x, y, x + a, y); p.closePath();
}
function shade(g, x, y, w, h, k = 1) {
  // Flat two-tone volume: a shadow side on the right and a small gloss top-left. Clips to the current path.
  g.save(); g.clip();
  g.fillStyle = `rgba(3,12,18,${(0.26 * k).toFixed(3)})`;
  g.beginPath(); g.ellipse(x + w * 1.04, y + h * 0.62, w * 0.42, h, 0, 0, TAU); g.fill();
  g.fillStyle = `rgba(255,255,255,${(0.2 * k).toFixed(3)})`;
  g.beginPath(); g.ellipse(x + w * 0.3, y + h * 0.17, w * 0.2, h * 0.09, -0.35, 0, TAU); g.fill();
  g.restore();
}
function shaded(g, x, y, w, h, r, col, k) { g.beginPath(); rr(g, x, y, w, h, r); g.fillStyle = col; g.fill(); shade(g, x, y, w, h, k); }
function rim(g, x, y, w, h, r, a) {
  // lamplight catching the left edge
  if (!a) return;
  g.save(); g.beginPath(); rr(g, x, y, w, h, r); g.clip();
  const gr = g.createLinearGradient(x, 0, x + 4, 0); gr.addColorStop(0, `rgba(255,199,110,${a.toFixed(3)})`); gr.addColorStop(1, "rgba(255,199,110,0)");
  g.fillStyle = gr; g.fillRect(x, y, 4, h); g.restore();
}
function disc(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
function ell(g, x, y, rx, ry, col) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
function glow(g, x, y, r, col, a) {
  if (a <= 0.003 || r <= 0) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(col, a)); gr.addColorStop(0.45, rgba(col, a * 0.38)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
// The divi-divi, from the studio's mark (viewBox 258 313 548 397).
const MARK = new Path2D("M286 381L282 390L325 390L326 395L311 416L271 423L258 436L307 437L310 463L322 490L415 634L433 677L433 695L354 695L354 710L606 710L606 695L542 695L393 508L387 483L395 473L435 472L480 488L511 509L514 518L563 542L548 561L756 561L741 545L700 541L678 529L633 527L593 538L558 525L557 518L806 518L794 505L742 499L732 487L719 483L720 478L775 478L754 462L667 458L658 445L549 448L539 442L539 436L738 436L721 422L649 415L640 404L610 395L611 390L661 390L648 377L601 372L585 362L548 354L549 349L613 349L593 334L524 330L519 317L508 313L415 316L374 325L334 343L330 349L364 350L359 361L342 372ZM504 479L568 478L588 492L558 494L530 504ZM415 444L425 436L469 436L508 445L520 455L482 469L447 454L416 449ZM336 437L377 436L378 441L352 470ZM462 402L468 390L505 391L496 403ZM344 414L362 390L440 391L431 403L372 403L363 415Z");
function mark(g, cx, cy, w, col) { const k = w / 548; g.save(); g.translate(cx, cy); g.scale(k, k); g.translate(-532, -511.5); g.fillStyle = col; g.fill(MARK, "evenodd"); g.restore(); }

/* ---------- a bot ---------- */
// Units: 1 = 1 CSS px at scale 1. Origin: the bottom of the body; up is negative y.
const EYE = "#E8FBFF", VISOR = "#0A1822", BOOKS = ["#1B6CA8", "#B0245C", "#2F7F5B", "#8A5A00", "#0B2F48", "#6B4FA0"];
const _bc = new Map();
function botColors(b, dim) {
  const k = b.color + "|" + dim;
  let c = _bc.get(k);
  if (!c) {
    const base = dim ? mix(b.color, "#0C2230", dim) : b.color;
    c = { base, dark: mix(base, "#04111A", 0.3), deep: mix(base, "#04111A", 0.58), light: mix(base, "#FFFFFF", 0.42) };
    _bc.set(k, c);
  }
  return c;
}
function eggPath(g) {
  g.beginPath(); g.moveTo(0, -52);
  g.bezierCurveTo(11, -52, 17.5, -31, 17.5, -17); g.bezierCurveTo(17.5, -5, 9.5, 0, 0, 0);
  g.bezierCurveTo(-9.5, 0, -17.5, -5, -17.5, -17); g.bezierCurveTo(-17.5, -31, -11, -52, 0, -52); g.closePath();
}
function poseSpec(pose, tt, live, G, hc, egg) {
  const sx = egg ? 14 : G.tw / 2 - 2.5, sy = egg ? -24 : -G.th + 6, hw = egg ? 15 : G.hw / 2;
  const w = (f, a = 1) => (live ? Math.sin(tt * f) * a : 0);
  switch (pose) {
    case "type": { const k = w(6); return { expr: "focus", lookY: 1.2, hands: [[-7, -9 - (k > 0.3 ? 1.8 : 0)], [8, -9 - (k < -0.3 ? 1.8 : 0)]] }; }
    case "wave": return { expr: "wide", mouth: "smile", hands: [[-7, -9], [hw + 5 + w(6, 1.8), hc - 7 + Math.abs(w(6, 1.6))]] };
    case "stuck": return { expr: "worried", mouth: "o", sweat: true, hands: [[-hw - 1.5, hc + 3 + w(2.2, 0.7)], [hw + 1.5, hc + 3 - w(2.2, 0.7)]] };
    case "read": return { expr: "focus", lookY: 1.6, prop: "book", hands: [[-11, -12], [11, -12]] };
    case "talk": return { expr: "open", mouth: "talk", hands: [[-sx - 2, -4], [sx + 8 + w(2.6, 1.6), sy - 7 + w(3.1, 3)]] };
    case "listen": return { expr: "open", mouth: "smile", hands: [[-sx - 1.5, -5], [sx + 1.5, -5]] };
    case "sip": return { expr: "happy", mouth: "smile", prop: "cup", hands: [[-sx - 2.5, -3], [6, sy + 2 + w(0.9, 1.2)]] };
    case "sleep": return { expr: "closed", tilt: -0.17, hands: [[-7, -6], [7, -6]] };
    case "walk": return { expr: "open", hands: [[-sx - 3, -3 + w(9, 2.6)], [sx + 3, -3 - w(9, 2.6)]] };
    default: return { expr: "open", hands: [[-sx - 3, -2], [sx + 3, -2]] };
  }
}
const ACC_H = { captain: 11, eyeshade: 0, glasses: 0, safari: 9, bulb: 18, newsboy: 8, shades: 9, antennae: 13, crown: 8, headphones: 3, hardhat: 9, beret: 7, fedora: 11, bowtie: 0, tophat: 16, mirror: 0, antenna: 11 };
function drawBot(g, b, t, o = {}) {
  const cs = b.cast, G = cs.G, egg = !!G.egg;
  const pass = o.pass || "all", live = !o.still && !still();
  const col = botColors(b, o.dim || 0), tt = t / 1000 + b.ph;
  const breath = live ? Math.sin(tt * 1.6) * 0.55 : 0;
  const hc = (egg ? -35 : -(G.th + 2 + G.hh / 2)) + breath;
  const spec = poseSpec(o.pose || "stand", tt, live, G, hc, egg);
  g.lineJoin = "round";
  if (pass !== "arms") {
    if (o.legs) legs(g, col, o.legs, o.pose === "walk" && live ? tt : null);
    if (egg) { eggPath(g); g.fillStyle = col.base; g.fill(); shade(g, -17.5, -52, 35, 52); }
    else {
      shaded(g, -G.tw / 2, -G.th, G.tw, G.th, G.tr, col.base); rim(g, -G.tw / 2, -G.th, G.tw, G.th, G.tr, o.rim);
      chest(g, cs.chest, G, col, o);
      g.fillStyle = "#0A1822"; g.fillRect(-5, -G.th - 3, 10, 4);
    }
    neckwear(g, cs.acc, G, o);
    g.save(); g.translate(0, hc); if (spec.tilt) g.rotate(spec.tilt);
    if (!egg) { ears(g, cs.ears, G, col); shaded(g, -G.hw / 2, -G.hh / 2, G.hw, G.hh, G.hr, col.base); rim(g, -G.hw / 2, -G.hh / 2, G.hw, G.hh, G.hr, o.rim); }
    face(g, b, G, o, spec, tt, live);
    accessory(g, cs.acc, G, o, col);
    g.restore();
  }
  if (pass !== "body") {
    if (spec.prop === "book") book(g, b, tt, live);
    arms(g, col, spec, G, egg);
    if (spec.prop === "cup") cup(g, spec.hands[1], tt, live);
  }
  return { hc, top: hc - (egg ? 17 : G.hh / 2) - ACC_H[cs.acc] };
}
function legs(g, col, mode, tt) {
  g.lineCap = "round"; g.lineWidth = 6; g.strokeStyle = col.deep;
  for (const s of [-1, 1]) {
    let x1 = s * (mode === "sit" ? 7.5 : 5), y1 = mode === "sit" ? 8 : 9;
    if (tt != null) { const k = Math.sin(tt * 9 + (s > 0 ? Math.PI : 0)); y1 -= Math.max(0, k) * 3; x1 += k * 1.5; }
    g.beginPath(); g.moveTo(s * 5, -2); g.lineTo(x1, y1); g.stroke();
    ell(g, x1 + s * 1.2, y1 + 2.4, 4.6, 2.5, "#07141C");
  }
}
function arms(g, col, spec, G, egg) {
  const sx = egg ? 14 : G.tw / 2 - 2.5, sy = egg ? -24 : -G.th + 6;
  g.lineCap = "round"; g.lineWidth = 5.4; g.strokeStyle = col.dark;
  spec.hands.forEach(([hx, hy], i) => {
    const s = i ? 1 : -1, x0 = s * sx;
    g.beginPath(); g.moveTo(x0, sy); g.quadraticCurveTo(x0 + s * 3.5, (sy + hy) / 2 + 2, hx, hy); g.stroke();
    disc(g, hx, hy, 3.4, col.light);
  });
}
function ears(g, kind, G, col) {
  const hw = G.hw / 2;
  if (kind === "bolts") for (const s of [-1, 1]) { disc(g, s * (hw + 0.8), 1, 3, col.dark); disc(g, s * (hw + 0.8), 1, 1.2, col.light); }
  else if (kind === "fins") {
    g.fillStyle = col.dark;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (hw - 2), -5); g.lineTo(s * (hw + 5), -11); g.lineTo(s * (hw + 1.5), 3); g.closePath(); g.fill(); }
  }
}
function chest(g, kind, G, col, o) {
  const tw = G.tw, th = G.th, top = -th, c = (h) => (o.dim ? mix(h, "#0C2230", o.dim) : h);
  const panel = () => { g.fillStyle = rgba(col.light, 0.4); g.beginPath(); rr(g, -tw * 0.24, top + 5, tw * 0.48, th * 0.4, 3); g.fill(); };
  switch (kind) {
    case "none": return;
    case "badge": panel(); g.fillStyle = c(C.amber); g.beginPath(); g.moveTo(-tw * 0.3, top + 5); g.lineTo(-tw * 0.3 + 2.6, top + 8); g.lineTo(-tw * 0.3, top + 11); g.lineTo(-tw * 0.3 - 2.6, top + 8); g.closePath(); g.fill(); return;
    case "pocket":
      g.fillStyle = c("#1B6CA8"); g.fillRect(-tw * 0.28, top + 3.5, 1.6, 6); g.fillStyle = c("#B0245C"); g.fillRect(-tw * 0.28 + 2.6, top + 4.5, 1.6, 5);
      g.fillStyle = rgba(col.light, 0.5); g.beginPath(); rr(g, -tw * 0.36, top + 7, tw * 0.3, th * 0.34, [1, 1, 2.5, 2.5]); g.fill(); return;
    case "dial": disc(g, 0, top + th * 0.46, 4.4, rgba(col.light, 0.75)); g.strokeStyle = c("#0A1822"); g.lineWidth = 1.1; g.beginPath(); g.moveTo(0, top + th * 0.46); g.lineTo(2.6, top + th * 0.46 - 2.2); g.stroke(); return;
    case "stripe": g.save(); g.beginPath(); rr(g, -tw / 2, -th, tw, th, G.tr); g.clip(); g.fillStyle = rgba(col.light, 0.55); g.fillRect(-tw / 2, top + th * 0.36, tw, 3.4); g.restore(); return;
    case "buttons": for (let i = 0; i < 3; i++) disc(g, 0, top + 5 + i * 4.6, 1.4, col.light); return;
    case "zip": g.strokeStyle = rgba(col.light, 0.7); g.lineWidth = 1; g.beginPath(); g.moveTo(0, top + 2); g.lineTo(0, -3); for (let y = top + 4; y < -3; y += 2.6) { g.moveTo(-1.4, y); g.lineTo(1.4, y); } g.stroke(); return;
    case "screen": g.fillStyle = c("#0A1822"); g.beginPath(); rr(g, -6.5, top + 4, 13, 9, 2); g.fill(); g.fillStyle = c(C.bad); g.beginPath(); g.moveTo(-1.8, top + 6.2); g.lineTo(2.8, top + 8.5); g.lineTo(-1.8, top + 10.8); g.closePath(); g.fill(); return;
    default: panel();
  }
}
function face(g, b, G, o, spec, tt, live) {
  const cs = b.cast, vw = G.vw, vh = G.vh, vy = 1;
  g.beginPath(); rr(g, -vw / 2, -vh / 2 + vy, vw, vh, G.vr);
  const vis = o.dim ? "#08131A" : VISOR;
  g.fillStyle = vis; g.fill();
  if (o.lit) { g.fillStyle = `rgba(109,180,229,${(0.22 * o.lit).toFixed(3)})`; g.fill(); }
  g.fillStyle = "rgba(255,255,255,0.08)";
  g.beginPath(); g.moveTo(-vw / 2 + 3, -vh / 2 + vy + 1.5); g.lineTo(-vw / 2 + 8, -vh / 2 + vy + 1.5); g.lineTo(-vw / 2 + 4.5, vh / 2 + vy - 1.5); g.lineTo(-vw / 2 + 1.8, vh / 2 + vy - 1.5); g.closePath(); g.fill();
  const ex = Math.max(5, vw * 0.23), lx = (o.look || 0) * 1.8, ly = (spec.lookY || 0) * (1 - Math.abs(o.look || 0)), expr = spec.expr;
  const blink = live && expr !== "closed" && expr !== "happy" && ((tt * 0.9 + b.ph) % 4.1) < 0.3;
  const eye = o.dim ? "#3E5666" : EYE;
  const single = cs.eyes === "bar" || cs.eyes === "cyclops";
  if (o.glow && !o.dim && cs.eyes !== "none") {
    g.fillStyle = `rgba(150,220,255,${(0.2 * o.glow).toFixed(3)})`;
    if (single) { g.beginPath(); rr(g, -ex - 5 + lx, vy + ly - 5, 2 * ex + 10, 10, 5); g.fill(); }
    else for (const s of [-1, 1]) { g.beginPath(); rr(g, s * ex + lx - 4.2, vy + ly - 4.8, 8.4, 9.6, 4); g.fill(); }
  }
  eyesOf(g, cs.eyes, ex, lx, vy + ly - 0.4, expr, blink, eye, vis, tt, live);
  if (!o.dim && expr !== "worried" && expr !== "closed") {
    g.fillStyle = expr === "focus" ? "rgba(255,128,160,0.28)" : "rgba(255,128,160,0.5)";
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * (ex + 3.4) + lx * 0.8, vy + 3.2, 2, 1.15, 0, 0, TAU); g.fill(); }
  }
  g.fillStyle = eye; g.strokeStyle = eye; g.lineWidth = 1.25;
  if (expr === "worried") { const bx = single ? 3.5 : ex; g.beginPath(); for (const s of [-1, 1]) { g.moveTo(s * (bx + 2) + lx, vy - 3.4 - (single ? 1.6 : 0)); g.lineTo(s * (bx - 3) + lx, vy - 5.3 - (single ? 1.6 : 0)); } g.stroke(); }
  if (expr === "wide" && !single && cs.eyes !== "none") { g.beginPath(); for (const s of [-1, 1]) { g.moveTo(s * ex + lx - 2.4, vy - 4.6); g.quadraticCurveTo(s * ex + lx, vy - 6.4, s * ex + lx + 2.4, vy - 4.6); } g.stroke(); }
  const my = vy + vh / 2 - 3.1;
  mouthOf(g, spec.mouth || cs.mouth, lx * 0.6, my, tt, live);
  if (cs.mouth === "mustache") mustache(g, vy + vh / 2 + 2.3, o.dim ? "#1A120C" : "#2A1A10");
  if (spec.sweat) {
    const x = G.hw / 2 + 3, y = -G.hh / 2 + 2;
    g.fillStyle = "#9AD6F7"; g.beginPath(); g.moveTo(x, y - 4.5); g.quadraticCurveTo(x + 3.2, y + 0.5, x, y + 2); g.quadraticCurveTo(x - 3.2, y + 0.5, x, y - 4.5); g.fill();
  }
}
// Eyes: the bot's own shape; the state only sets the expression (focus, wide, worried, closed, happy).
function eyesOf(g, style, ex, lx, y0, expr, blink, col, vis, tt, live) {
  if (style === "none") return;
  const single = style === "bar" || style === "cyclops", xs = single ? [0] : [-ex, ex];
  g.fillStyle = col; g.strokeStyle = col; g.lineCap = "round";
  for (const bx of xs) {
    const x = bx + lx, y = y0, s = Math.sign(bx) || 1;
    if (expr === "closed" || expr === "happy") {
      const r = single ? (style === "bar" ? ex + 2 : 4.2) : 2.4, up = expr === "happy";
      g.lineWidth = up ? 1.7 : 1.5; g.beginPath();
      if (up) g.arc(x, y + (single ? 3 : 1.6), r, Math.PI + 0.4, -0.4); else g.arc(x, y - (single ? 2 : 1.4), r, 0.3, Math.PI - 0.3);
      g.stroke(); continue;
    }
    if (blink) { const w = style === "bar" ? 2 * ex + 6 : style === "cyclops" ? 9 : 4.4; g.fillRect(x - w / 2, y, w, 1.3); continue; }
    const k = expr === "wide" ? 1.18 : 1, f = expr === "focus" ? 0.62 : 1, dy = expr === "focus" ? 0.6 : 0;
    switch (style) {
      case "dot": g.beginPath(); g.ellipse(x, y + dy, 2.2 * k, 2.2 * k * f, 0, 0, TAU); g.fill(); break;
      case "pixel": { const q = 4.4 * k; g.fillRect(x - q / 2, y - (q * f) / 2 + dy, q, q * f); break; }
      case "oval": case "lash":
        g.beginPath(); g.ellipse(x, y + dy, 2.3 * k, 3.4 * k * f, 0, 0, TAU); g.fill();
        g.fillStyle = vis; g.beginPath(); g.arc(x + 0.8, y - 1.1 * f + dy, 0.95, 0, TAU); g.fill(); g.fillStyle = col;
        if (style === "lash") { g.lineWidth = 1; g.beginPath(); g.moveTo(x + s * 1.7, y - 2.6 * f + dy); g.lineTo(x + s * 3.5, y - 4.3 * f + dy); g.moveTo(x + s * 0.3, y - 3.3 * f + dy); g.lineTo(x + s * 1.1, y - 5.4 * f + dy); g.stroke(); }
        break;
      case "wide":
        g.beginPath(); g.ellipse(x, y + dy, 3.2 * k, 3.4 * k * f, 0, 0, TAU); g.fill();
        g.fillStyle = vis; g.beginPath(); g.arc(x + 0.7 + lx * 0.2, y + 0.4 * f + dy, 1.5 * f, 0, TAU); g.fill(); g.fillStyle = col;
        break;
      case "bar": {
        const w = 2 * ex + 7, h = 3.4 * k * f;
        g.beginPath(); rr(g, x - w / 2, y - h / 2 + dy, w, h, h / 2); g.fill();
        // a scanner light running along the bar, like a newsroom ticker
        const p = live ? ((tt * 0.7) % 1) : 0.5; g.fillStyle = vis; g.globalAlpha = 0.55; g.fillRect(x - w / 2 + 1 + p * (w - 5), y - h / 2 + dy, 2.2, h); g.globalAlpha = 1; g.fillStyle = col;
        break;
      }
      case "cyclops":
        g.beginPath(); g.ellipse(x, y + dy, 5 * k, 5 * k * f, 0, 0, TAU); g.fill();
        g.fillStyle = vis; g.beginPath(); g.arc(x + lx * 0.5, y + dy + 0.3, 2.1 * f, 0, TAU); g.fill();
        g.fillStyle = col; g.beginPath(); g.arc(x + lx * 0.5 + 0.8, y + dy - 0.6, 0.6, 0, TAU); g.fill();
        break;
      default: {        // "round" and "monocle"
        const ew = expr === "wide" ? 4.6 : 4, eh = expr === "focus" ? 3.2 : expr === "wide" ? 6 : 5;
        g.beginPath(); rr(g, x - ew / 2, y - eh / 2 + dy, ew, eh, 1.8); g.fill();
        if (style === "monocle" && s > 0) {
          g.strokeStyle = "#E3B04B"; g.lineWidth = 1.3; g.beginPath(); g.arc(x, y + dy, 4.4, 0, TAU); g.stroke();
          g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + 3, y + 3.5); g.quadraticCurveTo(x + 5, y + 9, x + 2, y + 13); g.stroke(); g.strokeStyle = col;
        }
      }
    }
  }
}
function mouthOf(g, kind, x, my, tt, live) {
  g.lineCap = "round";
  switch (kind) {
    case "smile": g.lineWidth = 1.3; g.beginPath(); g.arc(x, my - 2.4, 2.3, 0.55, Math.PI - 0.55); g.stroke(); break;
    case "talk": { const k = live ? (Math.sin(tt * 11) + 1) / 2 : 0.5; g.beginPath(); g.ellipse(x, my - 0.6, 2.1, 0.5 + k * 1.2, 0, 0, TAU); g.fill(); break; }
    case "o": g.lineWidth = 1.2; g.beginPath(); g.arc(x, my - 0.7, 1.3, 0, TAU); g.stroke(); break;
    case "line": g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 2, my - 0.8); g.lineTo(x + 2, my - 0.8); g.stroke(); break;
    case "grin": g.beginPath(); g.moveTo(x - 3.6, my - 1.9); g.quadraticCurveTo(x, my + 2, x + 3.6, my - 1.9); g.closePath(); g.fill(); break;
    case "w": g.lineWidth = 1.1; g.beginPath(); g.arc(x - 1.2, my - 1.7, 1.2, 0.25, Math.PI - 0.25); g.moveTo(x + 2.4, my - 1.7); g.arc(x + 1.2, my - 1.7, 1.2, 0.25, Math.PI - 0.25); g.stroke(); break;
    case "smirk": g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 2, my - 1.2); g.quadraticCurveTo(x + 0.8, my + 0.2, x + 3, my - 2); g.stroke(); break;
    case "small": g.lineWidth = 1.1; g.beginPath(); g.arc(x, my - 1.8, 1.3, 0.4, Math.PI - 0.4); g.stroke(); break;
    case "grill": g.lineWidth = 0.8; g.strokeRect(x - 3.6, my - 2.8, 7.2, 2.6); g.beginPath(); for (const d of [-1.2, 1.2]) { g.moveTo(x + d, my - 2.8); g.lineTo(x + d, my - 0.2); } g.stroke(); break;
    default: break;
  }
}
function mustache(g, y, col) {
  g.fillStyle = col; g.beginPath();
  for (const s of [-1, 1]) {
    g.moveTo(0, y - 0.8);
    g.bezierCurveTo(s * 2.5, y - 2.2, s * 6.5, y - 1.6, s * 7.6, y + 0.4);
    g.bezierCurveTo(s * 8.6, y + 1.8, s * 9.8, y + 0.4, s * 9.6, y - 1.2);
    g.bezierCurveTo(s * 9.2, y + 3.6, s * 3.4, y + 3.4, 0, y + 1.4);
  }
  g.fill();
}
function neckwear(g, acc, G, o) {
  const top = -G.th, c = (h) => (o.dim ? mix(h, "#0C2230", o.dim) : h);
  if (acc === "fedora") {        // collar and tie
    g.fillStyle = c("#F3EFE3");
    g.beginPath(); g.moveTo(-6, top); g.lineTo(-0.5, top + 4.5); g.lineTo(-1.5, top); g.closePath(); g.moveTo(6, top); g.lineTo(0.5, top + 4.5); g.lineTo(1.5, top); g.closePath(); g.fill();
    g.fillStyle = c("#C8364E"); g.beginPath(); rr(g, -2, top + 0.5, 4, 3.2, 1); g.fill();
    g.beginPath(); g.moveTo(-1.8, top + 3.5); g.lineTo(1.8, top + 3.5); g.lineTo(3, top + 13); g.lineTo(0, top + 16); g.lineTo(-3, top + 13); g.closePath(); g.fill();
  } else if (acc === "bowtie") {
    g.fillStyle = c(C.amber);
    g.beginPath(); g.moveTo(0, top + 1); g.lineTo(-7, top - 2.5); g.lineTo(-7, top + 4.5); g.closePath(); g.moveTo(0, top + 1); g.lineTo(7, top - 2.5); g.lineTo(7, top + 4.5); g.closePath(); g.fill();
    disc(g, 0, top + 1, 1.9, c("#C98A2E"));
  }
}
function paint(g, col, x, y, w, h, k) { g.fillStyle = col; g.fill(); shade(g, x, y, w, h, k); }
function accessory(g, acc, G, o, col) {
  const hw = G.hw, egg = !!G.egg, top = egg ? -17 : -G.hh / 2, c = (h) => (o.dim ? mix(h, "#0C2230", o.dim) : h);
  const ex = Math.max(5, G.vw * 0.23);
  switch (acc) {
    case "captain": {             // Muddy: a harbour captain's cap
      const w = hw * 0.98, y = top + 3;
      g.beginPath(); g.moveTo(-w / 2 + 3, y); g.bezierCurveTo(-w / 2 - 3, y - 8, -w / 2 + 2, y - 13, 0, y - 13); g.bezierCurveTo(w / 2 - 2, y - 13, w / 2 + 3, y - 8, w / 2 - 3, y); g.closePath();
      paint(g, c("#F3EFE3"), -w / 2, y - 13, w, 13);
      g.fillStyle = c("#0B2F48"); g.fillRect(-w / 2 + 3, y - 4.2, w - 6, 4.2);
      g.fillStyle = c("#06121A"); g.beginPath(); g.ellipse(0, y, w * 0.38, 3.4, 0, 0, Math.PI); g.fill();
      g.fillStyle = c(C.amber); g.beginPath(); g.moveTo(0, y - 11); g.lineTo(2.6, y - 7.5); g.lineTo(0, y - 5.2); g.lineTo(-2.6, y - 7.5); g.closePath(); g.fill();
      break;
    }
    case "glasses": {             // Atlas: round reading glasses and a tuft of antenna
      g.strokeStyle = c("#F6CF7E"); g.lineWidth = 1.5;
      for (const s of [-1, 1]) { g.beginPath(); g.arc(s * ex, 0.7, 4.7, 0, TAU); g.stroke(); }
      g.beginPath(); g.moveTo(-ex + 4.7, 0.2); g.quadraticCurveTo(0, -1.8, ex - 4.7, 0.2); g.stroke();
      g.beginPath(); g.moveTo(-ex - 4.7, 0); g.lineTo(-hw / 2, -1.5); g.moveTo(ex + 4.7, 0); g.lineTo(hw / 2, -1.5); g.stroke();
      g.strokeStyle = "#0A1822"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(3, top); g.quadraticCurveTo(4, top - 5, 8, top - 7); g.stroke(); disc(g, 8.5, top - 7.5, 2.4, col.light);
      break;
    }
    case "bulb": {                // Spark: an idea, always on
      g.strokeStyle = "#0A1822"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, top); g.lineTo(0, top - 6); g.stroke();
      g.fillStyle = c("#9AA7AE"); g.beginPath(); rr(g, -2.8, top - 9.5, 5.6, 4, 1); g.fill();
      disc(g, 0, top - 14, 5.4, o.dim ? "#6F6A58" : "#FFE6A3");
      disc(g, -1.6, top - 15.6, 1.5, "rgba(255,255,255,.75)");
      break;
    }
    case "safari": {              // Scout: pith helmet
      const y = top + 3;
      g.beginPath(); g.ellipse(0, y, hw * 0.5, 12, 0, Math.PI, 0); g.closePath(); paint(g, c("#D9C69A"), -hw / 2, y - 12, hw, 12);
      g.fillStyle = c("#6E5232"); g.fillRect(-hw * 0.5, y - 3.2, hw, 3.2);
      ell(g, 0, y + 0.5, hw * 0.68, 3, c("#BFA877"));
      break;
    }
    case "newsboy": {             // Wire: flat cap
      const y = top + 2;
      g.beginPath(); g.ellipse(-1, y - 4, hw * 0.56, 6.5, -0.05, 0, TAU); paint(g, c("#6A5A48"), -hw / 2, y - 10, hw, 12);
      g.fillStyle = c("#40352A"); g.beginPath(); g.ellipse(2, y + 0.8, hw * 0.44, 3.2, 0, 0, Math.PI); g.fill();
      disc(g, -1, y - 10, 1.9, c("#40352A"));
      break;
    }
    case "shades": {              // Hype: sunglasses and a quiff
      g.fillStyle = "#03080C";
      g.beginPath(); rr(g, -ex - 6, -2.8, 12, 7.2, [2, 2, 4.5, 4.5]); rr(g, ex - 6, -2.8, 12, 7.2, [2, 2, 4.5, 4.5]); g.fill();
      g.fillRect(-ex + 5, -2.4, 2 * ex - 10, 1.8);
      g.fillStyle = "rgba(255,255,255,.45)"; g.beginPath(); g.moveTo(-ex - 3.5, -1.4); g.lineTo(-ex - 1.5, -1.4); g.lineTo(-ex - 3.2, 2.4); g.closePath(); g.moveTo(ex - 3.5, -1.4); g.lineTo(ex - 1.5, -1.4); g.lineTo(ex - 3.2, 2.4); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-9, top + 1.5); g.bezierCurveTo(-9, top - 9, 5, top - 13, 13, top - 7); g.bezierCurveTo(7, top - 6.5, 4, top - 3, 7, top + 1.5); g.closePath();
      paint(g, col.dark, -9, top - 13, 22, 14);
      break;
    }
    case "antennae": {            // Buzz: two bouncy antennae
      g.strokeStyle = "#0A1822"; g.lineWidth = 1.6;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 6, top + 1); g.quadraticCurveTo(s * 7, top - 7, s * 12, top - 10); g.stroke(); disc(g, s * 12.4, top - 10.6, 3.1, c(C.amber)); }
      break;
    }
    case "crown": {               // Rank: number one
      const y = top + 1.5, w = 11;
      g.beginPath(); g.moveTo(-w, y); g.lineTo(-w, y - 6.5); g.lineTo(-w / 2, y - 2.6); g.lineTo(0, y - 9.5); g.lineTo(w / 2, y - 2.6); g.lineTo(w, y - 6.5); g.lineTo(w, y); g.closePath();
      paint(g, c("#F7C04A"), -w, y - 9.5, 2 * w, 9.5);
      g.fillStyle = c("#C98A2E"); g.fillRect(-w, y - 2.2, 2 * w, 2.2);
      disc(g, 0, y - 9.5, 1.5, c(C.bad)); disc(g, -w, y - 6.5, 1.2, c("#FFF3D6")); disc(g, w, y - 6.5, 1.2, c("#FFF3D6"));
      break;
    }
    case "headphones": {          // Reel: studio headphones
      g.strokeStyle = c("#15252F"); g.lineWidth = 3.4; g.beginPath(); g.arc(0, 1, hw / 2 + 1.5, Math.PI * 1.06, Math.PI * 1.94); g.stroke();
      for (const s of [-1, 1]) { shaded(g, s * (hw / 2 + 1.5) - 4.2, -6, 8.4, 14, 3.8, c("#1E2E38")); g.fillStyle = c(C.bad); g.fillRect(s * (hw / 2 + 1.5) - 1, -3.5, 2, 9); }
      break;
    }
    case "hardhat": {             // Forge: builds things
      const y = top + 4;
      g.beginPath(); g.ellipse(0, y, hw * 0.52, 12.5, 0, Math.PI, 0); g.closePath(); paint(g, c("#F5B82E"), -hw / 2, y - 12.5, hw, 12.5);
      g.fillStyle = c("#FFD775"); g.beginPath(); rr(g, -2.3, y - 12.4, 4.6, 12, 2); g.fill();
      ell(g, 0, y + 0.6, hw * 0.64, 2.9, c("#D9961C"));
      break;
    }
    case "beret": {               // Pixel: the designer, with a pencil
      g.save(); g.translate(2.5, top + 1.2); g.rotate(-0.2);
      g.beginPath(); g.ellipse(0, -2.2, hw * 0.55, 6.6, 0, 0, TAU); paint(g, c("#22306A"), -hw * 0.55, -8.8, hw * 1.1, 13.2);
      g.fillStyle = c("#22306A"); g.fillRect(-1.1, -12.4, 2.2, 4);
      g.restore();
      g.save(); g.translate(hw / 2 + 1, -2); g.rotate(0.5); g.fillStyle = c("#F7C04A"); g.fillRect(-1.2, -9, 2.4, 11); g.fillStyle = c("#F3B8A0"); g.fillRect(-1.2, -9, 2.4, 2); g.restore();
      break;
    }
    case "fedora": {              // Closer: the salesman's hat
      const y = top + 2;
      g.beginPath(); g.moveTo(-hw * 0.36, y); g.lineTo(-hw * 0.3, y - 10); g.quadraticCurveTo(0, y - 14, hw * 0.3, y - 10); g.lineTo(hw * 0.36, y); g.closePath();
      paint(g, c("#2B3038"), -hw * 0.36, y - 13, hw * 0.72, 13);
      g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y - 12); g.lineTo(0, y - 8); g.stroke();
      g.fillStyle = c("#C9A15A"); g.fillRect(-hw * 0.35, y - 3.8, hw * 0.7, 3);
      ell(g, 0, y + 0.6, hw * 0.66, 3.2, c("#1E2227"));
      break;
    }
    case "eyeshade": {            // Ledger: accountant's green eyeshade and specs
      const y = top + 5;
      g.fillStyle = c("#15573A"); g.fillRect(-hw / 2, y - 3, hw, 3.2);
      g.fillStyle = o.dim ? "rgba(40,110,80,.55)" : "rgba(52,196,116,.78)";
      g.beginPath(); g.moveTo(-hw * 0.55, y); g.lineTo(hw * 0.55, y); g.lineTo(hw * 0.4, y + 5.5); g.lineTo(-hw * 0.4, y + 5.5); g.closePath(); g.fill();
      g.strokeStyle = c("#E8E2D0"); g.lineWidth = 1.2;
      for (const s of [-1, 1]) { g.beginPath(); rr(g, s * ex - 4, 0.8, 8, 5.5, 2.2); g.stroke(); }
      break;
    }
    case "bowtie": {              // Clerk: neat parting, pencil behind the ear
      g.beginPath(); g.moveTo(-hw / 2 + 0.5, top + 8); g.bezierCurveTo(-hw / 2 - 1, top - 3, 3, top - 5, hw / 2, top + 3); g.quadraticCurveTo(1, top + 1, -hw / 2 + 4, top + 9); g.closePath();
      paint(g, c("#3F4753"), -hw / 2, top - 5, hw, 14);
      g.save(); g.translate(hw / 2 + 0.5, -3); g.rotate(0.45); g.fillStyle = c("#F7C04A"); g.fillRect(-1.2, -9, 2.4, 11); g.fillStyle = c("#E8A0A0"); g.fillRect(-1.2, -9, 2.4, 2); g.restore();
      break;
    }
    case "tophat": {              // Ticker: markets, strictly for research
      const y = top + 2;
      ell(g, 0, y, hw * 0.6, 2.9, c("#11161C"));
      g.beginPath(); rr(g, -hw * 0.31, y - 17, hw * 0.62, 17, [2, 2, 0, 0]); paint(g, c("#1B222B"), -hw * 0.31, y - 17, hw * 0.62, 17);
      g.fillStyle = c("#F3EFE3"); g.fillRect(-hw * 0.31, y - 5.2, hw * 0.62, 3);
      break;
    }
    case "mirror": {              // dr eggbot: a doctor's head mirror
      g.strokeStyle = c("#22303A"); g.lineWidth = 2.6; g.beginPath(); g.moveTo(-13.5, -9); g.quadraticCurveTo(0, -14.5, 13.5, -9); g.stroke();
      disc(g, -2, -13, 6.2, c("#D4DCE0")); disc(g, -2, -13, 4.2, c("#AEBBC2")); disc(g, -2, -13, 1.5, c("#22303A"));
      disc(g, -3.8, -15, 1.3, "rgba(255,255,255,.8)");
      break;
    }
    default: {
      g.strokeStyle = "#0A1822"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, top); g.lineTo(0, top - 7); g.stroke();
      disc(g, 0, top - 9, 2.9, col.light);
    }
  }
}
function book(g, b, tt, live) {
  g.fillStyle = BOOKS[b.h % BOOKS.length]; g.beginPath(); rr(g, -15, -22, 30, 16, 2); g.fill();
  g.fillStyle = "#F4EFE2"; g.beginPath(); g.moveTo(-14, -20); g.quadraticCurveTo(-7, -22.5, 0, -19.5); g.lineTo(0, -7.5); g.quadraticCurveTo(-7, -10, -14, -8); g.closePath(); g.fill();
  g.fillStyle = "#E6DECB"; g.beginPath(); g.moveTo(14, -20); g.quadraticCurveTo(7, -22.5, 0, -19.5); g.lineTo(0, -7.5); g.quadraticCurveTo(7, -10, 14, -8); g.closePath(); g.fill();
  g.strokeStyle = "rgba(11,47,72,.28)"; g.lineWidth = 0.7; g.beginPath();
  for (let i = 0; i < 4; i++) { const y = -17 + i * 2.6; g.moveTo(-12, y + 0.4); g.lineTo(-2.5, y); g.moveTo(2.5, y); g.lineTo(12, y + 0.4); }
  g.stroke();
  const ph = live ? (tt * 0.13 + b.ph) % 1 : 1;
  if (ph < 0.08) {                 // turning a page
    const k = ph / 0.08, px = 14 * Math.cos(k * Math.PI);
    g.fillStyle = "#FBF8EE"; g.beginPath(); g.moveTo(0, -19.5); g.quadraticCurveTo(px * 0.5, -22 - Math.sin(k * Math.PI) * 3, px, -20); g.lineTo(px, -8); g.quadraticCurveTo(px * 0.5, -10, 0, -7.5); g.closePath(); g.fill();
  }
}
function cup(g, [hx, hy], tt, live) {
  g.fillStyle = "#F3EFE3"; g.beginPath(); rr(g, hx - 3.6, hy - 7.5, 7.2, 8.5, [1, 1, 2.6, 2.6]); g.fill();
  g.fillStyle = C.sea; g.fillRect(hx - 3.6, hy - 5, 7.2, 1.7);
  g.strokeStyle = "#F3EFE3"; g.lineWidth = 1.3; g.beginPath(); g.arc(hx + 4, hy - 3.6, 2, -1.2, 1.2); g.stroke();
  steam(g, hx, hy - 9, tt, live, 0.55);
}
function steam(g, x, y, tt, live, a = 0.5, n = 2, hgt = 10) {
  g.lineWidth = 1.3; g.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const k = live ? (tt * 0.55 + i / n) % 1 : 0.35 + i * 0.3, yy = y - k * hgt, xx = x - 2 + i * 3.5, wv = live ? Math.sin(tt * 2 + i) * 1.2 : 0;
    g.strokeStyle = `rgba(243,239,227,${(a * Math.sin(k * Math.PI)).toFixed(3)})`;
    g.beginPath(); g.moveTo(xx, yy); g.bezierCurveTo(xx - 2 + wv, yy - 2.5, xx + 2 - wv, yy - 4.5, xx + wv * 0.5, yy - 7); g.stroke();
  }
}

/* ---------- the light: Aruba's sky by the hour ---------- */
const SKY = [
  // hour  sky top    sky mid    horizon    sea far    sea near   day  lamps stars
  [0,    "#030C14", "#081B29", "#14324A", "#0A2231", "#061520", 0,    1,   1],
  [5.4,  "#030C14", "#081B29", "#14324A", "#0A2231", "#061520", 0,    1,   1],
  [6.2,  "#1B3150", "#7A5A7E", "#F0A060", "#3A5670", "#1C3246", 0.4,  0.8, 0.2],
  [7.3,  "#4E9CD8", "#93C9EE", "#E2F2F9", "#23A8B9", "#0F7C94", 1,    0,   0],
  [16.4, "#4E9CD8", "#93C9EE", "#E2F2F9", "#23A8B9", "#0F7C94", 1,    0,   0],
  [17.9, "#3E6E9E", "#E0A472", "#FBCB7C", "#3E8196", "#1E5A70", 0.8,  0.3, 0],
  [18.7, "#1F2F58", "#B45A5E", "#F4924A", "#35526C", "#1B3248", 0.45, 0.8, 0.1],
  [19.4, "#0A1D33", "#1A3552", "#4A5470", "#10293B", "#0A1C29", 0.12, 1,   0.6],
  [20.1, "#030C14", "#081B29", "#14324A", "#0A2231", "#061520", 0,    1,   1],
  [24,   "#030C14", "#081B29", "#14324A", "#0A2231", "#061520", 0,    1,   1],
];
function timeLook(hf) {
  let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= hf) i++;
  const a = SKY[i], b = SKY[i + 1], k = clamp((hf - a[0]) / (b[0] - a[0] || 1), 0, 1);
  const c = (j) => mix(a[j], b[j], k), n = (j) => lerp(a[j], b[j], k);
  // the sun: how high it stands (0 at 6:15 and 18:40, 1 at 12:30), for the light it throws indoors
  const sun = clamp(Math.sin(((hf - 6.25) / 12.4) * Math.PI), 0, 1);
  return { hf, skyTop: c(1), skyMid: c(2), horizon: c(3), seaFar: c(4), seaNear: c(5), day: n(6), lamps: n(7), stars: n(8), sun };
}
// Inside: a lamplit dark room at night, sun-bleached plaster and honey-coloured boards by day.
function interior(T) {
  const d = T.day * T.day * (3 - 2 * T.day);   // eased, so dusk doesn't sit in a grey middle for long
  return {
    d, ceil: mix("#030B11", "#EFE8D8", d), wallTop: mix("#061520", "#F4EDDD", d), wallBot: mix("#0D2838", "#E2D5BA", d),
    frame: mix("#030A10", "#14232C", d), frameHi: mix("#1A3444", "#5E7482", d),
    floorFar: mix("#0F2A39", "#DCC7A0", d), floorNear: mix("#081A25", "#B8976A", d),
    woodTop: mix("#C99A66", "#C9925A", d), woodEdge: mix("#7C5433", "#855A31", d), woodDark: mix("#3E2A1D", "#5B3E28", d),
    leg: mix("#05111A", "#2B2520", d), chair: mix("#163A4E", "#2C6C8A", d), chairSeat: mix("#1D4860", "#3C82A3", d),
    shelf: mix("#2B1E17", "#6A4A34", d), shadow: d > 0.5 ? "rgba(70,45,20,0.2)" : "rgba(1,7,11,0.36)",
    line: d > 0.5 ? "rgba(90,60,30,0.09)" : "rgba(255,255,255,0.03)", batten: d > 0.5 ? "rgba(120,95,60,0.1)" : "rgba(255,255,255,0.028)",
  };
}
// The real moon, from a known new moon (2000-01-06 18:14 UTC).
const moonPhase = () => (((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % 29.530588853 + 29.530588853) % 29.530588853 / 29.530588853;

/* ---------- the studio ---------- */
const Scene = (() => {
  const host = $("#scene"), hero = $("#hero"), cv = $("#stage"), g = cv.getContext("2d"), hitList = $("#hits"), card = $("#card");
  // DPR: the live canvas, where the words and the bots are drawn, at the screen's own sharpness (up to 3x).
  // LDPR: the painted set (sky, room, lamplight), soft already, kept at 2x to save memory and time.
  let W = 0, H = 0, DPR = 1, LDPR = 1, L = null, T = timeLook(20), P = interior(T), lookMin = -1;
  const layers = { sky: document.createElement("canvas"), room: document.createElement("canvas") };
  let bots = [], byId = new Map(), divisions = [], selId = null, focusId = null, plan = [], planDirty = true, teamKey = "";
  let alertMap = new Map();            // bot id -> { kind: "ask" | "stuck", text }: what it needs from you
  let turn = 0, planAt = 0, frameNow = 0, shownIds = new Set();   // the routine bubbles take turns
  let raf = 0, timer = 0, lastT = 0, started = 0;
  const T0 = performance.now();
  const flagged = (b) => b.state === "stuck" || b.state === "waiting" || alertMap.has(b.id);

  /* where the page's words sit: over the sky on a phone, in a column on the left on a big screen */
  function hudBox() {
    const hr = host.getBoundingClientRect(), side = W >= 1000, el = $(side ? "#side" : "#hud"), tb = $("#topbar");
    const topH = tb ? Math.round(tb.getBoundingClientRect().bottom - hr.top) : 52;
    const r = el ? el.getBoundingClientRect() : null;
    if (!r || (!r.width && !r.height)) return { side, bottom: topH, right: 0, topH, textBottom: topH };
    // over the sky (a phone): where the words themselves end, so the sun, moon and birds stay below them
    let textBottom = topH;
    if (!side) for (const e of ["#answer", "#sub", "#cta", "#hint"].map((q) => $(q))) if (e && !e.hidden && e.offsetParent) textBottom = Math.max(textBottom, Math.round(e.getBoundingClientRect().bottom - hr.top));
    return { side, bottom: Math.round(r.bottom - hr.top), right: Math.round(r.right - hr.left), topH, textBottom };
  }
  const sameHud = (a, b) => a.bottom === b.bottom && a.right === b.right && a.topH === b.topH && a.textBottom === b.textBottom;
  const teamName = (n) => (n ? n.charAt(0).toUpperCase() + n.slice(1) : "Everyone else");

  /* layout: where every desk, chair and lamp goes, for this size of screen */
  function layout() {
    const hb = hudBox(), side = hb.side, wide = W >= 760;
    const rx0 = side ? clamp(hb.right + 8, 0, W * 0.5) : 0, RW = W - rx0;
    const S = side ? clamp(Math.min(RW / 700, H / 540), 0.95, 1.6)
      : wide ? clamp(Math.min(W / 820, H / 660), 0.95, 1.4)
      : clamp(Math.min(W / 372, H / 700), 0.8, 1.15);
    let winTop, winBot, horizon, floorY;
    if (side) {
      winTop = Math.max(hb.topH + 4, Math.round(64 + 4 * S)); floorY = Math.round(H * 0.4); winBot = Math.round(floorY - 36 * S);
      horizon = Math.round(winTop + (winBot - winTop) * 0.55);
    } else {
      // the headline sits on the sky; the harbour shows just below it
      winTop = Math.max(44, hb.topH + 2);
      horizon = Math.round(clamp(hb.bottom + 18, winTop + 70, H * 0.52));
      winBot = Math.round(horizon + clamp((H - horizon) * 0.2, 46, 110));
      floorY = Math.round(winBot + 34 * S);
    }
    const zs = S * 0.84, zoneY = Math.round(floorY + (wide ? 46 : 44) * S);
    const frontY = H - (side ? 28 : wide ? 22 : 12);
    const margin = side ? Math.round(24 * S) : wide ? Math.round(36 * S) : 12;
    const wl = rx0 + (side ? 16 : margin), wr = W - margin, spanW = wr - wl;
    const windows = [];
    if (wide) { const pillar = Math.round(34 * S), n = spanW > 1250 ? 4 : spanW > 880 ? 3 : 2, ww = (spanW - pillar * (n - 1)) / n; for (let i = 0; i < n; i++) windows.push({ x: Math.round(wl + i * (ww + pillar)), y: winTop, w: Math.round(ww), h: winBot - winTop }); }
    else windows.push({ x: wl, y: winTop, w: spanW, h: winBot - winTop });

    // Teams sit together, packed into as few balanced rows as fit; with many bots, everyone gets a little smaller.
    const order = divisions.map((d) => d.id);
    for (const b of bots) if (!order.includes(b.division)) order.push(b.division);
    const groups = [];
    for (const id of order) {
      const ids = bots.filter((b) => b.division === id).map((b) => b.id);
      if (!ids.length) continue;
      const d = divisions.find((x) => x.id === id);
      groups.push({ id, name: teamName((d && d.name) || id).slice(0, 40), ids, n: ids.length });
    }
    // the lounge: a hammock and a beanbag for whoever's off duty (while the office has room for it)
    if (bots.length && bots.length <= 30) groups.push({ id: "\0lounge", name: "", ids: [], n: 2, lounge: true });
    const pack = (cap) => {
      const chunks = [];
      for (const gr of groups) {
        if (gr.lounge) { chunks.push(gr); continue; }
        for (let i = 0; i < gr.ids.length; i += cap) { const ids = gr.ids.slice(i, i + cap); chunks.push({ ...gr, ids, n: ids.length }); }
      }
      const total = chunks.reduce((a, c) => a + c.n, 0);
      let n = Math.max(1, Math.ceil(total / cap)), rows = [];
      for (let guard = 0; guard < 60; guard++) {
        rows = Array.from({ length: n }, () => ({ groups: [], n: 0 }));
        let ok = true;
        for (const c of [...chunks].sort((a, b) => b.n - a.n)) {
          const r = rows.filter((r) => r.n + c.n <= cap).sort((a, b) => a.n - b.n)[0];
          if (!r) { ok = false; break; }
          r.groups.push(c); r.n += c.n;
        }
        if (ok) break; n++;
      }
      rows = rows.filter((r) => r.n);
      const rank = (c) => (c.lounge ? 1e3 : order.indexOf(c.id));
      rows.forEach((r) => r.groups.sort((a, b) => rank(a) - rank(b)));
      const front = (r) => (r.groups.some((c) => !c.lounge && c.id === order[0]) ? 1 : 0);   // the chief of staff's row sits nearest to you
      rows.sort((a, b) => front(a) - front(b));
      return rows;
    };
    const sp0 = wide ? 62 : 54, PAD = 10, GAP = wide ? 30 : 14, SPMIN = 44;
    const units = (r, sp) => r.groups.reduce((a, c) => a + c.n * sp + PAD * 2, 0) + GAP * (r.groups.length - 1);
    const availW = RW - (side ? 32 : wide ? 40 : 14), room = Math.max(60, frontY - zoneY);
    let best = null;
    if (groups.some((c) => !c.lounge)) for (const cap of wide ? [6, 7, 8, 9, 10, 11, 12, 14, 16] : [6, 7, 8, 9, 10, 12]) {
      const rows = pack(cap);
      // a tablet stood upright has floor to spare: its bots may grow a little past the room's own scale
      const s = Math.min(wide && !side ? S * 1.3 : S, ...rows.map((r) => availW / units(r, SPMIN)), room / (rows.length * 76));
      // as big as they fit; among equals, about one row per 120px of floor so the room neither crowds nor gapes
      const fit = Math.abs(rows.length - room / (120 * s));
      if (!best || s > best.s + 0.02 || (s > best.s - 0.02 && fit < best.fit - 0.01)) best = { s, rows, fit };
    }
    const benches = [];
    if (best) {
      const rows = best.rows, pitch = room / rows.length;
      rows.forEach((r, i) => {
        r.y = Math.round(frontY - (rows.length - 1 - i) * pitch);
        const s = best.s * (rows.length === 1 ? 1 : lerp(0.9, 1, i / (rows.length - 1)));
        const over = r.groups.length * PAD * 2 + GAP * (r.groups.length - 1);
        const sp = clamp((availW / s - over) / r.n, SPMIN * 0.9, sp0);
        let x = rx0 + RW / 2 - (units(r, sp) * s) / 2;
        for (const c of r.groups) {
          const w = (c.n * sp + PAD * 2) * s, bn = { id: c.id, name: c.name, lounge: !!c.lounge, labelDx: 0, x0: x, x1: x + w, y: r.y, s };
          bn.seats = c.lounge
            ? [{ key: "lounge:0", kind: "hammock", bench: true, x: x + w * 0.36, y: r.y, s, span: (w / s) * 0.66 },
               { key: "lounge:1", kind: "beanbag", bench: true, x: x + w * 0.8, y: r.y - 2 * s, s: s * 0.9 }]
            : c.ids.map((id, j) => ({ key: "desk:" + id, kind: "desk", bench: true, id, x: x + (PAD + sp * (j + 0.5)) * s, y: r.y, s }));
          for (const st of bn.seats) st.benchRef = bn;
          benches.push(bn);
          x += w + GAP * s;
        }
      });
    }
    const frontS = benches.length ? Math.max(...benches.map((b) => b.s)) : S;
    const firstY = benches.length ? Math.min(...benches.map((b) => b.y)) : frontY;

    // The back of the room: library on the left, the round table, the coffee bar.
    const zx = { lib: rx0 + RW * (wide ? 0.15 : 0.17), meet: rx0 + RW * (wide ? 0.44 : 0.5), cafe: rx0 + RW * 0.8 };
    const zsd = (u) => u * zs;
    const lib = { x: zx.lib, y: zoneY, seats: [
      { key: "lib:0", kind: "armchair", x: zx.lib - zsd(24), y: zoneY, s: zs },
      { key: "lib:1", kind: "beanbag", x: zx.lib + zsd(30), y: zoneY + zsd(6), s: zs },
      ...(wide ? [{ key: "lib:2", kind: "shelf", x: zx.lib + zsd(76), y: zoneY - zsd(10), s: zs * 0.97 }] : []) ] };
    const meet = { x: zx.meet, y: zoneY + zsd(4), seats: [
      { key: "meet:0", kind: "back", x: zx.meet, y: zoneY - zsd(8), s: zs, look: 0 },
      { key: "meet:1", kind: "side", x: zx.meet - zsd(58), y: zoneY + zsd(8), s: zs, look: 1 },
      { key: "meet:2", kind: "side", x: zx.meet + zsd(58), y: zoneY + zsd(8), s: zs, look: -1 },
      { key: "meet:3", kind: "back", x: zx.meet - zsd(28), y: zoneY - zsd(9), s: zs, look: 0.6 },
      { key: "meet:4", kind: "back", x: zx.meet + zsd(28), y: zoneY - zsd(9), s: zs, look: -0.6 } ] };
    const cafe = { x: zx.cafe, y: zoneY, seats: (wide ? [-48, -12, 24, 60] : [-54, 0, 54]).map((u, i, a) => ({ key: "cafe:" + i, kind: "bar", x: zx.cafe + zsd(u), y: zoneY + zsd(4), s: zs, look: i === 0 ? 1 : i === a.length - 1 ? -1 : (i % 2 ? -0.6 : 0.6) })) };
    const cw = wide ? 170 : 128;
    cafe.w = cw; cafe.machine = { x: zx.cafe + zsd(-cw / 2 + 32), y: floorY + zsd(12) - zsd(80) };
    const pendants = wide ? [{ x: zx.meet, y: floorY - 96 * S }, { x: zx.cafe, y: floorY - 104 * S }, { x: rx0 + RW * 0.62, y: floorY - 112 * S }]
                          : [{ x: zx.meet, y: floorY - 84 * S }, { x: zx.cafe + 6 * S, y: floorY - 96 * S }];
    const libLamp = { x: zx.lib - zsd(56), y: zoneY - zsd(96) };
    L = { hb, side, rx0, RW, W, H, wide, S, floorY, winTop, winBot, windows, horizon, zs, zoneY, frontY, frontS, benches, lib, meet, cafe, pendants, libLamp,
          hudTop: side ? hb.topH : Math.max(hb.topH, hb.bottom), winLeft: windows[0].x, winRight: windows[windows.length - 1].x + windows[windows.length - 1].w,
          skyTop: side ? winTop : clamp(hb.textBottom + 8, winTop, horizon),       // the open sky under the words
          aisleY: Math.round(zoneY + (firstY - zoneY) * 0.42) };
    L.seats = new Map();
    for (const b of benches) for (const s of b.seats) L.seats.set(s.key, s);
    for (const z of [lib, meet, cafe]) for (const s of z.seats) L.seats.set(s.key, s);
  }
  const depthS = (y) => lerp(L.zs, L.frontS, clamp((y - L.zoneY) / Math.max(1, L.frontY - L.zoneY), 0, 1));

  /* the static layers: sky and sea, the harbour in front of it, and the room around the windows */
  function paintLayers() {
    for (const c of Object.values(layers)) { c.width = Math.round(W * LDPR); c.height = Math.round(H * LDPR); }
    const x = (c) => { const k = c.getContext("2d"); k.setTransform(LDPR, 0, 0, LDPR, 0, 0); k.clearRect(0, 0, W, H); return k; };
    const sky = x(layers.sky); paintSky(sky);
    const room = x(layers.room); paintHarbour(room); paintRoom(room);
    // a fine print grain over the painted set, so the walls and floor read as illustration, not flat fills
    tooth(sky, 0.05); tooth(room, 0.085);
  }
  let grain = null;
  function tooth(x, a) {
    if (!grain) {
      const n = document.createElement("canvas"); n.width = n.height = 128;
      const k = n.getContext("2d"), im = k.createImageData(128, 128), r = rng(911);
      for (let i = 0; i < im.data.length; i += 4) { const v = r() < 0.5 ? 0 : 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = Math.round(r() * r() * 255); }
      k.putImageData(im, 0, 0); grain = n;
    }
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "source-atop"; x.globalAlpha = a;
    x.fillStyle = x.createPattern(grain, "repeat"); x.fillRect(0, 0, x.canvas.width, x.canvas.height); x.restore();
  }
  function paintSky(x) {
    const { winTop, winBot, horizon, S } = L;
    let gr = x.createLinearGradient(0, winTop, 0, horizon);
    gr.addColorStop(0, T.skyTop); gr.addColorStop(0.62, T.skyMid); gr.addColorStop(1, T.horizon);
    x.fillStyle = gr; x.fillRect(0, 0, W, horizon + 1);
    // the windows face west: the sun comes into view in the late afternoon and goes down over the sea
    if (T.hf > 15 && T.hf < 19) {
      const k = (T.hf - 15.2) / (18.75 - 15.2), sx = L.winLeft + (L.winRight - L.winLeft) * 0.62, sy = lerp(L.side ? winTop - 20 * S : L.skyTop + 12 * S, horizon + 4 * S, clamp(k, 0, 1.05));
      const warm = clamp((T.hf - 16.8) / 1.8, 0, 1);
      glow(x, sx, sy, 110 * S, mix("#FFF4D6", "#FFB36B", warm), 0.55);
      disc(x, sx, sy, 11 * S, mix("#FFF8E6", "#FFC47A", warm));
    }
    // the moon, in tonight's real phase
    const moonR = 8.5 * S, moonUp = T.stars > 0.15 && horizon - L.skyTop >= 2 * moonR + 8;   // no room under the words: no moon
    if (moonUp) {
      const mx = L.winLeft + (L.winRight - L.winLeft) * (L.wide ? 0.2 : 0.18), my = L.side ? winTop + (horizon - winTop) * 0.3 : L.skyTop + (horizon - L.skyTop) * 0.45;
      glow(x, mx, my, moonR * 5, "#F3EFE3", 0.13 * T.stars);
      moon(x, mx, my, moonR, moonPhase(), T.stars);
    }
    // the sea
    gr = x.createLinearGradient(0, horizon, 0, winBot);
    gr.addColorStop(0, T.seaFar); gr.addColorStop(1, T.seaNear);
    x.fillStyle = gr; x.fillRect(0, horizon, W, winBot - horizon + 40);
    x.fillStyle = rgba("#FFFFFF", 0.1 + 0.1 * T.day); x.fillRect(0, horizon, W, 1);
    // Paraguana, on a clear day, far off on the horizon
    x.fillStyle = rgba(mix(T.horizon, T.seaFar, 0.5), 0.9);
    x.beginPath(); x.moveTo(L.winLeft + (L.winRight - L.winLeft) * 0.58, horizon); x.quadraticCurveTo(L.winLeft + (L.winRight - L.winLeft) * 0.72, horizon - 4 * S, L.winLeft + (L.winRight - L.winLeft) * 0.9, horizon); x.fill();
    const r = rng(9);
    for (let i = 0; i < (L.wide ? 90 : 40); i++) {       // light on the water
      const sx = L.winLeft + r() * (L.winRight - L.winLeft), sy = horizon + 3 + r() * (winBot - horizon - 6), w = (4 + r() * 12) * S;
      x.fillStyle = T.day > 0.5 ? rgba("#FFFFFF", 0.14 + r() * 0.14) : rgba("#BFD9EA", 0.05 + r() * 0.06);
      x.fillRect(sx, sy, w, 1);
    }
    if (moonUp) {            // the moon's path on the water
      const mx = L.winLeft + (L.winRight - L.winLeft) * (L.wide ? 0.2 : 0.18);
      for (let y = horizon + 3; y < winBot; y += 3) { const w = (6 + (y - horizon) * 0.25) * S * (0.6 + r() * 0.6); x.fillStyle = rgba("#F3EFE3", 0.14 * T.stars); x.fillRect(mx - w / 2 + (r() - 0.5) * 6, y, w, 1); }
    }
  }
  function moon(x, cx, cy, r, ph, a) {
    x.save(); x.globalAlpha = a;
    disc(x, cx, cy, r, "#1A2E3D");
    const waxing = ph < 0.5, k = Math.cos(ph * TAU);
    x.translate(cx, cy); if (!waxing) x.scale(-1, 1);
    x.fillStyle = "#F3EFE3"; x.beginPath(); x.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    if (k > 0) x.ellipse(0, 0, r * k, r, 0, Math.PI / 2, -Math.PI / 2, true);
    else x.ellipse(0, 0, r * -k, r, 0, Math.PI / 2, Math.PI * 1.5, false);
    x.fill(); x.restore();
  }
  function paintHarbour(x) {
    const { S, horizon, winBot } = L, night = 1 - T.day, spanW = L.winRight - L.winLeft, X = (f) => L.winLeft + spanW * f;
    // the far shore: a low headland with the California lighthouse
    const hx = X(L.wide ? 0.035 : 0.05), hy = horizon;
    x.fillStyle = mix(mix(T.horizon, T.seaFar, 0.55), "#0B1B26", 0.25 * night);
    x.beginPath(); x.moveTo(L.winLeft - 4, hy + 1); x.lineTo(L.winLeft - 4, hy - 4 * S); x.quadraticCurveTo(hx + 10 * S, hy - 7 * S, hx + 34 * S, hy - 2 * S); x.quadraticCurveTo(hx + 50 * S, hy, hx + 70 * S, hy + 1); x.closePath(); x.fill();
    const lh = 15 * S;
    x.fillStyle = mix("#E9E2D0", "#3A4A55", night); x.beginPath(); x.moveTo(hx + 8 * S - 2.4 * S, hy - 5 * S); x.lineTo(hx + 8 * S - 1.5 * S, hy - 5 * S - lh); x.lineTo(hx + 8 * S + 1.5 * S, hy - 5 * S - lh); x.lineTo(hx + 8 * S + 2.4 * S, hy - 5 * S); x.closePath(); x.fill();
    x.fillStyle = night > 0.4 ? "#FFE7A8" : mix("#5B6B74", "#FFE7A8", night); x.fillRect(hx + 8 * S - 1.8 * S, hy - 5 * S - lh - 2.6 * S, 3.6 * S, 2.6 * S);
    x.fillStyle = mix("#3E4F5A", "#1A2630", night); x.beginPath(); x.moveTo(hx + 8 * S - 2.2 * S, hy - 5 * S - lh - 2.6 * S); x.lineTo(hx + 8 * S, hy - 5 * S - lh - 5 * S); x.lineTo(hx + 8 * S + 2.2 * S, hy - 5 * S - lh - 2.6 * S); x.closePath(); x.fill();
    L.lighthouse = { x: hx + 8 * S, y: hy - 5 * S - lh - 1.3 * S };
    // a cruise ship at the terminal, as big as the town, the way they really look from Oranjestad
    const len = Math.min(spanW * (L.wide ? 0.34 : 0.6), 520 * S, (winBot - L.winTop) * 2.3), sx = X(L.wide ? 0.3 : 0.12), wy = Math.round(horizon + (winBot - horizon) * 0.6);
    ship(x, sx, wy, len, night);
    town(x, night);
    // the divi-divi on the quay, bent by the trade wind
    diviTree(x, X(L.wide ? 0.99 : 0.96), winBot + 8 * S, (winBot - L.winTop) * (L.wide ? 0.5 : 0.44), night);
  }
  function ship(x, sx, wy, len, night) {
    const u = len / 100, S = L.S;
    const hull = mix("#23405A", "#0A1720", night), boot = mix("#C4453A", "#3A1C1E", night);
    const white = mix("#F6F6F2", "#1E303D", night), white2 = mix("#E1E7EA", "#192A36", night), glass = mix("#3B5D74", "#0C1A24", night);
    const hullTop = wy - 6.5 * u, th = 2.7 * u;
    const tiers = [[4, 91], [6, 88], [8, 85], [11, 80], [15, 73], [21, 63]];
    const r = rng(404);
    if (night > 0.3) {             // its lights, broken up on the water
      for (let px = sx + 4 * u; px < sx + 92 * u; px += 1.7 * u) {
        if (r() < 0.35) continue;
        const col = r() < 0.3 ? "#FFC977" : "#FFEFD0";
        for (let py = wy + 2; py < L.winBot - 2; py += 2.4 * S) {
          const k = 1 - (py - wy) / (L.winBot - wy);
          if (r() < 0.45) continue;
          x.fillStyle = rgba(col, (0.1 + r() * 0.22) * night * k);
          x.fillRect(px + (r() - 0.5) * 3 * S, py, (1 + r() * 3) * S, Math.max(1, 0.8 * S));
        }
      }
    } else { x.fillStyle = rgba("#06202C", 0.22 * (1 - night)); x.fillRect(sx + 4 * u, wy, 91 * u, 2.5 * S); }
    x.fillStyle = hull; x.beginPath();
    x.moveTo(sx + 1 * u, hullTop); x.lineTo(sx + 91 * u, hullTop);
    x.quadraticCurveTo(sx + 97 * u, hullTop - 0.5 * u, sx + 100 * u, hullTop - 1.8 * u);
    x.lineTo(sx + 95.5 * u, wy); x.lineTo(sx + 4 * u, wy); x.quadraticCurveTo(sx + 0.6 * u, wy - 2.5 * u, sx + 1 * u, hullTop); x.closePath(); x.fill();
    x.fillStyle = boot; x.beginPath(); x.moveTo(sx + 3.2 * u, wy - 1.1 * u); x.lineTo(sx + 95.8 * u, wy - 1.1 * u); x.lineTo(sx + 95.5 * u, wy); x.lineTo(sx + 4 * u, wy); x.closePath(); x.fill();
    x.fillStyle = night > 0.5 ? rgba("#FFD99A", 0.55) : rgba(white, 0.85); x.fillRect(sx + 1 * u, hullTop, 90 * u, Math.max(1, 0.35 * u));
    for (let px = sx + 7 * u; px < sx + 88 * u; px += 1.9 * u) {         // portholes
      const lit = night > 0.35 && r() < 0.55;
      x.fillStyle = lit ? rgba("#FFE2A6", 0.85) : rgba(mix("#6C8DA3", "#101E27", night), 0.9);
      x.fillRect(px, hullTop + 2.4 * u, Math.max(1, 0.55 * u), Math.max(1, 0.55 * u));
    }
    let top = hullTop;
    tiers.forEach(([a0, b0], i) => {         // decks, stepping back towards the bow
      const a = sx + a0 * u, b = sx + b0 * u, y0 = top - th;
      x.fillStyle = i % 2 ? white2 : white;
      x.beginPath(); x.moveTo(a, top); x.lineTo(b + 1.2 * u, top); x.lineTo(b, y0); x.lineTo(a, y0); x.closePath(); x.fill();
      const gy = y0 + 0.75 * u, gh = 1.25 * u;
      x.fillStyle = glass; x.fillRect(a + 0.8 * u, gy, b - a - 1.2 * u, gh);
      if (night > 0.35) {
        for (let px = a + 1 * u; px < b - 0.8 * u; px += 1.35 * u) {
          if (r() < 0.3) continue;
          x.fillStyle = r() < 0.22 ? "#FFC56E" : r() < 0.5 ? "#FFE6B5" : "#FFF4DE";
          x.fillRect(px, gy + 0.2 * u, Math.max(1, 0.8 * u), Math.max(1, gh - 0.4 * u));
        }
      } else { x.fillStyle = rgba(white, 0.55); for (let px = a + 1.6 * u; px < b - 0.8 * u; px += 1.35 * u) x.fillRect(px, gy, Math.max(0.6, 0.18 * u), gh); }
      if (i === 1) { x.fillStyle = mix("#F28C28", "#6A4020", night * 0.8); for (let px = a + 6 * u; px < b - 12 * u; px += 4.4 * u) { x.beginPath(); rr(x, px, y0 + 0.4 * u, 3.2 * u, 1.2 * u, 0.6 * u); x.fill(); } }
      top = y0;
    });
    const bY = hullTop - th * 3.55, bX = sx + 72 * u;
    x.fillStyle = mix("#0E2330", "#050D13", night); x.fillRect(bX, bY, 8.5 * u, 0.9 * u);
    const fx = sx + 27 * u, fw = 7 * u, fh = 6.5 * u;        // funnel, raked back
    x.fillStyle = mix("#F3EFE3", "#1D2E3A", night); x.beginPath(); x.moveTo(fx, top); x.lineTo(fx + fw, top); x.lineTo(fx + fw - 1.2 * u, top - fh); x.lineTo(fx - 1.6 * u, top - fh); x.closePath(); x.fill();
    x.fillStyle = mix("#1B6CA8", "#2B5E80", night); x.beginPath(); x.moveTo(fx - 0.9 * u, top - fh * 0.45); x.lineTo(fx + fw - 0.55 * u, top - fh * 0.45); x.lineTo(fx + fw - 0.85 * u, top - fh * 0.72); x.lineTo(fx - 1.2 * u, top - fh * 0.72); x.closePath(); x.fill();
    x.fillStyle = mix("#0B1820", "#04080B", night); x.fillRect(fx - 1.6 * u, top - fh - 0.8 * u, fw + 0.4 * u, 0.8 * u);
    const m1 = sx + 74 * u, mTop = top - 8 * u;
    x.strokeStyle = mix("#5E6F7A", "#2A3B47", night); x.lineWidth = Math.max(1, 0.35 * u);
    x.beginPath(); x.moveTo(m1, top); x.lineTo(m1, mTop); x.moveTo(m1 - 1.6 * u, top - 4 * u); x.lineTo(m1 + 1.6 * u, top - 4 * u); x.stroke();
    if (night > 0.3) {                // strings of lights from bow to mast to stern
      x.fillStyle = rgba("#FFE7B0", 0.8 * night);
      const string = (x0, y0, x1, y1) => { const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / (2.2 * S)); for (let i = 0; i <= n; i++) { const k = i / n, sag = Math.sin(k * Math.PI) * 1.2 * u; x.fillRect(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k + sag, Math.max(1, 0.5 * S), Math.max(1, 0.5 * S)); } };
      string(sx + 99.5 * u, hullTop - 1.8 * u, m1, mTop); string(m1, mTop, sx + 2 * u, hullTop - 1 * u);
      disc(x, m1, mTop, 1.2 * S, "#FF6B6B");
    }
    L.ship = { x: sx, w: len, wy, top: top - fh };
  }
  function town(x, night) {
    const { S, winBot } = L, spanW = L.winRight - L.winLeft;
    const PAINT = ["#F2C94C", "#E98FA6", "#7ED3B8", "#79B8E6", "#F4A259", "#C7A3E0", "#F3EFE3", "#9ED99A"];
    const r = rng(L.wide ? 33 : 11), base = winBot + 6 * S;
    const towerAt = L.winLeft + spanW * (L.wide ? 0.5 : 0.48);
    let px = L.winLeft - 16 * S, i = 0, towerDone = false;
    const lamps = [];
    while (px < L.winRight + 10) {
      if (!towerDone && px + 20 * S > towerAt) { willemTower(x, px + 8 * S, base, night); px += 24 * S; towerDone = true; continue; }
      const w = (22 + r() * 20) * S, bh = (16 + r() * 22) * S, type = Math.floor(r() * 4), paint = PAINT[(i * 3 + (r() < 0.5 ? 1 : 0)) % PAINT.length];
      const body = mix(paint, "#0A1A24", 0.04 + night * 0.78), trim = mix("#FFFFFF", "#13252F", night * 0.9), roof = mix("#B4532A", "#1B1512", night * 0.8);
      const y0 = base - bh;
      x.fillStyle = body;
      x.beginPath(); x.rect(px, y0, w, bh + 2);
      if (type === 0) { const s = 4 * S; x.rect(px + w * 0.15, y0 - s, w * 0.7, s); x.rect(px + w * 0.28, y0 - s * 2, w * 0.44, s); x.rect(px + w * 0.4, y0 - s * 3, w * 0.2, s); }
      if (type === 1) { x.moveTo(px + w * 0.12, y0); x.quadraticCurveTo(px + w * 0.2, y0 - 8 * S, px + w * 0.36, y0 - 9 * S); x.quadraticCurveTo(px + w * 0.5, y0 - 16 * S, px + w * 0.64, y0 - 9 * S); x.quadraticCurveTo(px + w * 0.8, y0 - 8 * S, px + w * 0.88, y0); }
      x.fill();
      if (T.day > 0.3) { x.fillStyle = rgba("#000000", 0.12 * T.day); x.fillRect(px + w * 0.72, y0, w * 0.28, bh + 2); }       // the shady side
      if (type === 2) { x.fillStyle = roof; x.beginPath(); x.moveTo(px - 1, y0); x.lineTo(px + w / 2, y0 - 11 * S); x.lineTo(px + w + 1, y0); x.closePath(); x.fill(); }
      x.fillStyle = trim; x.fillRect(px, y0, w, 1.4 * S);
      if (type === 3) { x.fillRect(px, y0 - 3 * S, w, 1.2 * S); for (let bx = px + 2 * S; bx < px + w - 1; bx += 3 * S) x.fillRect(bx, y0 - 3 * S, 0.9 * S, 3 * S); }
      const cols = Math.max(2, Math.floor(w / (8.5 * S))), rows = Math.max(1, Math.floor((bh - 5 * S) / (10 * S)));
      for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
        const wx = px + (cx + 0.5) * (w / cols) - 1.9 * S, wy2 = y0 + 5 * S + cy * 10 * S, lit = night > 0.35 && r() < 0.42;
        if (lit) { x.fillStyle = rgba("#FFB64D", 0.18); x.fillRect(wx - 1.5 * S, wy2 - 1.5 * S, 6.8 * S, 8.4 * S); }
        x.fillStyle = lit ? (r() < 0.5 ? "#FFC56E" : "#FFE2A6") : mix("#2A4658", "#08131A", night);
        x.fillRect(wx, wy2, 3.8 * S, 5.4 * S);
        if (!lit && T.day > 0.5) { x.fillStyle = rgba(trim, 0.8); x.fillRect(wx - 0.6 * S, wy2 - 0.6 * S, 5 * S, 0.8 * S); }
      }
      if (i === 3) {                 // the Aruban flag
        const fx = px + w * 0.7, fy = y0 - 18 * S;
        x.fillStyle = trim; x.fillRect(fx, fy, 0.9 * S, 18 * S);
        x.fillStyle = mix("#418FDE", "#1E3A55", night * 0.7); x.fillRect(fx + 0.9 * S, fy, 12 * S, 8 * S);
        x.fillStyle = mix("#F9D616", "#6E6420", night * 0.7); x.fillRect(fx + 0.9 * S, fy + 5 * S, 12 * S, 0.7 * S); x.fillRect(fx + 0.9 * S, fy + 6.3 * S, 12 * S, 0.7 * S);
        disc(x, fx + 3.4 * S, fy + 2.4 * S, 1.2 * S, mix("#EF3340", "#5E2226", night * 0.7));
      }
      if (i % 3 === 1) palm(x, px + w + 1 * S, base - 2 * S, (26 + r() * 8) * S, night, r() < 0.5 ? 1 : -1);
      if (i % 2 === 0) lamps.push(px + w * 0.5);
      px += w + r() * 2 * S; i++;
    }
    if (night > 0.35) for (const lx of lamps) {           // street lamps along the boulevard
      x.fillStyle = mix("#1B2A33", "#0A141A", night); x.fillRect(lx, base - 16 * S, 0.8 * S, 10 * S);
      glowOn(x, lx + 0.4 * S, base - 16.5 * S, 9 * S, "#FFC766", 0.45 * night);
      disc(x, lx + 0.4 * S, base - 16.5 * S, 1.2 * S, "#FFE2A6");
    }
  }
  function willemTower(x, px, base, night) {
    // the Willem III tower at Fort Zoutman: pale yellow, a clock, a red roof
    const S = L.S, w = 10 * S, h = 50 * S, y0 = base - h;
    x.fillStyle = mix("#F2D98A", "#27313A", night * 0.85); x.fillRect(px, y0, w, h);
    x.fillStyle = mix("#FFFFFF", "#33404A", night * 0.85); x.fillRect(px, y0, 1.2 * S, h); x.fillRect(px + w - 1.2 * S, y0, 1.2 * S, h);
    for (let k = 0; k < 3; k++) x.fillRect(px, y0 + 14 * S + k * 12 * S, w, 1 * S);
    x.fillStyle = mix("#6D5A3A", "#0D1519", night); for (let k = 0; k < 3; k++) x.fillRect(px + w / 2 - 1.2 * S, y0 + 18 * S + k * 12 * S, 2.4 * S, 4.2 * S);
    disc(x, px + w / 2, y0 + 7.5 * S, 3.2 * S, mix("#FFFFFF", "#FFE2A6", night));
    x.strokeStyle = "#1B2A33"; x.lineWidth = Math.max(0.6, 0.5 * S); x.beginPath(); x.moveTo(px + w / 2, y0 + 7.5 * S); x.lineTo(px + w / 2, y0 + 5.4 * S); x.moveTo(px + w / 2, y0 + 7.5 * S); x.lineTo(px + w / 2 + 1.6 * S, y0 + 7.5 * S); x.stroke();
    if (night > 0.35) glowOn(x, px + w / 2, y0 + 7.5 * S, 12 * S, "#FFD58A", 0.4 * night);
    x.fillStyle = mix("#C0502B", "#2A1612", night * 0.8); x.beginPath(); x.moveTo(px - 1.5 * S, y0); x.lineTo(px + w / 2, y0 - 12 * S); x.lineTo(px + w + 1.5 * S, y0); x.closePath(); x.fill();
    x.fillStyle = mix("#1B2A33", "#0A141A", night); x.fillRect(px + w / 2 - 0.4 * S, y0 - 18 * S, 0.8 * S, 6 * S);
  }
  function palm(x, px, by, h, night, dir) {
    const S = L.S, trunk = mix("#8A6B4A", "#0D1519", night * 0.9), leaf = mix("#3F8F5B", "#0A1A16", night * 0.9);
    x.strokeStyle = trunk; x.lineWidth = 1.6 * S; x.lineCap = "round";
    const tx = px + dir * 5 * S, ty = by - h;
    x.beginPath(); x.moveTo(px, by); x.quadraticCurveTo(px + dir * 1 * S, by - h * 0.6, tx, ty); x.stroke();
    x.fillStyle = leaf;
    for (const [a, l] of [[-2.7, 11], [-2.1, 12], [-1.5, 9], [-0.9, 12], [-0.35, 11], [0.2, 9]]) {
      const ex = tx + Math.cos(a) * l * S, ey = ty + Math.sin(a) * l * S * 0.8 + 3 * S;
      x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo((tx + ex) / 2, ty - 3 * S, ex, ey); x.quadraticCurveTo((tx + ex) / 2, ty - 0.5 * S, tx, ty + 0.8 * S); x.fill();
    }
  }
  function diviTree(x, bx, by, h, night) {
    // a divi-divi: a short leaning trunk and a flat crown streaming away from the trade wind
    const k = h / 100, trunk = mix("#5A4632", "#081118", night * 0.95), leaf = mix("#2E6B45", "#07131A", night * 0.95), leafHi = mix("#4E9A62", "#1C3444", night * 0.9);
    x.save(); x.translate(bx, by); x.scale(k, k);
    x.fillStyle = trunk; x.beginPath();
    x.moveTo(-6, 0); x.bezierCurveTo(-8, -26, -24, -44, -42, -58); x.lineTo(-37, -62); x.bezierCurveTo(-20, -52, -4, -40, 2, -22); x.bezierCurveTo(4, -12, 6, -4, 8, 0); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(-24, -45); x.bezierCurveTo(-20, -58, -16, -66, -12, -76); x.lineTo(-9, -74); x.bezierCurveTo(-12, -62, -15, -54, -19, -43); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(-40, -58); x.bezierCurveTo(-52, -62, -64, -64, -80, -62); x.lineTo(-80, -59); x.bezierCurveTo(-64, -60, -52, -58, -42, -54); x.closePath(); x.fill();
    const tiers = [[-104, -94, 76, 6.5], [-118, -84, 104, 8.5], [-128, -73, 120, 9], [-122, -63, 114, 8], [-104, -54, 86, 6.5], [-82, -46, 50, 5]];
    for (const [x0, y0, len, t] of tiers) {
      x.fillStyle = leaf; x.beginPath();
      x.moveTo(x0, y0 + 3);
      x.bezierCurveTo(x0 + len * 0.3, y0 - t * 1.1, x0 + len * 0.75, y0 - t, x0 + len - 4, y0 - t * 0.55);
      x.quadraticCurveTo(x0 + len + 4, y0, x0 + len - 4, y0 + t * 0.45);
      x.bezierCurveTo(x0 + len * 0.7, y0 + t * 0.4, x0 + len * 0.3, y0 + t * 0.7, x0, y0 + 3);
      x.closePath(); x.fill();
      x.fillStyle = rgba(leafHi, night > 0.5 ? 0.5 : 0.8);
      x.beginPath(); x.moveTo(x0 + len * 0.12, y0 - t * 0.3); x.bezierCurveTo(x0 + len * 0.35, y0 - t * 1.0, x0 + len * 0.75, y0 - t * 0.95, x0 + len - 5, y0 - t * 0.5); x.bezierCurveTo(x0 + len * 0.7, y0 - t * 0.5, x0 + len * 0.4, y0 - t * 0.55, x0 + len * 0.12, y0 - t * 0.3); x.fill();
    }
    x.restore();
  }
  function glowOn(x, cx, cy, r, col, a) { const o = x.globalCompositeOperation; x.globalCompositeOperation = "lighter"; glow(x, cx, cy, r, col, a); x.globalCompositeOperation = o; }
  function paintRoom(x) {
    const { S, floorY, windows, winTop, winBot, zs } = L;
    // the wall, with the windows cut out of it
    let gr = x.createLinearGradient(0, 0, 0, floorY);
    gr.addColorStop(0, P.wallTop); gr.addColorStop(1, P.wallBot);
    x.beginPath(); x.rect(0, 0, W, floorY); for (const w of windows) x.rect(w.x, w.y, w.w, w.h);
    x.fillStyle = gr; x.fill("evenodd");
    x.save(); x.clip("evenodd");
    x.fillStyle = P.batten;
    // the room's lines start where the studio does: on a big screen none run under the words on the left
    const lx0 = L.side ? L.rx0 : 0;
    for (let px = lx0 + 8; px < W; px += 24 * S) x.fillRect(Math.round(px), 0, 1, floorY);            // board-and-batten
    x.fillStyle = P.ceil; x.fillRect(0, 0, W, winTop - 12 * S);
    x.fillStyle = P.d > 0.5 ? "rgba(90,60,30,0.12)" : "rgba(0,0,0,0.25)"; x.fillRect(0, winTop - 12 * S, W, 2);
    // sunlight through the glass warms the wall beside each window
    if (P.d > 0.05) for (const w of windows) { const lg = x.createLinearGradient(w.x - 60 * S, 0, w.x, 0); lg.addColorStop(0, "rgba(255,226,170,0)"); lg.addColorStop(1, `rgba(255,226,170,${(0.28 * P.d).toFixed(3)})`); x.fillStyle = lg; x.fillRect(w.x - 60 * S, w.y, 60 * S, floorY - w.y); }
    x.restore();
    // window frames: black steel, like an old warehouse on the harbour
    const fw = 5 * S, mw = 2.2 * S;
    for (const w of windows) {
      x.fillStyle = "rgba(255,255,255,0.035)";   // reflections on the glass
      x.beginPath(); x.moveTo(w.x + w.w * 0.08, w.y + w.h); x.lineTo(w.x + w.w * 0.2, w.y + w.h); x.lineTo(w.x + w.w * 0.42, w.y); x.lineTo(w.x + w.w * 0.3, w.y); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(w.x + w.w * 0.24, w.y + w.h); x.lineTo(w.x + w.w * 0.27, w.y + w.h); x.lineTo(w.x + w.w * 0.49, w.y); x.lineTo(w.x + w.w * 0.46, w.y); x.closePath(); x.fill();
      x.fillStyle = P.frame;
      x.fillRect(w.x - fw, w.y - fw, w.w + fw * 2, fw); x.fillRect(w.x - fw, w.y + w.h, w.w + fw * 2, fw);
      x.fillRect(w.x - fw, w.y, fw, w.h); x.fillRect(w.x + w.w, w.y, fw, w.h);
      // the bars: a transom and mullions. Over a phone's headline the top light is one clear pane,
      // so no bar runs through the words.
      const cols = L.wide ? 3 : 4, ty = L.side ? Math.round(w.y + w.h * 0.3) : Math.round(clamp(L.hb.bottom + 4, w.y + w.h * 0.3, w.y + w.h - 24 * S));
      for (let i = 1; i < cols; i++) x.fillRect(Math.round(w.x + (w.w * i) / cols - mw / 2), L.side ? w.y : ty, mw, L.side ? w.h : w.y + w.h - ty);
      x.fillRect(w.x, ty, w.w, mw);
      x.fillStyle = P.frameHi; x.fillRect(w.x - fw, w.y + w.h + fw - 1, w.w + fw * 2, 1);
      x.fillStyle = P.woodTop; x.fillRect(w.x - fw - 5 * S, w.y + w.h + fw, w.w + fw * 2 + 10 * S, 4 * S);        // the sill
      x.fillStyle = P.d > 0.5 ? "rgba(90,60,30,0.2)" : "rgba(0,0,0,0.3)"; x.fillRect(w.x - fw - 5 * S, w.y + w.h + fw + 4 * S, w.w + fw * 2 + 10 * S, 3 * S);
    }
    // things on the sill: aloe, a little kadushi cactus, books
    const sillY = winBot + fw, rs = rng(3);
    const spots = L.wide ? [0.06, 0.3, 0.52, 0.66, 0.94] : [0.36, 0.62];
    for (const f of spots) { const px = L.winLeft + (L.winRight - L.winLeft) * f; sillThing(x, px, sillY, S * 0.9, Math.floor(rs() * 3)); }
    // pillars between windows: a clock with Aruba's time, and the studio's mark
    if (L.wide && windows.length > 1) {
      const a = windows[0], b = windows[1], cx = (a.x + a.w + b.x) / 2, cy = L.side ? winTop + (winBot - winTop) * 0.3 : Math.max(winTop + (winBot - winTop) * 0.3, L.hb.bottom + 24 * S);
      if (cy < winBot - 14 * S) wallClock(x, cx, cy, 13 * S);
      if (windows.length > 2) { const c2 = windows[windows.length - 2], d2 = windows[windows.length - 1]; mark(x, (c2.x + c2.w + d2.x) / 2, winTop + (winBot - winTop) * 0.34, 22 * S, P.d > 0.5 ? "rgba(11,47,72,0.75)" : "rgba(243,239,227,0.8)"); }
    }
    // the floor: boards, with the room's light on it
    gr = x.createLinearGradient(0, floorY, 0, H);
    gr.addColorStop(0, P.floorFar); gr.addColorStop(1, P.floorNear);
    x.fillStyle = gr; x.fillRect(0, floorY, W, H - floorY);
    x.save(); x.beginPath(); x.rect(lx0, floorY, W - lx0, H - floorY); x.clip();
    const vx = L.rx0 + L.RW / 2, vy = floorY - (H - floorY) * 1.3, nn = L.wide ? 30 : 14;
    x.strokeStyle = P.line; x.lineWidth = 1;
    for (let i = -nn; i <= nn; i++) { const bx = vx + i * (W / nn) * 1.3, t0 = (floorY - vy) / (H - vy); x.beginPath(); x.moveTo(vx + (bx - vx) * t0, floorY); x.lineTo(bx, H); x.stroke(); }
    x.strokeStyle = P.d > 0.5 ? "rgba(90,60,30,0.07)" : "rgba(0,0,0,0.12)";
    for (let k = 1; k < 12; k++) { const y = floorY + (H - floorY) * Math.pow(k / 12, 1.7); x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
    // window light across the floor: the windows face west, so the afternoon sun lays their shape
    // across the boards, longer as it sinks; at night only the harbour's glow comes in
    x.globalCompositeOperation = P.d > 0.5 ? "source-over" : "lighter";
    // (mornings: no direct sun on this side, just the bright sky's light on the boards)
    const sunK = clamp((T.hf - 11.5) / 6, 0, 1), sunny = T.day > 0.3 && T.hf > 12.2 && T.hf < 18.6, bright = T.day > 0.3 && !sunny;
    const len = (H - floorY) * (sunny ? 0.2 + 0.6 * sunK : bright ? 0.24 : 0.3), dx = (sunny ? 50 * sunK : bright ? 4 : 10) * S;
    const col = sunny ? mix("#FFF1CF", "#FFC98A", clamp((T.hf - 16) / 2.5, 0, 1)) : bright ? "#FFF7E6" : "#9CC8EA";
    const a = sunny ? (P.d > 0.5 ? 0.42 : 0.26) * T.day : bright ? 0.2 * T.day : 0.05 * T.stars;
    const cols = L.wide ? 3 : 4;
    for (const w of windows) {
      const lg = x.createLinearGradient(0, floorY, 0, floorY + len);
      lg.addColorStop(0, rgba(col, a)); lg.addColorStop(1, rgba(col, a * 0.3));
      x.fillStyle = lg;
      const bar = 2.2 * S, trans = 0.3;
      for (let i = 0; i < cols; i++) {
        const u0 = w.x + (w.w * i) / cols + (i ? bar / 2 : 0), u1 = w.x + (w.w * (i + 1)) / cols - (i < cols - 1 ? bar / 2 : 0);
        for (const [v0, v1] of [[0, 1 - trans - 0.02], [1 - trans + 0.02, 1]]) {
          x.beginPath();
          x.moveTo(u0 + v0 * dx, floorY + v0 * len); x.lineTo(u1 + v0 * dx, floorY + v0 * len);
          x.lineTo(u1 + v1 * dx, floorY + v1 * len); x.lineTo(u0 + v1 * dx, floorY + v1 * len); x.closePath(); x.fill();
        }
      }
    }
    x.globalCompositeOperation = "source-over";
    x.restore();
    x.fillStyle = P.leg; x.fillRect(lx0, floorY - 3 * S, W - lx0, 3 * S);
    // rugs
    rug(x, L.lib.x, L.zoneY + 4 * zs, 70 * zs, 11 * zs, mix("#7A3E2C", "#B0603E", P.d), "#E9C891");
    rug(x, L.meet.x, L.meet.y + 2 * zs, 86 * zs, 13 * zs, mix("#173F5A", "#2B6C93", P.d), "#6DB4E5");
    // library: a wall of books
    bookcase(x, L.lib.x - (L.wide ? 6 : 0) * zs, floorY + 4 * zs, zs, L.wide ? 150 : 124);
    if (L.wide) bookcase(x, L.lib.x + 104 * zs, floorY + 4 * zs, zs * 0.95, 70);
    floorLamp(x, L.libLamp.x, L.zoneY + 2 * zs, zs);
    counter(x, L.cafe.x, floorY + 12 * zs, zs, L.cafe.w);
    // tall kadushi cacti in the corners
    kadushi(x, L.side ? L.rx0 + 14 * S : L.wide ? 26 * S : 10 * S, L.zoneY + 18 * zs, zs * (L.wide ? 1.1 : 0.9));
    kadushi(x, W - (L.wide ? 30 : 9) * S, L.zoneY + 22 * zs, zs * (L.wide ? 1.2 : 0.85));
    if (L.wide) { flipChart(x, L.meet.x + 118 * zs, L.zoneY + 4 * zs, zs); aloe(x, L.cafe.x - 106 * zs, L.zoneY + 8 * zs, zs); }
    for (const p of L.pendants) pendant(x, p.x, p.y, S);
  }
  function rug(x, cx, cy, rx, ry, col, edge) {
    ell(x, cx, cy, rx, ry, col);
    x.strokeStyle = rgba(edge, 0.45); x.lineWidth = 1.2; x.beginPath(); x.ellipse(cx, cy, rx * 0.84, ry * 0.72, 0, 0, TAU); x.stroke();
    x.strokeStyle = rgba(edge, 0.22); x.beginPath(); x.ellipse(cx, cy, rx * 0.64, ry * 0.5, 0, 0, TAU); x.stroke();
  }
  function sillThing(x, px, y, s, kind) {
    x.save(); x.translate(px, y); x.scale(s, s);
    if (kind === 0) { x.fillStyle = "#B8653A"; x.beginPath(); x.moveTo(-5, -7); x.lineTo(5, -7); x.lineTo(4, 0); x.lineTo(-4, 0); x.fill(); x.fillStyle = "#4E9C68"; for (const [a, h] of [[-0.5, 12], [0.1, 15], [0.55, 11], [-0.15, 9]]) { x.save(); x.translate(0, -7); x.rotate(a); x.beginPath(); x.moveTo(-1.6, 0); x.quadraticCurveTo(-0.5, -h * 0.6, 0, -h); x.quadraticCurveTo(0.5, -h * 0.6, 1.6, 0); x.fill(); x.restore(); } }
    else if (kind === 1) { x.fillStyle = "#C8744A"; x.fillRect(-4, -6, 8, 6); x.fillStyle = "#3F8F5B"; x.beginPath(); rr(x, -2, -17, 4, 12, 2); rr(x, -5.5, -12, 3, 7, 1.5); rr(x, 2.5, -14, 3, 9, 1.5); x.fill(); }
    else { const cs = ["#1B6CA8", "#F3EFE3", "#B0245C"]; cs.forEach((c, i) => { x.fillStyle = c; x.fillRect(-9, -3 - i * 3, 18 - i * 3, 3); }); }
    x.restore();
  }
  function bookcase(x, cx, by, s, w) {
    const h = 68;
    x.save(); x.translate(cx, by); x.scale(s, s);
    ell(x, 0, 0, w / 2 + 4, 3, P.shadow);
    x.fillStyle = P.shelf; x.fillRect(-w / 2, -h, w, h);
    x.fillStyle = "rgba(0,0,0,0.35)"; x.fillRect(-w / 2 + 3, -h + 3, w - 6, h - 6);
    const r = rng(Math.round(w)), cols = ["#1B6CA8", "#F3EFE3", "#FABA5E", "#B0245C", "#2F7F5B", "#6DB4E5", "#8A5A00", "#E98FA6", "#0B2F48", "#C7A3E0"];
    for (let row = 0; row < 3; row++) {
      const sy = -h + 3 + row * 21.5 + 20;
      let bx = -w / 2 + 4;
      while (bx < w / 2 - 6) {
        const bw = 2.6 + r() * 3, bh = 12 + r() * 6;
        if (r() < 0.08) { bx += 5; continue; }
        x.fillStyle = mix(cols[Math.floor(r() * cols.length)], "#0B1A24", 0.25 + (1 - T.day) * 0.15);
        if (r() < 0.07) { x.save(); x.translate(bx, sy); x.rotate(-0.3); x.fillRect(0, -bh, bw, bh); x.restore(); bx += bw + 4; continue; }
        x.fillRect(bx, sy - bh, bw, bh); x.fillStyle = "rgba(255,255,255,0.18)"; x.fillRect(bx, sy - bh + 2, bw, 0.8);
        bx += bw + 0.6;
      }
      x.fillStyle = P.woodEdge; x.fillRect(-w / 2, sy, w, 2);
    }
    x.fillStyle = P.woodEdge; x.fillRect(-w / 2 - 2, -h - 3, w + 4, 3);
    x.fillStyle = "#C8744A"; x.fillRect(w / 2 - 20, -h - 9, 9, 6);         // a trailing plant on top
    for (let i = 0; i < 7; i++) ell(x, w / 2 - 16 + (i % 3) * 3 - 2, -h - 8 + i * 4, 3, 2, i % 2 ? "#3F8F5B" : "#58B07A");
    x.restore();
  }
  function floorLamp(x, px, fy, s) {
    x.save(); x.translate(px, fy); x.scale(s, s);
    ell(x, 0, 0, 9, 2.2, "#0A1822");
    x.strokeStyle = "#16242D"; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -96); x.quadraticCurveTo(2, -112, 26, -106); x.stroke();
    x.fillStyle = mix("#C98A2E", "#E4A544", T.day); x.beginPath(); x.moveTo(18, -110); x.lineTo(34, -110); x.lineTo(38, -99); x.lineTo(14, -99); x.closePath(); x.fill();
    x.fillStyle = T.lamps > 0.1 ? "#FFE8B8" : "#8C7A58"; x.fillRect(16, -99.5, 20, 1.5);
    x.restore();
  }
  function counter(x, cx, by, s, w) {
    const h = 46;
    x.save(); x.translate(cx, by); x.scale(s, s);
    ell(x, 0, 1, w / 2 + 6, 4, P.shadow);
    // back bar: a shelf of cups and a "Bon bini" board
    x.fillStyle = P.woodDark; x.fillRect(-w / 2 + 6, -h - 44, w - 12, 3);
    for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? "#F3EFE3" : "#6DB4E5"; x.beginPath(); rr(x, -w / 2 + 12 + i * 9, -h - 51, 6, 7, [1, 1, 2, 2]); x.fill(); }
    x.fillStyle = "#1B2A24"; x.fillRect(w / 2 - 46, -h - 58, 38, 22); x.strokeStyle = P.woodEdge; x.lineWidth = 2; x.strokeRect(w / 2 - 46, -h - 58, 38, 22);
    x.fillStyle = "rgba(243,239,227,0.88)"; x.font = "italic 300 8.5px Archivo, sans-serif"; x.textAlign = "center"; x.fillText("Bon bini", w / 2 - 27, -h - 44);
    x.fillStyle = P.woodDark; x.fillRect(-w / 2, -h, w, h);
    for (let i = -w / 2 + 3; i < w / 2 - 2; i += 6) { x.fillStyle = "rgba(255,255,255,0.05)"; x.fillRect(i, -h + 7, 3, h - 10); }
    x.fillStyle = mix("#D9D2C0", "#ECE6D6", T.day); x.fillRect(-w / 2 - 4, -h - 6, w + 8, 6);
    x.fillStyle = "rgba(0,0,0,0.25)"; x.fillRect(-w / 2 - 4, -h, w + 8, 2);
    const mx = -w / 2 + 16;           // espresso machine
    shaded(x, mx, -h - 34, 32, 28, 3, mix("#B8C2C8", "#D4DBDF", T.day));
    x.fillStyle = "#0B2F48"; x.fillRect(mx + 3, -h - 30, 26, 8);
    disc(x, mx + 8, -h - 26, 1.6, C.amber); disc(x, mx + 24, -h - 26, 1.6, C.sea);
    x.fillStyle = "#26343C"; x.fillRect(mx + 7, -h - 20, 5, 6); x.fillRect(mx + 20, -h - 20, 5, 6);
    x.fillStyle = "#F3EFE3"; x.fillRect(mx + 7, -h - 11, 5, 5);
    ell(x, w / 2 - 22, -h - 8, 10, 3.5, "#E9E2D0"); for (let i = 0; i < 4; i++) disc(x, w / 2 - 28 + i * 4, -h - 10, 2.6, "#8CC152");     // limes
    x.fillStyle = "rgba(200,230,245,0.5)"; x.fillRect(w / 2 - 50, -h - 18, 9, 12); x.fillStyle = "#6B4A33"; x.fillRect(w / 2 - 50, -h - 11, 9, 5);
    x.restore();
  }
  function kadushi(x, px, fy, s) {
    x.save(); x.translate(px, fy); x.scale(s, s);
    ell(x, 0, 0, 14, 3, P.shadow);
    x.fillStyle = "#A9552F"; x.beginPath(); x.moveTo(-11, -18); x.lineTo(11, -18); x.lineTo(8, 0); x.lineTo(-8, 0); x.closePath(); x.fill();
    x.fillStyle = "#8E4424"; x.fillRect(-11.5, -20, 23, 3);
    const green = mix("#1F5A3C", "#2F7F52", T.day), light = mix("#2B7049", "#43A06A", T.day);
    for (const [ax, ay, aw, ah] of [[0, -20, 9, 92], [-9, -52, 6.5, 34], [9, -46, 6.5, 40]]) {
      x.fillStyle = green; x.beginPath(); rr(x, ax - aw / 2, ay - ah, aw, ah, [aw / 2, aw / 2, 1, 1]); x.fill();
      x.fillStyle = light; x.fillRect(ax - aw * 0.18, ay - ah + aw * 0.4, aw * 0.18, ah - aw * 0.5);
    }
    x.fillStyle = green; x.fillRect(-9, -52, 9, 5); x.fillRect(0, -46, 9, 5);
    x.restore();
  }
  function aloe(x, px, fy, s) { x.save(); x.translate(px, fy); x.scale(s * 1.6, s * 1.6); sillThing(x, 0, 0, 1, 0); x.restore(); }
  function flipChart(x, px, fy, s) {
    x.save(); x.translate(px, fy); x.scale(s, s);
    x.strokeStyle = "#16242D"; x.lineWidth = 2; x.beginPath(); x.moveTo(-14, 0); x.lineTo(0, -80); x.lineTo(14, 0); x.moveTo(0, -80); x.lineTo(0, 0); x.stroke();
    x.fillStyle = "#F3EFE3"; x.fillRect(-20, -86, 40, 46);
    x.strokeStyle = "#1B6CA8"; x.lineWidth = 1.6; x.beginPath(); x.moveTo(-14, -48); x.lineTo(-6, -58); x.lineTo(2, -54); x.lineTo(13, -74); x.stroke();
    x.strokeStyle = "#B0245C"; x.beginPath(); x.moveTo(-14, -78); x.lineTo(-2, -78); x.stroke();
    x.restore();
  }
  function wallClock(x, cx, cy, r) {
    disc(x, cx, cy, r + 2, "#05111A"); disc(x, cx, cy, r, "#F3EFE3");
    x.strokeStyle = "#0B2F48"; x.lineCap = "round";
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; x.lineWidth = i % 3 ? 0.8 : 1.4; x.beginPath(); x.moveTo(cx + Math.sin(a) * r * 0.78, cy - Math.cos(a) * r * 0.78); x.lineTo(cx + Math.sin(a) * r * 0.9, cy - Math.cos(a) * r * 0.9); x.stroke(); }
    const { h, m } = aruba(), ha = ((h % 12) + m / 60) / 12 * TAU, ma = m / 60 * TAU;
    x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.sin(ha) * r * 0.5, cy - Math.cos(ha) * r * 0.5); x.stroke();
    x.lineWidth = 1.3; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.sin(ma) * r * 0.76, cy - Math.cos(ma) * r * 0.76); x.stroke();
    disc(x, cx, cy, 1.4, "#B0245C");
  }
  function pendant(x, px, py, s) {
    // on a phone the cords hang from the window's transom, so none runs through the headline
    const top = L.side ? 0 : Math.min(py - 20 * s, L.hb.bottom + 4);
    x.strokeStyle = "#02070B"; x.lineWidth = 1; x.beginPath(); x.moveTo(px, top); x.lineTo(px, py - 10 * s); x.stroke();
    x.fillStyle = mix("#0D2230", "#1D4760", T.day); x.beginPath(); x.moveTo(px - 4 * s, py - 10 * s); x.lineTo(px + 4 * s, py - 10 * s); x.lineTo(px + 15 * s, py); x.lineTo(px - 15 * s, py); x.closePath(); x.fill();
    x.fillStyle = "rgba(255,255,255,0.1)"; x.fillRect(px - 4 * s, py - 10 * s, 3 * s, 1);
    x.fillStyle = T.lamps > 0.1 ? "#FFE3A6" : "#9A8C6C"; x.beginPath(); x.ellipse(px, py, 14 * s, 2.4 * s, 0, 0, Math.PI); x.fill();
  }

  /* furniture that bots sit at, drawn every frame so they can sit behind it */
  function chair(seat) {
    const { x, y, s } = seat;
    g.save(); g.translate(x, y); g.scale(s, s);
    ell(g, 0, -1, 14, 2.6, P.shadow);
    g.fillStyle = "#0A1822"; g.fillRect(-1.5, -24, 3, 22); ell(g, 0, -2.5, 11, 2, "#0A1822");
    shaded(g, -17, -57, 34, 30, [10, 10, 6, 6], P.chair, 0.8);
    g.fillStyle = P.chairSeat; g.beginPath(); rr(g, -15, -28, 30, 6, 3); g.fill();
    g.restore();
  }
  function desk(bench) {
    const { x0, x1, y, s } = bench, w = (x1 - x0) / s;
    g.save(); g.translate(x0, y); g.scale(s, s);
    ell(g, w / 2, 1, w / 2 + 8, 5, P.shadow);
    g.fillStyle = P.leg; g.fillRect(3, -14, 3.4, 14); g.fillRect(w - 6.4, -14, 3.4, 14);
    g.fillStyle = P.woodTop; g.beginPath(); g.moveTo(3, -42); g.lineTo(w - 3, -42); g.lineTo(w, -35); g.lineTo(0, -35); g.closePath(); g.fill();
    g.fillStyle = "rgba(255,255,255,0.1)"; g.fillRect(6, -41, w - 12, 1);
    // the front panel: wood slats, and the team's name on it
    const pg = g.createLinearGradient(0, -35, 0, -13); pg.addColorStop(0, P.woodEdge); pg.addColorStop(1, P.woodDark);
    g.fillStyle = pg; g.fillRect(0, -35, w, 22);
    g.fillStyle = "rgba(0,0,0,0.16)"; for (let i = 5; i < w - 2; i += 5) g.fillRect(i, -33, 0.7, 19);
    g.fillStyle = "rgba(255,255,255,0.16)"; g.fillRect(0, -35, w, 0.9);
    g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(0, -14, w, 1.2);
    g.restore();
  }
  function deskThings(bench, t) {
    const { x0, x1, y, s } = bench, top = y - 38.5 * s;
    deskLamp(x0 + 11 * s, top, s);
    miniCactus(x1 - 9 * s, top, s);
    for (const seat of bench.seats) {
      const b = byId.get(seat.id), here = b && b.at === seat.key && !b.path.length;
      const on = here && ["working", "waiting", "stuck"].includes(b.state);
      if (b && b.state === "off") closedLaptop(seat.x + 11 * s, top, s);         // gone for the day: lid shut
      else laptop(seat.x + 12 * s, top, s, on, b && b.state === "stuck", t);
      if (b && b.h % 3 !== 1) mug(seat.x - 17 * s, top + 1 * s, s);
      else if (b) paperStack(seat.x - 17 * s, top + 1 * s, s);
    }
  }
  function laptop(x, y, s, on, err, t) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = "#8C99A1"; g.fillRect(-11, -1.5, 22, 2.2);
    g.fillStyle = on ? "#2C4352" : "#233642"; g.beginPath(); rr(g, -10, -15.5, 20, 14.5, 1.8); g.fill();
    g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(-10, -15.5, 20, 1.2);
    mark(g, 0, -8.3, 8, on ? (err ? "#FF8FA6" : "#FFD08A") : "rgba(243,239,227,.25)");
    if (on) { const f = still() ? 0.7 : 0.6 + 0.25 * Math.sin(t / 170 + x); g.fillStyle = err ? `rgba(255,120,150,${f})` : `rgba(170,220,250,${f})`; g.fillRect(-9.5, -16.4, 19, 0.9); }
    g.restore();
  }
  function closedLaptop(x, y, s) { g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = "#8C99A1"; g.fillRect(-11, -3, 22, 3.2); g.fillStyle = "#6D7B84"; g.fillRect(-11, -3, 22, 1); g.restore(); }
  function mug(x, y, s) { g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = "#F3EFE3"; g.beginPath(); rr(g, -3, -7, 6, 7, [1, 1, 2, 2]); g.fill(); g.strokeStyle = "#F3EFE3"; g.lineWidth = 1.2; g.beginPath(); g.arc(3.6, -3.6, 1.8, -1.2, 1.2); g.stroke(); g.fillStyle = "#B0245C"; g.fillRect(-3, -4.5, 6, 1.2); g.restore(); }
  function paperStack(x, y, s) { g.save(); g.translate(x, y); g.scale(s, s); for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? "#E9E3D3" : "#F7F3E8"; g.fillRect(-6 + (i % 2), -1.4 - i * 1.4, 12, 1.4); } g.restore(); }
  function deskLamp(x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    ell(g, 0, 0, 5.5, 1.8, "#0A1822");
    g.strokeStyle = "#1A2A33"; g.lineWidth = 1.7; g.beginPath(); g.moveTo(0, 0); g.lineTo(-3, -13); g.lineTo(5, -21); g.stroke();
    g.save(); g.translate(6, -21); g.rotate(0.55);
    g.fillStyle = mix("#C98A2E", "#E4A544", T.day); g.beginPath(); g.moveTo(-3, -3.5); g.lineTo(3, -3.5); g.lineTo(6.5, 4); g.lineTo(-6.5, 4); g.closePath(); g.fill();
    g.fillStyle = T.lamps > 0.1 ? "#FFF0C8" : "#8C7A58"; g.fillRect(-6, 3.4, 12, 1.4);
    g.restore(); g.restore();
  }
  function miniCactus(x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = "#B8653A"; g.beginPath(); g.moveTo(-4, -6); g.lineTo(4, -6); g.lineTo(3.2, 0); g.lineTo(-3.2, 0); g.closePath(); g.fill();
    g.fillStyle = mix("#2A6E48", "#3F8F5B", T.day); g.beginPath(); rr(g, -2, -18, 4, 13, 2); rr(g, -5.5, -13, 3, 6, 1.5); rr(g, 2.5, -15, 3, 7, 1.5); g.fill();
    g.restore();
  }
  function meetingTable() {
    const { x, y } = L.meet, s = L.zs;
    g.save(); g.translate(x, y); g.scale(s, s);
    ell(g, 0, 1, 52, 7, P.shadow);
    g.fillStyle = P.leg; g.fillRect(-2.5, -27, 5, 27); ell(g, 0, 0, 13, 2.8, P.leg);
    ell(g, 0, -27, 50, 9.5, P.woodEdge); ell(g, 0, -30.5, 50, 9.5, P.woodTop);
    g.fillStyle = "rgba(255,255,255,0.1)"; g.beginPath(); g.ellipse(-12, -33, 22, 3, 0, 0, TAU); g.fill();
    g.save(); g.translate(-18, -30); g.rotate(-0.15); g.fillStyle = "#F7F3E8"; g.fillRect(-7, -4, 14, 8); g.fillStyle = "#E9E3D3"; g.fillRect(-5, -6, 14, 8); g.restore();
    g.fillStyle = "#1B6CA8"; g.fillRect(-10, -31, 6, 0.8); g.fillRect(-10, -29.5, 8, 0.8);
    g.save(); g.translate(20, -31); g.fillStyle = "#8C99A1"; g.fillRect(-9, 0, 18, 2); g.fillStyle = "#2C4352"; g.beginPath(); rr(g, -8, -12, 16, 12, 1.5); g.fill(); mark(g, 0, -6, 6, "#FFD08A"); g.restore();
    g.fillStyle = "#F3EFE3"; g.beginPath(); rr(g, 2, -36, 5, 6, [1, 1, 2, 2]); g.fill();
    g.restore();
  }
  function meetChair(seat) {
    const { x, y, s } = seat;
    g.save(); g.translate(x, y); g.scale(s, s);
    if (seat.kind === "back") { shaded(g, -15, -56, 30, 26, [10, 10, 4, 4], P.chair, 0.8); }
    else { ell(g, 0, -1, 12, 2.4, P.shadow); g.fillStyle = "#0A1822"; g.fillRect(-10, -20, 2, 20); g.fillRect(8, -20, 2, 20); shaded(g, -16, -50, 32, 26, [10, 10, 4, 4], P.chair, 0.8); g.fillStyle = P.chairSeat; g.beginPath(); rr(g, -15, -24, 30, 5, 2.5); g.fill(); }
    g.restore();
  }
  function armchair(seat, front) {
    const { x, y, s } = seat, c1 = mix("#A4583A", "#C06C44", T.day), c2 = mix("#8A4A30", "#A85C3A", T.day);
    g.save(); g.translate(x, y); g.scale(s, s);
    if (!front) {
      ell(g, 0, 0, 26, 3.5, P.shadow);
      g.fillStyle = "#1A120D"; g.fillRect(-20, -6, 3, 6); g.fillRect(17, -6, 3, 6);
      shaded(g, -22, -60, 44, 44, [15, 15, 6, 6], c1);
      shaded(g, -21, -24, 42, 17, 5, mix(c1, "#FFFFFF", 0.06));
    } else { shaded(g, -26, -36, 10, 30, 5, c2); shaded(g, 16, -36, 10, 30, 5, c2); }
    g.restore();
  }
  function beanbag(seat) {
    const { x, y, s } = seat, lounge = seat.key.startsWith("lounge");
    g.save(); g.translate(x, y); g.scale(s, s);
    ell(g, 0, 0, 22, 3.5, P.shadow);
    g.beginPath(); g.moveTo(-21, 0); g.bezierCurveTo(-26, -16, -14, -28, 0, -26); g.bezierCurveTo(14, -28, 26, -16, 21, 0); g.closePath();
    paint(g, lounge ? mix("#8A3B2E", "#C8553D", P.d) : mix("#1F5E80", "#2E7AA0", T.day), -24, -28, 48, 28);
    g.restore();
  }
  // The lounge: a hammock in the flag's blue with its two yellow stripes, strung between two posts.
  function hammock(seat, front) {
    const { x, y, s } = seat, hw = seat.span / 2, e = hw - 12, blue = mix("#2A64A0", "#3F8FD8", P.d), yel = "#F2C94C";
    g.save(); g.translate(x, y); g.scale(s, s);
    if (!front) {
      ell(g, 0, 0, hw + 8, 4, P.shadow);
      for (const sx of [-1, 1]) {
        g.fillStyle = P.woodDark; g.fillRect(sx * hw - 2.5, -68, 5, 68);
        g.fillStyle = P.woodEdge; g.fillRect(sx * hw - 2.5, -68, 5, 2.4);
        g.strokeStyle = mix("#8C7A5A", "#D8C9A6", P.d); g.lineWidth = 0.9; g.beginPath();
        for (const k of [-1, 0, 1]) { g.moveTo(sx * hw, -60); g.lineTo(sx * e, -47 + k * 2.4); }
        g.stroke();
      }
      g.fillStyle = mix(blue, "#04111A", 0.42); g.beginPath(); g.moveTo(-e, -47); g.quadraticCurveTo(0, -40, e, -47); g.quadraticCurveTo(0, 2, -e, -47); g.fill();
    } else {
      // the front of the cloth, in the flag's blue with its two yellow stripes, over whoever's napping
      g.fillStyle = blue; g.beginPath(); g.moveTo(-e, -47); g.quadraticCurveTo(-e * 0.2, -14, e, -47); g.quadraticCurveTo(0, 6, -e, -47); g.fill();
      g.save(); g.clip();
      g.strokeStyle = yel; g.lineWidth = 1.6;
      for (const c of [-4, 0.5]) { g.beginPath(); g.moveTo(-e, -47); g.quadraticCurveTo(0, c, e, -47); g.stroke(); }
      g.fillStyle = "rgba(255,255,255,0.14)"; g.beginPath(); g.moveTo(-e, -47); g.quadraticCurveTo(-e * 0.2, -14, e, -47); g.quadraticCurveTo(-e * 0.2, -10, -e, -47); g.fill();
      g.restore();
    }
    g.restore();
  }
  /* who sits where */
  const ORIGIN = { desk: 27, armchair: 21, beanbag: 14, shelf: 11, back: 26, side: 21, bar: 11, walk: 11, hammock: 24 };
  function pose(b) {
    if (b.path.length) return "walk";
    return { working: "type", waiting: "wave", stuck: "stuck", studying: "read", meeting: b.talking ? "talk" : "listen", lunch: "sip", off: "sleep" }[b.state] || "stand";
  }
  function seatFor(b, free) {
    const where = STATES[b.state].where;
    if (where !== "desk" && free[where] && free[where].length) return free[where].shift();
    return "desk:" + b.id;      // no room over there: they do it at their own desk
  }
  function assign(first) {
    const lounge = L.benches.find((bn) => bn.lounge);
    const free = { library: L.lib.seats.map((s) => s.key), meeting: L.meet.seats.map((s) => s.key), cafe: L.cafe.seats.map((s) => s.key), lounge: lounge ? lounge.seats.map((s) => s.key) : [] };
    // stable order: whoever got there first keeps their seat
    const order = [...bots].sort((a, b) => (a.since || 0) - (b.since || 0));
    for (const b of order) {
      const key = seatFor(b, free), seat = L.seats.get(key);
      if (!seat) continue;
      if (first || still() || !b.pos) { b.at = key; b.pos = { x: seat.x, y: seat.y }; b.path = []; }
      else if (b.at !== key) {
        const from = L.seats.get(b.at) || seat;
        b.path = route(from, seat, b.pos); b.at = key;
      }
    }
    bots.filter((b) => b.state === "meeting").forEach((b, i) => { b.talking = i === 0; });
  }
  function route(from, to, pos) {
    const A = L.aisleY, edge = (x) => (x < L.rx0 + L.RW / 2 ? L.rx0 + 22 : W - 22), pts = [];
    if (from.bench) { const by = from.y - 12 * from.s; pts.push({ x: pos.x, y: by }, { x: edge(pos.x), y: by }, { x: edge(pos.x), y: A }); }
    else pts.push({ x: pos.x, y: A });
    if (to.bench) { const ty = to.y - 12 * to.s, e = edge(to.x); pts.push({ x: e, y: A }, { x: e, y: ty }, { x: to.x, y: ty }, { x: to.x, y: to.y }); }
    else pts.push({ x: to.x, y: A }, { x: to.x, y: to.y });
    return pts;
  }
  function step(dt) {
    let moving = false;
    for (const b of bots) {
      if (!b.path.length) continue;
      moving = true;
      const n = b.path[0], sp = dt * 0.075 * L.S, dx = n.x - b.pos.x, dy = n.y - b.pos.y, d = Math.hypot(dx, dy);
      if (d <= sp) { b.pos.x = n.x; b.pos.y = n.y; b.path.shift(); if (!b.path.length) planDirty = true; }
      else { b.pos.x += (dx / d) * sp; b.pos.y += (dy / d) * sp; }
    }
    return moving;
  }

  /* one frame */
  function frame(now) {
    raf = 0;
    if (!L || !W) return;
    const t = now - T0, dt = Math.min(64, now - (lastT || now)); lastT = now; frameNow = now;
    const tn = still() ? 0 : Math.floor(t / 9000);
    if (tn !== turn) { turn = tn; planDirty = true; }
    const moving = step(dt);
    const { h, m, hf } = aruba();
    if (h * 60 + m !== lookMin) {
      lookMin = h * 60 + m; T = timeLook(hf); P = interior(T); paintLayers();
      const light = T.day > 0.85 ? "day" : "night";
      if (hero && hero.dataset.light !== light) hero.dataset.light = light;
    }
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.drawImage(layers.sky, 0, 0, W, H);
    skyLife(t);
    g.drawImage(layers.room, 0, 0, W, H);
    // pools of lamplight on the floor, under everything
    g.globalCompositeOperation = "lighter";
    const lamps = T.lamps;
    for (const p of L.pendants) { floorPool(p.x, L.zoneY + 6 * L.zs, 80 * L.S, 0.1 * lamps); cone(p.x, p.y, L.zoneY, 0.05 * lamps); }
    for (const bench of L.benches) floorPool((bench.x0 + bench.x1) / 2, bench.y - 20 * bench.s, (bench.x1 - bench.x0) * 0.62, (bench.lounge ? 0.05 : 0.09) * lamps);
    floorPool(L.libLamp.x + 30 * L.zs, L.zoneY, 70 * L.S, 0.1 * lamps);
    g.globalCompositeOperation = "source-over";
    // the room, back to front
    const list = [];
    for (const bench of L.benches) {
      if (bench.lounge) {
        const hm = bench.seats[0], bb = bench.seats[1];
        list.push([hm.y - 0.9, () => hammock(hm, false)], [hm.y + 0.35, () => hammock(hm, true)], [bb.y - 0.9, () => beanbag(bb)]);
        continue;
      }
      for (const seat of bench.seats) list.push([bench.y - 0.9, () => chair(seat)]);
      list.push([bench.y, () => desk(bench)], [bench.y + 0.5, () => deskThings(bench, t)]);
    }
    list.push([L.meet.y, meetingTable]);
    for (const seat of L.meet.seats) list.push([seat.y - 0.9, () => meetChair(seat)]);
    for (const seat of L.lib.seats) {
      if (seat.kind === "armchair") list.push([seat.y - 0.9, () => armchair(seat, false)], [seat.y + 0.4, () => armchair(seat, true)]);
      if (seat.kind === "beanbag") list.push([seat.y - 0.9, () => beanbag(seat)]);
    }
    for (const b of bots) {
      if (!b.pos) continue;
      const seat = L.seats.get(b.at);
      if (!seat) continue;
      const walking = b.path.length > 0, kind = walking ? "walk" : seat.kind;
      const s = walking ? depthS(b.pos.y) : seat.s, bx = b.pos.x + (kind === "hammock" ? 17 * s : 0), by = b.pos.y - ORIGIN[kind] * s;
      const pz = walking ? b.pos.y : seat.y;
      const opts = botOpts(b, kind, seat, lamps, t);
      const k = appear(b, t);
      b.screen = { x: bx, y: by, s: s * k, s0: s, kind };
      if (b.id === selId || b.id === focusId) list.push([pz - 0.95, () => ring(b.pos.x, b.pos.y + (kind === "desk" ? -8 * s : 2 * s), s)]);
      const draw = (pass) => () => {
        g.save(); g.translate(bx, by); if (kind === "hammock") g.rotate(-1.22); g.scale(s * k, s * k);
        const r = drawBot(g, b, t, { ...opts, pass }); g.restore();
        if (kind === "hammock") { b.hc = -4; b.top = -14; } else { b.hc = r.hc; b.top = r.top; }
      };
      if (kind === "desk") list.push([pz - 0.3, draw("body")], [pz + 0.3, draw("arms")]);
      else if (kind === "back") list.push([L.meet.y - 0.5, draw("all")]);
      else if (kind === "armchair") list.push([pz - 0.2, draw("all")]);
      else if (kind === "hammock") list.push([pz + 0.1, draw("all")]);
      else list.push([pz + 0.2, draw("all")]);
    }
    list.sort((a, b) => a[0] - b[0]);
    for (const [, f] of list) f();
    // the night: the room falls dark except where a lamp, a screen or the window lights it
    g.drawImage(lightmap(), 0, 0, W, H);
    const rise = still() ? 1 : clamp((t - 150) / 1100, 0, 1);
    if (rise < 1) { g.fillStyle = `rgba(2,8,14,${(0.55 * (1 - rise) * (1 - rise)).toFixed(3)})`; g.fillRect(0, 0, W, H); }
    benchLabels();
    // light: lamps, screens, Spark's bulb
    g.globalCompositeOperation = "lighter";
    for (const p of L.pendants) glow(g, p.x, p.y + 2, 44 * L.S, "#FFB64D", 0.35 * lamps);
    glow(g, L.libLamp.x + 26 * L.zs, L.libLamp.y + 8 * L.zs, 50 * L.S, "#FFB64D", 0.34 * lamps);
    for (const bench of L.benches) if (!bench.lounge) glow(g, bench.x0 + 16 * bench.s, bench.y - 50 * bench.s, 34 * bench.s, "#FFB64D", 0.42 * lamps);
    for (const b of bots) {
      if (!b.screen || b.path.length) continue;
      const { x, y, s } = b.screen;
      if (b.screen.kind === "desk" && ["working", "waiting", "stuck"].includes(b.state)) {
        const f = still() ? 1 : 0.85 + 0.15 * Math.sin(t / 230 + b.ph);
        glow(g, x + 6 * s, y + (b.hc || -40) * s + 6 * s, 30 * s, b.state === "stuck" ? "#FF6B8B" : "#6DB4E5", (0.1 + 0.3 * lamps) * f);
      }
      if (b.cast.acc === "bulb" && b.state !== "off" && b.screen.kind !== "hammock") glow(g, x, y + ((b.top || -70) + 4) * s, 26 * s, "#FFC766", 0.3 + 0.35 * lamps);
    }
    glow(g, L.cafe.machine.x, L.cafe.machine.y + 10 * L.zs, 22 * L.zs, "#FABA5E", 0.4 * lamps);
    motes(t, lamps);
    g.globalCompositeOperation = "source-over";
    steam(g, L.cafe.machine.x - 4 * L.zs, L.cafe.machine.y - 2 * L.zs, t / 1000, !still(), 0.5, 3, 18 * L.zs);
    // what needs you, and what the others are doing
    const intro = bots.some((b) => b.appearAt != null);
    if (planDirty && !moving && !intro) makePlan();
    if (!intro) {
      for (const b of bots) if (b.state === "off" && b.screen && !b.path.length && !flagged(b)) zzz(b, t);
      for (const p of plan) if (!p.alert) bubble(p);
      for (const p of plan) if (p.alert) callout(p, t);
    }
    placeHits();
    started = started || now;
    schedule(moving || intro || now - started < 1400 || now - planAt < 520);
  }
  const lightCv = document.createElement("canvas");
  let lightKey = "";
  function lightmap() {
    const key = [W, H, LDPR, lookMin, L.benches.length, ...bots.map((b) => b.at + ":" + b.state)].join("|");
    if (key === lightKey) return lightCv;
    lightKey = key;
    lightCv.width = Math.round(W * LDPR); lightCv.height = Math.round(H * LDPR);
    const k = lightCv.getContext("2d"), S = L.S, A = 0.05 + 0.66 * T.lamps;
    k.setTransform(LDPR, 0, 0, LDPR, 0, 0);
    k.fillStyle = `rgba(2,8,14,${A.toFixed(3)})`; k.fillRect(0, 0, W, H);
    k.globalCompositeOperation = "destination-out";
    const hole = (x, y, rx, ry, a) => {
      k.save(); k.translate(x, y); k.scale(1, ry / rx);
      const gr = k.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.5, `rgba(0,0,0,${(a * 0.62).toFixed(3)})`); gr.addColorStop(1, "rgba(0,0,0,0)");
      k.fillStyle = gr; k.fillRect(-rx, -rx, rx * 2, rx * 2); k.restore();
    };
    for (const w of L.windows) {        // the windows, and the glow they throw just inside
      k.fillStyle = "#000"; k.fillRect(w.x - 6 * S, w.y, w.w + 12 * S, w.h);
      const lg = k.createLinearGradient(0, w.y + w.h, 0, L.floorY + 26 * S);
      lg.addColorStop(0, "rgba(0,0,0,1)"); lg.addColorStop(1, "rgba(0,0,0,0)");
      k.fillStyle = lg; k.fillRect(w.x - 6 * S, w.y + w.h, w.w + 12 * S, L.floorY + 26 * S - (w.y + w.h));
    }
    for (const p of L.pendants) { hole(p.x, p.y + 8 * S, 46 * S, 46 * S, 0.9); hole(p.x, L.zoneY - 4 * L.zs, 96 * S, 44 * S, 0.85); }
    hole(L.libLamp.x + 26 * L.zs, L.libLamp.y + 30 * L.zs, 70 * S, 70 * S, 0.9);
    hole(L.lib.x, L.zoneY - 10 * L.zs, 90 * S, 50 * S, 0.7);
    hole(L.cafe.x, L.zoneY - 20 * L.zs, 90 * S, 60 * S, 0.75);
    for (const bn of L.benches) {
      const cx = (bn.x0 + bn.x1) / 2, w = bn.x1 - bn.x0;
      if (!bn.lounge) hole(bn.x0 + 18 * bn.s, bn.y - 44 * bn.s, 70 * bn.s, 60 * bn.s, 0.95);
      hole(cx, bn.y - 30 * bn.s, w * 0.62, 46 * bn.s, bn.lounge ? 0.4 : 0.55);
    }
    for (const b of bots) {
      const seat = L.seats.get(b.at);
      if (!seat || seat.kind !== "desk" || !["working", "waiting", "stuck"].includes(b.state)) continue;
      hole(seat.x + 4 * seat.s, seat.y - 52 * seat.s, 40 * seat.s, 40 * seat.s, 0.9);
    }
    k.globalCompositeOperation = "source-over";
    const vg = k.createRadialGradient(L.rx0 + L.RW / 2, H * 0.48, Math.min(W, H) * 0.35, L.rx0 + L.RW / 2, H * 0.48, Math.max(W, H) * 0.78);
    vg.addColorStop(0, "rgba(2,9,14,0)"); vg.addColorStop(1, `rgba(2,9,14,${(0.08 + 0.42 * T.lamps).toFixed(2)})`);
    k.fillStyle = vg; k.fillRect(0, 0, W, H);
    return lightCv;
  }
  function glance(b, t) {
    // now and then a bot at its desk looks up from the screen, then back to work
    if (still() || b.state !== "working") return 0;
    const c = (t / 1000 + b.ph * 3.1) % 13;
    return c < 1.6 ? Math.sin((c / 1.6) * Math.PI) * (b.h % 2 ? 1 : -1) : 0;
  }
  function botOpts(b, kind, seat, lamps, t = 0) {
    const desk = kind === "desk", sleeping = b.state === "off" && !b.path.length;
    return {
      pose: pose(b), legs: kind === "walk" || kind === "bar" || kind === "shelf" ? "stand" : (kind === "side" || kind === "armchair" || kind === "beanbag" || desk) ? "sit" : null,
      dim: sleeping ? (kind === "hammock" || kind === "beanbag" ? 0.22 : 0.45) : 0, glow: lamps, lit: desk && ["working", "waiting", "stuck"].includes(b.state) ? 0.4 + 0.6 * lamps : 0,
      rim: sleeping ? 0 : (desk || kind === "armchair" || kind === "bar" ? 0.55 : 0.3) * lamps,
      look: seat && seat.look != null && !b.path.length ? seat.look : desk && !b.path.length ? glance(b, t) : 0,
    };
  }
  function appear(b, t) {
    if (still()) { b.appearAt = null; return 1; }
    if (b.appearAt == null) return 1;
    const k = clamp((t - b.appearAt) / 420, 0, 1);
    if (k >= 1) { b.appearAt = null; return 1; }
    const c1 = 1.7, c3 = c1 + 1; return Math.max(0.001, 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2));
  }
  function floorPool(x, y, r, a) {
    if (a <= 0.003) return;
    g.save(); g.translate(x, y); g.scale(1, 0.28); glow(g, 0, 0, r, "#FFB64D", a); g.restore();
  }
  function cone(x, y, fy, a) {
    if (a <= 0.003) return;
    const gr = g.createLinearGradient(0, y, 0, fy); gr.addColorStop(0, rgba("#FFC766", a)); gr.addColorStop(1, rgba("#FFC766", 0));
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - 13 * L.S, y); g.lineTo(x + 13 * L.S, y); g.lineTo(x + 60 * L.S, fy); g.lineTo(x - 60 * L.S, fy); g.closePath(); g.fill();
  }
  // dust turning slowly in the pendant light, the way it does in a quiet room at night
  const MOTES = Array.from({ length: 16 }, (_, i) => { const r = rng(300 + i); return [r(), r(), r() * TAU, 0.6 + r() * 0.8]; });
  function motes(t, lamps) {
    if (lamps < 0.2) return;
    const live = !still(), S = L.S;
    for (const p of L.pendants) {
      const top = p.y + 4 * S, h = L.zoneY - top;
      MOTES.forEach(([u, v, ph, sz]) => {
        const k = live ? (((v - t / 26000 * (0.6 + sz * 0.4)) % 1) + 1) % 1 : v, y = top + h * (0.08 + 0.9 * k);
        const half = (13 + 47 * (y - top) / h) * S * 0.8, x = p.x + (u - 0.5) * 2 * half + (live ? Math.sin(t / 2300 + ph) * 3 * S : 0);
        const a = lamps * 0.75 * Math.sin(Math.PI * (0.08 + 0.9 * k)) * (live ? 0.6 + 0.4 * Math.sin(t / 900 + ph * 2) : 0.8);
        g.fillStyle = `rgba(255,226,170,${a.toFixed(3)})`; g.beginPath(); g.arc(x, y, Math.max(0.6, 0.8 * sz * S), 0, TAU); g.fill();
      });
    }
  }
  function ring(x, y, s) {
    g.strokeStyle = rgba(C.amber, 0.9); g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, 26 * s, 6 * s, 0, 0, TAU); g.stroke();
    g.fillStyle = rgba(C.amber, 0.14); g.fill();
  }
  const stars = [], clouds = [];
  function skyLife(t) {
    const live = !still(), tt = live ? t : 0, S = L.S, span = L.winRight - L.winLeft;
    if (T.stars > 0.05) {
      if (!stars.length) { const r = rng(77); for (let i = 0; i < 90; i++) stars.push([r(), r(), 0.5 + r() * 0.9, r() * 6]); }
      // only in the open sky under the words, and fewer of them when that's a narrow band
      const top = L.skyTop, hgt = L.horizon - L.skyTop - 8, n = Math.round(90 * clamp(hgt / Math.max(1, L.horizon - L.winTop - 8), 0.3, 1));
      if (hgt > 4) for (const [u, v, sz, ph] of stars.slice(0, n)) {
        const a = T.stars * (live ? 0.45 + 0.4 * Math.sin(t / 700 + ph * 3) : 0.7) * (1 - v * 0.6);
        g.fillStyle = `rgba(243,239,227,${a.toFixed(3)})`; g.fillRect(L.winLeft + u * span, top + v * v * hgt, sz, sz);
      }
    }
    // trade-wind clouds, flat underneath, drifting west
    const cloudA = clamp(T.day * 1.1 - 0.1, 0, 1);
    if (cloudA > 0) {
      if (!clouds.length) { const r = rng(5); for (let i = 0; i < 7; i++) clouds.push([r(), 0.14 + r() * 0.42, 40 + r() * 64, 0.6 + r() * 0.8]); }
      const cc = mix("#FFFFFF", "#F7C3A0", clamp((T.hf - 17) / 1.8, 0, 1) * (T.hf < 20 ? 1 : 0)), under = mix(cc, T.skyMid, 0.3);
      for (const [u, v, w0, sp] of clouds.slice(0, L.wide ? 7 : 4)) {
        const w = w0 * S, run = span + w * 2, cx = L.winLeft - w + ((((u * run - tt / 1000 * 2.2 * sp * S) % run) + run) % run), cy = L.winTop + v * (L.horizon - L.winTop);
        g.fillStyle = rgba(cc, 0.86 * cloudA);
        g.beginPath(); g.ellipse(cx, cy, w * 0.5, 5 * S, 0, 0, TAU); g.ellipse(cx - w * 0.14, cy - 5 * S, w * 0.2, 7 * S, 0, 0, TAU); g.ellipse(cx + w * 0.12, cy - 4 * S, w * 0.24, 6.5 * S, 0, 0, TAU); g.ellipse(cx + w * 0.32, cy - 1 * S, w * 0.14, 4.5 * S, 0, 0, TAU); g.fill();
        g.fillStyle = rgba(under, 0.7 * cloudA); g.beginPath(); g.ellipse(cx, cy + 2.2 * S, w * 0.46, 2.6 * S, 0, 0, TAU); g.fill();
      }
    }
    if (T.day > 0.4 && live) {         // sun glints on the water
      const r = rng(19);
      for (let i = 0; i < (L.wide ? 40 : 22); i++) {
        const gx = L.winLeft + r() * span, gy = L.horizon + 3 + r() * (L.winBot - L.horizon) * 0.5, ph = r() * 20, a = Math.pow(Math.max(0, Math.sin(tt / 380 + ph)), 8);
        if (a > 0.05) { g.fillStyle = rgba("#FFFFFF", 0.75 * a * T.day); g.fillRect(gx, gy, 3 * S, Math.max(1, 0.8 * S)); }
      }
    }
    if (L.ship) {       // a catamaran on its sunset run: sails by day, a string of lights by night
      const run = span + 80 * S, bx = L.winLeft - 40 * S + ((tt / 1000 * 3.2 * S) % run), by = L.horizon + (L.ship.wy - L.horizon) * 0.42;
      const night = 1 - T.day;
      g.fillStyle = mix("#E8ECEC", "#0E1E28", night); g.beginPath(); g.moveTo(bx - 9 * S, by - 2 * S); g.lineTo(bx + 9 * S, by - 2 * S); g.lineTo(bx + 7 * S, by); g.lineTo(bx - 8 * S, by); g.closePath(); g.fill();
      g.strokeStyle = mix("#5E6F7A", "#22333E", night); g.lineWidth = Math.max(0.8, 0.5 * S); g.beginPath(); g.moveTo(bx, by - 2 * S); g.lineTo(bx, by - 17 * S); g.stroke();
      if (night < 0.6) { g.fillStyle = rgba("#FFFFFF", 0.95 * (1 - night)); g.beginPath(); g.moveTo(bx + 0.6 * S, by - 16 * S); g.lineTo(bx + 0.6 * S, by - 3.5 * S); g.lineTo(bx + 8 * S, by - 3.5 * S); g.closePath(); g.fill(); g.beginPath(); g.moveTo(bx - 0.6 * S, by - 14 * S); g.lineTo(bx - 0.6 * S, by - 3.5 * S); g.lineTo(bx - 6 * S, by - 3.5 * S); g.closePath(); g.fill(); }
      if (night > 0.3) {
        const cols = ["#FFD27A", "#FF8FA6", "#8FD3FF", "#B8F2A0"];
        for (let i = 0; i <= 8; i++) { const k = i / 8, lx = lerp(bx - 9 * S, bx, k < 0.5 ? k * 2 : 1) + (k >= 0.5 ? (k - 0.5) * 2 * 9 * S : 0), ly = k < 0.5 ? lerp(by - 2 * S, by - 17 * S, k * 2) : lerp(by - 17 * S, by - 2 * S, (k - 0.5) * 2); g.fillStyle = rgba(cols[i % 4], 0.9 * night); g.fillRect(lx, ly, Math.max(1, 0.9 * S), Math.max(1, 0.9 * S)); }
        g.fillStyle = rgba("#FFD27A", 0.18 * night); for (let k = 1; k < 5; k++) g.fillRect(bx - 5 * S, by + k * 2 * S, 10 * S, Math.max(1, 0.6 * S));
      }
    }
    if (L.lighthouse && T.stars > 0.3) {        // the California lighthouse, turning
      const { x: lx, y: ly } = L.lighthouse, a = (tt / 9000) % TAU, dir = Math.cos(a), face = Math.pow(Math.max(0, Math.sin(a)), 6);
      g.globalCompositeOperation = "lighter";
      glow(g, lx, ly, (5 + 16 * face) * S, "#FFF1C8", (0.35 + 0.55 * face) * T.stars);
      if (Math.abs(dir) > 0.04) {
        const len = 150 * S * Math.abs(dir), ex = lx + Math.sign(dir) * len, gr = g.createLinearGradient(lx, 0, ex, 0);
        gr.addColorStop(0, rgba("#FFF1C8", 0.22 * T.stars)); gr.addColorStop(1, rgba("#FFF1C8", 0));
        g.fillStyle = gr; g.beginPath(); g.moveTo(lx, ly - 0.6 * S); g.lineTo(ex, ly - 5 * S * Math.abs(dir)); g.lineTo(ex, ly + 3 * S * Math.abs(dir)); g.lineTo(lx, ly + 0.6 * S); g.closePath(); g.fill();
      }
      g.globalCompositeOperation = "source-over";
    }
    if (T.day > 0.5 && live) {         // gulls, by day
      for (let i = 0; i < 3; i++) {
        const run = span + 60 * S, px = L.winRight + 20 * S - ((tt / 1000 * (7 + i * 1.3) * S + i * run / 3) % run), py = L.skyTop + (L.horizon - L.skyTop) * (0.3 + i * 0.12) + Math.sin(tt / 1400 + i) * 4 * S;
        const f = Math.sin(tt / 170 + i * 2) * 2.2 * S, w = 4.5 * S;
        g.strokeStyle = rgba("#1F3445", 0.7); g.lineWidth = Math.max(1, 0.9 * S); g.lineCap = "round";
        g.beginPath(); g.moveTo(px - w, py - f); g.quadraticCurveTo(px - w * 0.4, py - 1.5 * S - f * 0.3, px, py); g.quadraticCurveTo(px + w * 0.4, py - 1.5 * S - f * 0.3, px + w, py - f); g.stroke();
      }
    }
    if (live) {            // a plane coming in to Queen Beatrix
      const period = 90000, k = (t % period) / period;       // slow enough to glide at the studio's few frames a second
      if (k < 0.55) {
        const x = lerp(L.winRight + 20, L.winLeft - 20, k / 0.55), y = L.skyTop + (L.horizon - L.skyTop) * (0.16 + (k / 0.55) * 0.3);
        if (T.day > 0.5) { g.fillStyle = "rgba(20,40,55,.55)"; g.fillRect(x - 5 * L.S, y, 10 * L.S, 1.4 * L.S); g.fillRect(x - 1.5 * L.S, y - 2 * L.S, 2.5 * L.S, 5 * L.S); }
        else { const blink = Math.floor(t / 450) % 3 === 0; disc(g, x, y, 1.1 * L.S, "#FF5A5A"); if (blink) disc(g, x + 5 * L.S, y, 1.2 * L.S, "#FFFFFF"); }
      }
    }
  }
  function zzz(b, t) {
    const { x, y, s } = b.screen, live = !still();
    g.fillStyle = P.d > 0.5 && b.screen.kind !== "desk" ? "rgba(11,47,72,0.7)" : "rgba(195,201,201,0.85)"; g.textAlign = "center";
    for (let i = 0; i < 3; i++) {
      // drifting up and away; held still (and spread out, so they read as "z z z") without motion
      const k = live ? ((t / 2600 + i / 3 + b.ph) % 1) : 0.12 + i * 0.36, a = live ? Math.sin(k * Math.PI) : 0.85 - i * 0.15;
      g.globalAlpha = a; g.font = `500 ${Math.round((8 + k * 5) * s)}px Archivo, system-ui, sans-serif`;
      g.fillText("z", x + (12 + k * 13) * s, y + ((b.top || -70) + 4 - k * 20) * s);
    }
    g.globalAlpha = 1;
  }
  function badgePos(b) { if (b.badge) return b.badge; const { x, y, s } = b.screen; const r = 12 * clamp(s, 0.92, L.wide ? 1.2 : 1.1); return { x: x + 1 * s, y: y + ((b.top || -70) - 8) * s - r, r }; }
  function badgeRect(b) { const p = badgePos(b); return { id: b.id, x: p.x - p.r - 3, y: p.y - p.r - 3, w: p.r * 2 + 6, h: p.r * 2 + 12 }; }
  /* speech bubbles: who says what, placed so they don't cover faces, team names or each other */
  function bubbleText(b) {
    if (b.state === "off" || b.state === "lunch") return "";
    return (b.task || "").replace(/\s+/g, " ").trim();
  }
  function alertLine(b) {
    const a = alertMap.get(b.id);
    let t = (a && a.text) || bubbleText(b);
    t = String(t || "").replace(/\s+/g, " ").trim();
    // "Pipeline tracker: needs the lead-form fields" -> the part after the colon is what you need to know
    const m = /^([^:]{2,26}):\s+(.{6,})$/.exec(t);
    if (m && b.state === "stuck") t = m[2].charAt(0).toUpperCase() + m[2].slice(1);
    return t || (b.state === "stuck" ? "Stuck" : "Needs you");
  }
  function wrap(text, maxW, maxLines) {
    const words = text.split(" "), lines = [];
    let cur = "", i = 0;
    for (; i < words.length; i++) {
      const test = cur ? cur + " " + words[i] : words[i];
      if (g.measureText(test).width <= maxW || !cur) cur = test;
      else { lines.push(cur); cur = words[i]; if (lines.length === maxLines) break; }
    }
    if (lines.length < maxLines && cur) { lines.push(cur); i = words.length; }
    if (i < words.length) { let last = lines[lines.length - 1]; while (last.length > 1 && g.measureText(last + "…").width > maxW) last = last.slice(0, -1); lines[lines.length - 1] = last.replace(/[\s,:;.]+$/, "") + "…"; }
    return lines.map((l) => (g.measureText(l).width > maxW ? l.slice(0, Math.max(1, Math.floor(l.length * maxW / g.measureText(l).width) - 1)) + "…" : l));
  }
  // the same words, in lines of even length: no single word left alone on the last line
  function balanced(text, maxW, maxLines) {
    const lines = wrap(text, maxW, maxLines), whole = (t) => t.join(" ") === text;
    if (lines.length < 2 || !whole(lines)) return lines;
    let lo = maxW * 0.5, hi = maxW;
    while (hi - lo > 4) { const mid = (lo + hi) / 2, t = wrap(text, mid, maxLines); if (t.length === lines.length && whole(t)) hi = mid; else lo = mid; }
    return wrap(text, hi, maxLines);
  }
  const labelFont = () => `500 12.5px "Bodoni Moda", Georgia, serif`;
  const tagFont = () => `500 11px "IBM Plex Mono", ui-monospace, monospace`;
  const TAG_HEAD = 12;            // the name line at the top of a tag (11 px mono caps)
  const tagName = (n) => { const u = String(n || "").toUpperCase(); return u.length > 14 ? u.slice(0, 13) + "…" : u; };
  const spaced = (on) => { if ("letterSpacing" in g) g.letterSpacing = on ? "0.08em" : "0px"; };
  function labelText(bn) {
    // a long team name gets cut to fit its desk
    const room = (bn.x1 - bn.x0) / bn.s - 14;
    let t = bn.name;
    if (g.measureText(t).width <= room) return t;
    while (t.length > 2 && g.measureText(t + "…").width > room) t = t.slice(0, -1);
    return t.trimEnd() + "…";
  }
  function labelRect(bn) {
    const w = g.measureText(labelText(bn)).width * bn.s, cx = (bn.x0 + bn.x1) / 2 + (bn.labelDx || 0);
    return { x: cx - w / 2 - 3, y: bn.y - 31 * bn.s, w: w + 6, h: 15 * bn.s };
  }
  function benchLabels() {
    // team names sign-painted in gilt on the desk fronts, lit enough to read at any hour
    for (const bn of L.benches) {
      if (bn.lounge) continue;
      g.save(); g.translate((bn.x0 + bn.x1) / 2 + (bn.labelDx || 0), bn.y); g.scale(bn.s, bn.s);
      g.font = labelFont(); g.textAlign = "center"; g.textBaseline = "alphabetic";
      const t = labelText(bn);
      g.fillStyle = "rgba(20,10,4,0.55)"; g.fillText(t, 0.5, -19.4);
      g.fillStyle = "#EBC688"; g.fillText(t, 0, -20);
      g.restore();
    }
  }
  function headBox(b) {
    const { x, y, s } = b.screen;
    if (b.screen.kind === "hammock") return { id: b.id, x: x - 44 * s, y: y - 22 * s, w: 60 * s, h: 30 * s, cx: x - 14 * s, cy: y - 8 * s };
    const G = b.cast.G, hw = G.egg ? 36 : G.hw;
    const top = y + ((b.top || -70) - 2) * s, bottom = y + ((b.hc || -40) + (G.egg ? 17 : G.hh / 2) + 2) * s;
    return { id: b.id, x: x - (hw / 2 + 3) * s, y: top, w: (hw + 6) * s, h: bottom - top, cx: x, cy: y + (b.hc || -40) * s };
  }
  function makePlan() {
    planDirty = false; plan = [];
    g.textAlign = "left";
    const fs = L.wide ? 12.5 : 12, lh = Math.round(fs * 1.3), padX = L.wide ? 9 : 7, padY = L.wide ? 6 : 5, maxW = L.wide ? 180 : 140, extra = L.wide ? 3 : 2;
    const heads = new Set(divisions.map((d) => d.head));
    const pri = (b) => (b.id === selId ? -1 : (b.state === "working" || b.state === "meeting") && heads.has(b.id) ? 2 : b.state === "working" ? 3 : b.state === "meeting" ? 4 : b.state === "studying" ? 5 : 9);
    const seen = bots.filter((b) => b.screen && !b.path.length);
    const faces = seen.map(headBox);
    const inter = (r, o, m) => Math.max(0, Math.min(r.x + r.w, o.x + o.w) + m - Math.max(r.x, o.x)) * Math.max(0, Math.min(r.y + r.h, o.y + o.h) + m - Math.max(r.y, o.y));
    const alerts = seen.filter(flagged).sort((a, b) => a.screen.y - b.screen.y || a.screen.x - b.screen.x);
    // 1. a "?" or "!" over each one that needs you, kept clear of other bots' faces
    for (const b of bots) b.badge = null;
    const placed = [];
    for (const b of alerts) {
      const p0 = badgePos(b), r = p0.r;
      let pick = p0;
      for (const [dx, dy] of [[0, 7], [0, 4], [0, 0], [0, 10], [-r, 0], [r, 0], [-r, 7], [r, 7], [0, 15], [-r * 1.6, 4], [r * 1.6, 4]]) {
        const p = { x: p0.x + dx, y: p0.y + dy, r }, box = { x: p.x - r - 2, y: p.y - r - 2, w: r * 2 + 4, h: r * 2 + 4 };
        if (!faces.some((f) => f.id !== b.id && inter(box, f, 0) > 0) && !placed.some((o) => inter(box, o, 2) > 0)) { pick = p; break; }
      }
      b.badge = pick; placed.push({ x: pick.x - r - 2, y: pick.y - r - 2, w: r * 2 + 4, h: r * 2 + 4 });
    }
    // a team name slides along its desk if a marker from the row behind would cover it
    g.font = labelFont();
    const markers = alerts.map(badgeRect), desks = L.benches.filter((bn) => !bn.lounge);
    for (const bn of desks) {
      bn.labelDx = 0;
      const r0 = labelRect(bn), room = Math.max(0, (bn.x1 - bn.x0 - r0.w) / 2 - 3 * bn.s);
      let bestF = 0, bestA = Infinity;
      for (const f of [0, -0.35, 0.35, -0.7, 0.7, -1, 1]) { bn.labelDx = f * room; const a = markers.reduce((s, o) => s + inter(labelRect(bn), o, 0), 0); if (a < bestA) { bestA = a; bestF = f; } if (!a) break; }
      bn.labelDx = bestF * room;
    }
    const labels = desks.map(labelRect);           // measured now, in the label's own font
    const taken = [{ x: 0, y: 0, w: W, h: L.hudTop }, ...labels.map((r) => ({ ...r, label: true })), ...markers];
    if (L.side) taken.push({ x: 0, y: 0, w: L.rx0, h: H });
    const cover = (r, loose) => {
      if (r.x < 4 || r.x + r.w > W - 4 || r.y < L.hudTop + 2 || r.y + r.h > H - 2 || (L.side && r.x < L.rx0)) return Infinity;
      let a = 0;
      for (const o of taken) if (!(o.id && o.id === r.id && r.own) && !(loose && o.label)) a += inter(r, o, 3);
      for (const f of faces) if (f.id !== r.id) a += inter(r, f, 2);
      return a;
    };
    const measure = (lines) => Math.ceil(Math.max(0, ...lines.map((l) => g.measureText(l).width)));
    // 2. a name tag for each: who it is and what they need, on a leader line when it has to sit further off.
    //    Words first, clear of everything; then words over a team name; then just the name.
    const tfs = fs, tlh = Math.round(tfs * 1.28);
    const offs = [[0, 0], [0, -6], [0, 6], [0, -12], [0, 12], [0, -18], [0, 18], [0, -24], [0, 24], [6, -30], [6, 30], [12, -36], [12, 36], [28, -52], [28, 52], [44, -70], [44, 70], [8, -92], [8, 92], [60, -24], [60, 24]];
    for (const b of alerts) {
      const p = badgePos(b), stuck = b.state === "stuck", name = tagName(b.name), info = alertLine(b);
      g.font = tagFont(); spaced(true); const nw = Math.ceil(g.measureText(name).width); spaced(false);
      g.font = `500 ${tfs}px Archivo, system-ui, sans-serif`;
      const place = (lines, loose) => {
        const w = Math.max(nw, measure(lines)) + padX * 2, h = padY * 2 + TAG_HEAD + (lines.length ? 4 + lines.length * tlh : 0);
        const cands = [];
        for (const [dx, dy] of offs) for (const side of [1, -1]) cands.push({ x: side > 0 ? p.x + p.r + 8 + dx : p.x - p.r - 8 - dx - w, y: p.y - h / 2 + dy });
        cands.push({ x: clamp(p.x - w / 2, 6, W - 6 - w), y: p.y - p.r - 8 - h }, { x: clamp(p.x - w / 2, 6, W - 6 - w), y: p.y - p.r - 34 - h });
        // Strict: clear of everything. Loose: may overlap a team name, but only a little of one, and the
        // spot that covers the least wins; a tag that would hide a name falls back to a smaller one.
        let pick = null, least = Infinity;
        for (const c of cands) {
          const r = { id: b.id, own: true, x: c.x, y: c.y, w, h, lines, name };
          if (cover(r, loose) !== 0) continue;
          if (!loose) return r;
          const worst = Math.max(0, ...labels.map((q) => inter(r, q, 0) / Math.max(1, q.w * q.h)));
          if (worst < least) { least = worst; pick = r; if (!worst) break; }
        }
        return pick && least <= 0.2 ? pick : null;
      };
      // the whole question first, in whichever shape fits; a cut-short one only if none does
      const texts = [balanced(info, L.wide ? 210 : 160, 2), wrap(info, L.wide ? 300 : 230, 1), ...(L.wide ? [] : [balanced(info, 124, 3)])]
        .map((l, i) => [l, i + (l.join(" ") === info ? 0 : 10)]).sort((a, b) => a[1] - b[1]).map(([l]) => l);
      let best = null;
      for (const loose of [false, true]) { for (const lines of texts) if (!best) best = place(lines, loose); }
      if (!best) best = place([], false) || place([], true);
      if (!best) {         // the name always shows: right above the marker, even over something else
        const w = nw + padX * 2, h = padY * 2 + TAG_HEAD;
        best = { id: b.id, x: clamp(p.x - w / 2, 4, W - 4 - w), y: Math.max(L.hudTop + 2, p.y - p.r - 6 - h), w, h, lines: [], name };
      }
      taken.push(best);
      plan.push({ ...best, alert: true, kind: stuck ? "stuck" : "ask", fs: tfs, lh: tlh, padX, padY, bx: p.x, by: p.y, br: p.r });
    }
    // 3. a few of the others say what they're on, taking turns; the harbour view stays clear
    for (const w of L.windows) taken.push({ x: w.x - 6, y: w.y - 6, w: w.w + 12, h: w.h + 6 });
    g.font = `500 ${fs}px Archivo, system-ui, sans-serif`;
    let cands = seen.filter((b) => !flagged(b) && bubbleText(b) && pri(b) < 9).sort((a, b) => pri(a) - pri(b));
    const pinned = cands.filter((b) => b.id === selId), rest = cands.filter((b) => b.id !== selId);
    if (rest.length > extra) { const k = (turn * extra) % rest.length; cands = [...pinned, ...rest.slice(k), ...rest.slice(0, k)]; }
    const was = shownIds; shownIds = new Set(); planAt = frameNow;
    let n = 0;
    for (const b of cands) {
      if (n >= extra) break;
      const hb = headBox(b), ax = hb.cx, ay = hb.y - 1;
      let best = null;
      const variants = [[maxW, 2], [L.wide ? 290 : 220, 1], [maxW * 0.8, 2]].map(([mw, ml]) => balanced(bubbleText(b), mw, ml)).filter((l, i) => !(i === 1 && l[0].endsWith("…") && !bubbleText(b).endsWith("…")));
      for (const lines of variants) {       // above the head first, in any shape; then beside it
        if (best) break;
        const w = measure(lines) + padX * 2, h = lines.length * lh + padY * 2;
        for (const [ox, oy] of [[-w / 2, 0], [-w + 16, 0], [-16, 0], [-8, 0], [-w + 8, 0], [-w / 2, -10], [-w + 16, -10], [-16, -10], [-8, -10], [-w / 2, -20], [-16, -20], [-w + 16, -20]]) {
          const r = { id: b.id, x: clamp(ax + ox, 6, W - 6 - w), y: ay - 7 - h + oy, w, h, lines, ax, ay };
          if (cover(r) === 0) { best = r; break; }
        }
      }
      for (const lines of variants) {
        if (best) break;
        const w = measure(lines) + padX * 2, h = lines.length * lh + padY * 2;
        for (const dy of [0, -8, 8]) for (const side of [1, -1]) {
          const r = { id: b.id, side: true, x: side > 0 ? hb.x + hb.w + 7 : hb.x - 7 - w, y: hb.cy - h / 2 + dy, w, h, lines, ax: side > 0 ? hb.x + hb.w : hb.x, ay: hb.cy };
          if (!best && cover(r) === 0) best = r;
        }
      }
      if (!best) continue;
      taken.push(best); n++; shownIds.add(b.id);
      plan.push({ ...best, fs, lh, padX, padY, kind: b.state, fresh: !was.has(b.id) });
    }
  }
  function bubble(p) {
    const { x, w, h, ax, ay } = p;
    const k = p.fresh && !still() ? clamp((frameNow - planAt) / 450, 0, 1) : 1, e = 1 - Math.pow(1 - k, 3);
    if (k <= 0) return;
    const y = p.y + (1 - e) * 5;
    g.globalAlpha = e;
    g.fillStyle = "rgba(2,9,14,0.35)"; g.beginPath(); rr(g, x + 1, y + 2, w, h, 6); g.fill();
    g.fillStyle = "#F3EFE3"; g.beginPath(); rr(g, x, y, w, h, 6); g.fill();
    if (p.side) { const lx = ax < x ? x + 0.5 : x + w - 0.5; g.beginPath(); g.moveTo(lx, ay - 5); g.lineTo(ax + (ax < x ? 1 : -1), ay); g.lineTo(lx, ay + 5); g.closePath(); g.fill(); }
    else { const tx = clamp(ax, x + 9, x + w - 9); g.beginPath(); g.moveTo(tx - 5, y + h - 0.5); g.lineTo(tx + 5, y + h - 0.5); g.lineTo(clamp(ax, tx - 6, tx + 6), ay - 1); g.closePath(); g.fill(); }
    g.fillStyle = C.ink; g.font = `500 ${p.fs}px Archivo, system-ui, sans-serif`; g.textAlign = "left"; g.textBaseline = "alphabetic";
    p.lines.forEach((l, i) => g.fillText(l, x + p.padX, y + p.padY + p.fs * 0.95 + i * p.lh));
    g.globalAlpha = 1;
  }
  function marker(bx, by, r, stuck, t, ph) {
    // a quest marker: a steady disc with a slow ring, bobbing a little
    const live = !still(), col = stuck ? C.bad : C.amber, k = live ? (t / 1500 + ph) % 1 : 0.5;
    if (live) { g.strokeStyle = rgba(col, 0.75 * (1 - k)); g.lineWidth = 1.6; g.beginPath(); g.arc(bx, by, r + 1.5 + k * 8, 0, TAU); g.stroke(); }
    g.globalCompositeOperation = "lighter"; glow(g, bx, by, r * 3, col, 0.32); g.globalCompositeOperation = "source-over";
    g.fillStyle = col; g.beginPath(); g.arc(bx, by, r, 0, TAU); g.fill();
    g.strokeStyle = C.night; g.lineWidth = 2; g.stroke();
    g.fillStyle = C.night; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `500 ${Math.round(r * 1.5)}px Archivo, system-ui, sans-serif`;
    g.fillText(stuck ? "!" : "?", bx, by + r * 0.08);
    g.textBaseline = "alphabetic"; g.textAlign = "left";
  }
  function callout(p, t) {
    const b = byId.get(p.id), live = !still(), stuck = p.kind === "stuck", ph = b ? b.ph : 0;
    const bob = live ? Math.sin(t / 380 + ph) * 1.6 : 0, fill = stuck ? C.bad : C.amber, my = p.by + bob;
    // the leader line, from the marker to the nearest edge of its tag
    const cx = clamp(p.bx, p.x, p.x + p.w), cy = clamp(my, p.y, p.y + p.h);
    if (Math.hypot(cx - p.bx, cy - my) > p.br + 1) { g.strokeStyle = fill; g.lineWidth = 1.6; g.beginPath(); g.moveTo(p.bx, my); g.lineTo(cx, cy); g.stroke(); }
    g.fillStyle = "rgba(2,9,14,0.42)"; g.beginPath(); rr(g, p.x + 1, p.y + 2, p.w, p.h, 5); g.fill();
    g.fillStyle = fill; g.beginPath(); rr(g, p.x, p.y, p.w, p.h, 5); g.fill();
    g.fillStyle = C.night; g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.font = tagFont(); spaced(true); g.fillText(p.name, p.x + p.padX, p.y + p.padY + 10); spaced(false);
    if (p.lines.length) {
      g.fillStyle = "rgba(7,26,38,0.28)"; g.fillRect(p.x + p.padX, p.y + p.padY + TAG_HEAD + 2, p.w - p.padX * 2, 1);
      g.fillStyle = C.night; g.font = `500 ${p.fs}px Archivo, system-ui, sans-serif`;
      p.lines.forEach((l, i) => g.fillText(l, p.x + p.padX, p.y + p.padY + TAG_HEAD + 4 + p.fs * 0.95 + i * p.lh));
    }
    marker(p.bx, my, p.br, stuck, t, ph);
  }
  /* tap targets: a real button over each bot, at least 44px, following the bot every frame */
  let hitBtns = new Map();
  function buildHits(labels) {
    hitList.innerHTML = bots.map((b) => `<li><button type="button" data-bot="${esc(b.id)}" aria-label="${esc(labels.get(b.id) || b.name)}"></button></li>`).join("");
    hitBtns = new Map([...hitList.querySelectorAll("button")].map((el) => [el.dataset.bot, el]));
  }
  function placeHits() {
    for (const [id, btn] of hitBtns) {
      const b = byId.get(id);
      if (!b || !b.screen) { if (!btn.hidden) btn.hidden = true; continue; }
      const { x, y, s0: s } = b.screen;
      let bx, by, bw, bh;
      if (b.screen.kind === "hammock") { bx = x - 46 * s; by = y - 26 * s; bw = 66 * s; bh = 40 * s; }
      else {
        const bottom = y + (b.screen.kind === "desk" ? -6 : 8) * s;
        let top = y + (b.top || -70) * s;
        if (flagged(b) && !b.path.length) { const p = badgePos(b); top = Math.min(top, p.y - p.r); }
        bw = 40 * s; bh = bottom - top + 8; bx = x - bw / 2; by = top - 4;
      }
      const w = Math.max(44, bw), h = Math.max(48, bh), left = Math.round(bx + bw / 2 - w / 2), top = Math.round(by + bh / 2 - h / 2);
      btn._c = [bx + bw / 2, by + bh / 2];          // the bot itself, before the target grew to 44 px
      const key = `${left},${top},${Math.round(w)},${Math.round(h)}`;
      if (btn._k === key && !btn.hidden) continue;
      btn._k = key; btn.hidden = false;
      btn.style.width = Math.round(w) + "px"; btn.style.height = Math.round(h) + "px";
      btn.style.transform = `translate(${left}px, ${top}px)`;
    }
  }
  // Targets grow to 44 px, so neighbours overlap. A tap in an overlap goes to the nearest bot,
  // not to whichever button happens to be later in the page.
  hitList.addEventListener("click", (e) => {
    const t = e.target.closest && e.target.closest("button[data-bot]");
    if (!t || !e.isTrusted || e.detail === 0) return;          // keyboard: the focused bot is the one meant
    const hr = host.getBoundingClientRect(), px = e.clientX - hr.left, py = e.clientY - hr.top;
    let best = null, bd = Infinity;
    for (const [id, el] of hitBtns) {
      if (el.hidden || !el._c) continue;
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;
      const d = Math.hypot(el._c[0] - px, el._c[1] - py);
      if (d < bd) { bd = d; best = id; }
    }
    if (best && best !== t.dataset.bot) { e.stopPropagation(); e.preventDefault(); hitBtns.get(best).click(); }
  }, true);
  hitList.addEventListener("focusin", (e) => { const id = e.target.dataset && e.target.dataset.bot; if (id) { focusId = id; invalidate(); } });
  hitList.addEventListener("focusout", () => { focusId = null; invalidate(); });

  /* the loop: full speed while someone walks, a slow tick for small things, nothing when hidden */
  let onScreen = true;
  function schedule(fast) {
    if (raf || timer || document.hidden || !onScreen) return;
    if (card && card.open) return;       // a bot's card covers the studio: rest (closing it selects no one, which redraws)
    if (still() && !fast) return;
    if (fast) raf = requestAnimationFrame(frame);
    else timer = setTimeout(() => { timer = 0; raf = requestAnimationFrame(frame); }, 90);
  }
  function invalidate() { if (!raf) { clearTimeout(timer); timer = 0; raf = requestAnimationFrame(frame); } }
  function relayout() { if (!W) return; layout(); if (bots.length) assign(true); lookMin = -1; planDirty = true; invalidate(); }
  function resize() {
    const r = host.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height);
    if (!w || !h) return;
    DPR = Math.min(3, window.devicePixelRatio || 1); LDPR = Math.min(2, DPR);
    if (w === W && h === H && cv.width === Math.round(w * DPR)) return;
    W = w; H = h; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    relayout();
  }
  new ResizeObserver(resize).observe(host);
  // the headline changes size (new text, the web fonts arriving): give the room what it frees up
  const onHud = () => { if (!L || !W) return; if (!sameHud(hudBox(), L.hb)) relayout(); };
  for (const el of [$("#hud"), $("#side"), $("#topbar")]) if (el) new ResizeObserver(onHud).observe(el);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) invalidate(); });
  // scrolled down to the answers? the studio rests until you come back
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => { onScreen = es.some((e) => e.isIntersecting); if (onScreen) invalidate(); }).observe(host);
  REDUCED.addEventListener && REDUCED.addEventListener("change", () => { if (L) assign(true); planDirty = true; invalidate(); });
  setInterval(() => { if (still()) invalidate(); }, 60000);    // the sky follows the clock even when nothing moves
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { lookMin = -1; planDirty = true; onHud(); invalidate(); });

  function setData(list, divs, alerts, labels) {
    const first = !bots.length;
    const old = new Map(bots.map((b) => [b.id, b]));
    divisions = divs; alertMap = alerts || new Map();
    bots = list.map((d, i) => {
      const b = Object.assign(old.get(d.id) || { path: [] }, d);
      if (!old.has(d.id)) b.appearAt = (performance.now() - T0) + 120 + i * 45;
      return b;
    });
    byId = new Map(bots.map((b) => [b.id, b]));
    const key = bots.map((b) => b.id + ":" + b.division).join(",") + "|" + divs.map((d) => d.id + ":" + d.name).join(",");
    const hb = W ? hudBox() : null;
    if (key !== teamKey || !L || (hb && !sameHud(hb, L.hb))) { teamKey = key; if (W) { layout(); assign(true); lookMin = -1; } }
    else assign(first);
    buildHits(labels || new Map()); planDirty = true; invalidate();
  }
  function select(id) { selId = id; planDirty = true; invalidate(); }
  // "at the desk in Marketing", "in the library": where a bot is right now, in words
  function where(id) {
    const b = byId.get(id);
    if (!b || !L) return "";
    const seat = L.seats.get(b.at);
    if (!seat) return "";
    const place = seat.kind === "desk" ? `at the desk in ${seat.benchRef ? seat.benchRef.name : "the office"}`
      : { armchair: "in the library", shelf: "in the library", back: "at the round table", side: "at the round table", bar: "at the coffee bar", hammock: "in the hammock" }[seat.kind]
        || (seat.key.startsWith("lounge") ? "in the lounge" : "in the library");
    return b.path.length ? "on the way " + place.replace(/^(at|in) /, "to ") : place;
  }
  // the animation switch changed: everyone goes straight to their seat, and the loop slows or wakes
  function motion() { if (L) assign(true); planDirty = true; invalidate(); }
  return { setData, select, where, motion, resize };
})();

/* ---------- portraits: the same bots, drawn small for the lists and big for the card ---------- */
const _ava = new Map();
function avatarURL(b, px = 56) {
  const k = Math.min(3, Math.ceil(window.devicePixelRatio || 1)), key = b.id + "|" + (b.color || "") + "|" + (b.role || "") + "|" + px + "|" + k;
  if (_ava.has(key)) return _ava.get(key);
  const c = document.createElement("canvas"); c.width = c.height = px * k;
  const x = c.getContext("2d"); x.scale(k, k);
  x.fillStyle = "#0E2C3C"; x.fillRect(0, 0, px, px);
  const gr = x.createRadialGradient(px / 2, px * 1.05, 2, px / 2, px * 1.05, px * 0.85); gr.addColorStop(0, rgba(b.color, 0.55)); gr.addColorStop(1, rgba(b.color, 0));
  x.fillStyle = gr; x.fillRect(0, 0, px, px);
  const sc = px / 74; x.translate(px / 2, px + 6 * sc); x.scale(sc, sc);
  drawBot(x, b, 0, { pose: "stand", still: true });
  const url = c.toDataURL();
  if (_ava.size > 600) _ava.clear();
  _ava.set(key, url); return url;
}
function drawPortrait(canvas, b, badge = "") {
  // drawn at the screen's sharpness; the page sets its size on screen (132 x 150)
  const k = Math.min(3, Math.ceil(window.devicePixelRatio || 1));
  if (canvas.width !== 132 * k) { canvas.width = 132 * k; canvas.height = 150 * k; }
  const x = canvas.getContext("2d"), w = canvas.width, s = w / 132;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, canvas.height); x.scale(s, s);
  const W = 132, H = 150;
  let gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#0A2231"); gr.addColorStop(1, "#071A26");
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  gr = x.createRadialGradient(W / 2, H * 0.72, 4, W / 2, H * 0.72, W * 0.8); gr.addColorStop(0, rgba(b.color, 0.5)); gr.addColorStop(1, rgba(b.color, 0));
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  x.fillStyle = "rgba(255,255,255,0.03)"; for (let i = 8; i < W; i += 14) x.fillRect(i, 0, 1, H * 0.7);
  ell(x, W / 2, H - 16, 44, 6, "rgba(0,0,0,.4)");
  const poseMap = { working: "type", waiting: "wave", stuck: "stuck", studying: "read", meeting: "talk", lunch: "sip", off: "sleep" };
  const pose = poseMap[b.state] || "stand", atDesk = ["working", "waiting", "stuck"].includes(b.state), off = b.state === "off";
  x.save(); x.translate(W / 2, atDesk ? H - 36 : H - 30); x.scale(1.45, 1.45);
  drawBot(x, b, 0, { pose, still: true, dim: off ? 0.35 : 0, legs: atDesk || off ? null : "stand", lit: atDesk ? 0.6 : 0 });
  x.restore();
  if (atDesk) {         // a slice of desk in front
    x.fillStyle = "#C99A66"; x.fillRect(0, H - 34, W, 5); x.fillStyle = "#7C5433"; x.fillRect(0, H - 29, W, 4); x.fillStyle = "#05111A"; x.fillRect(0, H - 25, W, 25);
    x.save(); x.translate(W / 2 + 22, H - 34); x.scale(1.45, 1.45); x.fillStyle = "#8C99A1"; x.fillRect(-11, -1.5, 22, 2.2); x.fillStyle = "#2C4352"; x.beginPath(); rr(x, -10, -15.5, 20, 14.5, 1.8); x.fill(); mark(x, 0, -8.3, 8, b.state === "stuck" ? "#FF8FA6" : "#FFD08A"); x.restore();
    x.save(); x.translate(W / 2, H - 36); x.scale(1.45, 1.45); drawBot(x, b, 0, { pose, still: true, pass: "arms" }); x.restore();
  }
  if (off) {            // tucked into the hammock: the flag's blue, two yellow stripes
    x.fillStyle = "#2A64A0"; x.beginPath(); x.moveTo(0, H - 44); x.quadraticCurveTo(W / 2, H - 20, W, H - 44); x.lineTo(W, H); x.lineTo(0, H); x.closePath(); x.fill();
    x.strokeStyle = "#F2C94C"; x.lineWidth = 2; for (const d of [16, 24]) { x.beginPath(); x.moveTo(0, H - 44 + d); x.quadraticCurveTo(W / 2, H - 20 + d, W, H - 44 + d); x.stroke(); }
    x.fillStyle = "rgba(195,201,201,.85)"; x.font = "500 13px Archivo, sans-serif"; x.textAlign = "left"; x.fillText("z", 92, 40); x.font = "500 10px Archivo, sans-serif"; x.fillText("z", 102, 28);
  }
  if (badge) {        // the same marker as in the studio
    const col = badge === "!" ? C.bad : C.amber;
    disc(x, 106, 26, 12, col); x.strokeStyle = C.night; x.lineWidth = 2; x.beginPath(); x.arc(106, 26, 12, 0, TAU); x.stroke();
    x.fillStyle = C.night; x.font = "500 17px Archivo, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(badge, 106, 27); x.textAlign = "left"; x.textBaseline = "alphabetic";
  }
}
