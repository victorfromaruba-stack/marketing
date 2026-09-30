// The agency control center: reads the report hq writes (data/agency.json, or demo.json
// at ?demo), shows it in the studio (studio.js) and around it, and sends Victor's answers
// and tasks to Muddy through hq's task box (api/task). The website's copy
// (arubawebstudio.com/office) has no hq: it reads the bots' repo from GitHub itself
// (github.js) with Victor's key, and stays locked without it. No inline script: the page's
// Content-Security-Policy refuses any script the bots' text might try to smuggle in, and
// every string from the report is escaped (esc) or set as text before it reaches the page.
"use strict";

const DEMO = new URLSearchParams(location.search).has("demo");
const SITE = document.documentElement.dataset.source === "github" && typeof GH === "object";
const HOST = SITE ? "GitHub" : "the studio computer";
const OFFLINE_Q = SITE ? "Is this device online?" : "Is Tailscale on for this device?";
const MIN = 60e3, HOUR = 3600e3, DAY = 864e5;

/* ---------- time ---------- */
let NOW0 = Date.now();
function when(v) {        // ISO, or "-HH:MM"/"+HH:MM" in demo data
  if (typeof v !== "string" || !v) return null;
  const m = /^([+-])(\d+):(\d\d)$/.exec(v);
  if (m) return NOW0 + (m[1] === "-" ? -1 : 1) * (Number(m[2]) * HOUR + Number(m[3]) * MIN);
  const t = Date.parse(v);
  return isNaN(t) ? null : t;
}
function ago(t) {
  if (t == null) return "";
  const s = (Date.now() - t) / 1000;
  if (s < 0) return "in " + span(-s);
  if (s < 90) return "just now";
  return span(s) + " ago";
}
function span(s) {
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + " min";
  if (s < 86400 * 1.5) return Math.round(s / 3600) + " h";
  return Math.round(s / 86400) + " days";
}
const at = (t) => (t ? clockText(aruba(t)) : "");

/* ---------- data: bot-written, so untrusted ---------- */
// Keep known fields of the right type, cap every string, never trust a colour or an id.
function clean(raw) {
  const d = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const str = (v, n = 200) => (typeof v === "string" ? v : typeof v === "number" && isFinite(v) ? String(v) : "").slice(0, n);
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const rows = (v, n) => (Array.isArray(v) ? v : []).slice(0, n).filter((x) => x && typeof x === "object" && !Array.isArray(x));
  const opts = (v) => (Array.isArray(v) ? v : []).filter((o) => typeof o === "string" && o.trim()).slice(0, 4).map((o) => o.trim().slice(0, 60));
  const botId = (v, i) => str(v, 40).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+/, "") || "bot" + i;
  const demo = DEMO || d.demo === true, seen = new Set();
  const bots = [];
  rows(d.bots, 40).forEach((b, i) => {
    const id = botId(b.id, i);
    if (seen.has(id)) return;             // one file per bot: a second file with the same id is dropped
    seen.add(id);
    // when the bot last wrote; a time in the future (a wrong clock) counts as no time at all
    let t = when(b.updated) ?? when(b.since);
    if (t != null && t > Date.now() + 10 * MIN) t = null;
    let state = isState(b.state) ? b.state : "off", stale = "";
    if (!demo) {                                     // a bot that stopped reporting isn't "working"
      const h = t == null ? Infinity : (Date.now() - t) / HOUR;   // waiting and stuck stay until the bot says otherwise
      if (h > 2 && ["working", "studying", "meeting"].includes(state)) { state = "off"; stale = t == null ? "no report time" : "no report for " + span(h * 3600); }
      else if (h > 12 && t != null && state === "lunch") state = "off";
    }
    bots.push({ id, name: str(b.name, 40).trim() || id, division: str(b.division, 40), role: str(b.role, 80),
                color: typeof b.color === "string" && HEX.test(b.color) ? b.color : null, state, stale, task: str(b.task, 240),
                since: when(b.since), updated: when(b.updated), last_done: str(b.last_done, 200), last_done_at: when(b.last_done_at),
                note: str(b.note, 240), learned: str(b.learned, 240), learned_at: when(b.learned_at) });
  });
  const board = obj(d.board), src = obj(d.source), watch = obj(d.watchlist), inbox = obj(d.inbox);
  const wseen = new Set();
  const waiting = rows(board.waiting, 20).map((w) => ({ id: str(w.id, 20).trim(), question: str(w.question, 300), from: str(w.from, 40), asked_at: when(w.asked_at), options: opts(w.options) }))
    .filter((w) => { const k = w.from + "\n" + w.id + "\n" + w.question; if (!w.question || wseen.has(k)) return false; wseen.add(k); return true; });
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
  return {
    demo, generated: when(d.generated), commit_time: when(src.commit_time), bots,
    divisions: rows(d.divisions, 12).map((x) => ({ id: str(x.id, 40), name: str(x.name, 60), head: str(x.head, 40) }))
      .filter((x, i, a) => x.id && a.findIndex((y) => y.id === x.id) === i),
    board: {
      waiting,
      shipped: rows(board.shipped, 20).map((s) => ({ what: str(s.what), by: str(s.by, 40), at: when(s.at) })).filter((s) => s.what),
      in_progress: rows(board.in_progress, 20).map((s) => ({ what: str(s.what), owner: str(s.owner, 40), due: when(s.due) })).filter((s) => s.what),
      stuck: rows(board.stuck, 20).map((s) => ({ what: str(s.what), owner: str(s.owner, 40), why: str(s.why), needs: str(s.needs, 40), since: when(s.since) })).filter((s) => s.what),
    },
    projects: rows(d.projects, 20).map((p) => ({ id: str(p.id, 40), name: str(p.name, 80), status: str(p.status, 40), owner: str(p.owner, 40), next: str(p.next), due: when(p.due) })).filter((p) => p.name),
    ideas: rows(d.ideas, 20).map((i) => ({ title: str(i.title), by: str(i.by, 40), score: num(i.score), status: str(i.status, 20) || "new" })).filter((i) => i.title),
    study: rows(d.study, 40).map((s) => ({ bot: str(s.bot, 40), at: when(s.at), learned: str(s.learned, 240) })).filter((s) => s.learned),
    watchlist: { as_of: when(watch.as_of), note: str(watch.note), items: rows(watch.items, 20).map((i) => ({ symbol: str(i.symbol, 12), name: str(i.name, 60), note: str(i.note, 80) })).filter((i) => i.symbol) },
    inbox: { sent_today: Math.max(0, Math.floor(num(inbox.sent_today) || 0)), cap: Math.max(0, Math.floor(num(inbox.cap) || 0)) },
  };
}

/* ---------- state ---------- */
let DATA = null, VIEW = null, paused = false;
const NET = { kind: "loading", msg: "", lastOk: 0, offline: false, busy: false };
const NOTES = new Map();     // where an answer went: "ref:D-14" -> { msg, tone }
const SENT = new Map();      // "ref:D-14|question" -> the option Victor sent (buttons stay down until the item leaves)
const PENDING = new Set();   // note keys with a send on its way: their buttons stay down through any refresh
let REPLY = null;            // the question or stuck bot the task box is answering: { kind, ref, bot, who, text }
// A stuck bot's three ways out: what the button says, and the word Muddy's inbox skill expects.
const UNSTICK = [["Try another way", "Try another way"], ["Set it aside", "Skip it"], ["Drop the task", "Stop"]];
const unstickLabel = (o) => (UNSTICK.find(([, v]) => v === o) || [o])[0];
const framed = () => { try { return window.top !== window.self; } catch { return true; } };
let prevAlerts = null;       // keys of what was waiting at the last load, for the assertive announcement

const ICON = { needs: "i-q", stuck: "i-bang", working: "i-laptop", studying: "i-book", meeting: "i-talk", lunch: "i-cup", off: "i-zz" };
const ico = (id, cls = "ico") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
function setHTML(el, html) { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } }
function joinNames(list, more = 0) {
  const n = [...new Set(list)];
  const extra = more + Math.max(0, n.length - 3), shown = n.slice(0, 3);
  if (extra) return shown.join(", ") + " and " + extra + " more";
  return shown.length < 3 ? shown.join(" and ") : shown.slice(0, -1).join(", ") + " and " + shown[shown.length - 1];
}

/* ---------- what the report means ---------- */
function derive(d) {
  const bots = d.bots.map(dress), byId = new Map(bots.map((b) => [b.id, b]));
  const nm = (id) => (byId.get(id) || { name: String(id || "someone").slice(0, 40) }).name;
  const ghost = (id) => dress({ id: String(id || "unknown").slice(0, 40), name: String(id || "?"), role: "", color: "#8B9AA3", state: "off" });
  const botOf = (id) => byId.get(id) || ghost(id);
  const askers = new Map();                      // bot id -> its (first) question on the board
  for (const w of d.board.waiting) if (!askers.has(w.from)) askers.set(w.from, w);
  const stuckRow = (b) => d.board.stuck.find((s) => s.owner === b.id);
  // The one list that needs Victor: questions and stuck bots, whoever has waited longest first.
  const items = [
    ...d.board.waiting.map((w) => ({ kind: "ask", key: "q:" + (w.id || w.question), ref: w.id, from: w.from, text: w.question, at: w.asked_at, options: w.options })),
    // a bot that says it's waiting on Victor but whose question didn't make the board still shows, with no buttons
    ...bots.filter((b) => b.state === "waiting" && !askers.has(b.id)).map((b) => ({ kind: "ask", key: "w:" + b.id, ref: "", from: b.id, text: b.task || "Waiting on you", at: b.since, options: [] })),
    ...bots.filter((b) => b.state === "stuck").map((b) => {
      const row = stuckRow(b);
      return { kind: "stuck", key: "s:" + b.id, ref: ("S-" + b.id).slice(0, 20), from: b.id, bot: b.id, text: b.task || (row && row.what) || "Stuck on something",
               why: row && row.why && !(b.task || "").toLowerCase().includes(row.why.toLowerCase()) ? row.why : "", needs: row ? row.needs : "", at: b.since || (row && row.since),
               options: UNSTICK.map(([, v]) => v) };
    }),
  ].sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity));
  const bucket = (b) => (b.state === "stuck" ? "stuck" : b.state === "waiting" || askers.has(b.id) ? "needs" : b.state);
  const counts = { needs: 0, stuck: 0, working: 0, studying: 0, meeting: 0, lunch: 0, off: 0 };
  for (const b of bots) counts[bucket(b)]++;
  // what each flagged bot needs, for its tag in the studio
  const alerts = new Map();
  for (const b of bots) {
    if (b.state === "stuck") { const row = stuckRow(b); alerts.set(b.id, { kind: "stuck", text: b.task || (row && row.why) || "" }); }
    else if (askers.has(b.id)) alerts.set(b.id, { kind: "ask", text: askers.get(b.id).question });
    else if (b.state === "waiting") alerts.set(b.id, { kind: "ask", text: b.task });
  }
  const divisions = d.divisions.length ? d.divisions : [...new Set(bots.map((b) => b.division))].map((id) => ({ id, name: id, head: "" }));
  const divName = (id) => { const x = divisions.find((v) => v.id === id); return (x && x.name) || id || ""; };
  // Since yesterday: shipped, learned (each lesson once), and who's stuck now
  const since = Date.now() - DAY, seenL = new Set();
  const learned = [...d.study.map((s) => [s.learned, s.at]), ...bots.filter((b) => b.learned).map((b) => [b.learned, b.learned_at])]
    .filter(([l, t]) => { const k = l.toLowerCase().replace(/\W/g, ""); if (t == null || t < since || seenL.has(k)) return false; seenL.add(k); return true; }).length;
  const recap = { shipped: d.board.shipped.filter((s) => s.at != null && s.at >= since).length, learned, stuck: counts.stuck };
  return { d, bots, byId, nm, botOf, askers, items, counts, bucket, alerts, divisions, divName, recap };
}

/* ---------- render ---------- */
const ava = (b, px, cls = "ava") => `<img class="${cls}" src="${esc(avatarURL(b, px))}" alt="" width="${px}" height="${px}">`;
const stateWord = (b, v) => (v.bucket(b) === "needs" && b.state !== "waiting" ? STATES[b.state].word + ", has a question" : STATES[b.state].word);

function render() {
  const v = VIEW = derive(DATA), d = DATA, { bots, items, counts } = v;
  document.body.dataset.state = "ok";
  $("#demo-flag").hidden = !d.demo;
  const questions = items.filter((i) => i.kind === "ask"), stuckItems = items.filter((i) => i.kind === "stuck");
  document.title = (items.length ? `(${items.length}) ` : "") + (SITE ? "Office" : "Agency") + " · Aruba Web Studio";
  $("#unlock").hidden = true;

  // 1. The answer, over the sky
  const cta = $("#cta");
  if (questions.length) {
    $("#answer").textContent = `${items.length} waiting on you`;
    const who = questions.map((q) => v.nm(q.from)), st = stuckItems.map((s) => v.nm(s.from));
    setHTML($("#sub"), `<b>${esc(joinNames(who))}</b> ${new Set(who).size === 1 ? "needs" : "need"} an answer.${st.length ? ` <b>${esc(joinNames(st))}</b> ${st.length === 1 ? "is" : "are"} stuck.` : ""}`);
    setCta(cta, [...new Set(questions.map((q) => q.from))], "Answer", false);
  } else if (stuckItems.length) {
    $("#answer").textContent = `${stuckItems.length} stuck`;
    const first = stuckItems[0];
    setHTML($("#sub"), `<b>${esc(v.nm(first.from))}</b> needs a hand: ${esc(first.text)}${stuckItems.length > 1 ? ` (and ${stuckItems.length - 1} more)` : ""}`);
    setCta(cta, stuckItems.map((s) => s.from), "Help out", true);
  } else {
    $("#answer").textContent = bots.length ? "Nothing needs you" : "No bots yet";
    setHTML($("#sub"), bots.length ? `Right now · checked ${esc(ago(d.generated) || "just now")}.` : SITE ? "The bots' repo is there, but no bot has checked in yet." : "The studio computer has an update, but no bot has checked in yet.");
    cta.hidden = true;
  }

  // 2. The strip: everyone counted once, in words and shapes, and who's doing what now
  const WORDS = { needs: "need you", stuck: "stuck", working: "working", studying: "studying", meeting: "meeting", lunch: "on break", off: "off" };
  setHTML($("#counts"), Object.keys(WORDS).filter((k) => counts[k]).map((k) => `<li class="n-${k}">${ico(ICON[k])}<b>${counts[k]}</b> ${WORDS[k]}</li>`).join("")
    || `<li class="n-off">${ico("i-zz")}No bots have reported</li>`);
  showTicker();
  renderWarn();

  // 3. The studio
  const labels = new Map(bots.map((b) => {
    const a = v.alerts.get(b.id);
    return [b.id, `${b.name}${b.role ? ", " + b.role : ""}. ${stateWord(b, v)}${b.task ? ": " + b.task : ""}${a && a.kind === "ask" && a.text !== b.task ? ". Asks you: " + a.text : ""}${b.stale ? ". " + b.stale : ""}`];
  }));
  Scene.setData(bots, v.divisions, v.alerts, labels);

  renderLive();
  renderAsks();
  renderWeek();
  renderProjects();
  renderIdeas();
  renderTeams();
  renderWatch();
  renderEveryone();
  renderTask();
  // tell a screen reader: routine changes politely (not too often), new questions and new stuck bots at once
  announce(`${items.length ? `${items.length} waiting on you${stuckItems.length ? `, ${stuckItems.length} of them stuck` : ""}. ` : "Nothing needs you. "}${["working", "studying", "meeting", "lunch", "off"].filter((k) => counts[k]).map((k) => counts[k] + " " + (k === "meeting" ? "in a meeting" : WORDS[k])).join(", ")}.`);
  const keys = new Set(items.map((i) => i.key));
  if (prevAlerts) {
    const fresh = items.filter((i) => !prevAlerts.has(i.key));
    if (fresh.length) $("#sr-alert").textContent = fresh.map((i) => (i.kind === "stuck" ? `New: ${v.nm(i.from)} is stuck. ${i.text}` : `New question from ${v.nm(i.from)}: ${i.text}`)).join(" ");
  }
  prevAlerts = keys;
  if ($("#card").open && cardId) fillCard(cardId);
}
function setCta(el, ids, label, bad) {
  const faces = [...new Set(ids)].slice(0, 3).map((id) => ava(VIEW.botOf(id), 34, "")).join(""), more = new Set(ids).size - 3;
  el.hidden = false; el.classList.toggle("bad", bad); el.setAttribute("href", "#answers");
  setHTML(el, `<span class="faces" aria-hidden="true">${faces}${more > 0 ? `<i>+${more}</i>` : ""}</span><span class="lbl">${esc(label)}</span>${ico("i-down", "arr")}`);
}
function renderWarn() {
  const w = $("#warn"), f = freshness();
  const show = ["stale", "error", "offline", "missing", "baddata"].includes(f.kind) && DATA;
  w.hidden = !show;
  if (show) setHTML(w, `${ico(BAD.has(f.kind) ? "i-bad" : "i-warn")}<span>${esc(f.short)}</span>`);
  w.className = "warn " + f.kind;
}

/* the ticker: one bot at a time, what it's on right now */
let tickIdx = 0;
function showTicker() {
  const el = $("#now");
  if (!VIEW) { el.hidden = true; return; }
  const list = VIEW.bots.filter((b) => b.task && ["working", "studying", "meeting"].includes(b.state) && VIEW.bucket(b) === b.state);
  if (!list.length) { el.hidden = true; return; }
  const b = list[tickIdx % list.length];
  el.hidden = false; el.dataset.bot = b.id;
  el.setAttribute("aria-label", `Now: ${b.name}, ${STATES[b.state].word}: ${b.task}. Open ${b.name}'s card`);
  setHTML(el, `<span class="k">Now</span>${ava(b, 28, "")}<span class="t"><b>${esc(b.name)}</b> ${esc(b.task)}</span>`);
}
setInterval(() => { if (!still() && !document.hidden && VIEW) { tickIdx++; showTicker(); } }, 6000);

/* freshness: live, paused, stale, offline, error, missing, bad data, demo: each says so differently */
const BAD = new Set(["error", "missing", "baddata"]);
function freshness() {
  const d = DATA, gen = d && d.generated, from = gen ? `${at(gen)} (${ago(gen)})` : "earlier";
  if (!d) return { kind: NET.kind, short: "", long: "" };
  if (d.demo) return { kind: "demo", short: "Demo data", long: "Demo data. Nothing here is live, and nothing you tap is sent." };
  if (paused) return { kind: "paused", short: "Paused", long: `Live updates paused. Showing the update from ${from}.` };
  if (NET.kind === "error") return { kind: "error", short: `Couldn't get the latest update. Showing the one from ${at(gen) || "earlier"}.`, long: `Couldn't get the latest update (${NET.msg}). Showing the last one, from ${from}. Trying again every minute.` };
  if (NET.kind === "baddata") return { kind: "baddata", short: "The latest update couldn't be shown", long: `Something in the latest update couldn't be shown here, so this is the one from ${from}. Trying again every minute.` };
  if (NET.kind === "missing") return { kind: "missing", short: "The latest update is missing", long: `The latest update is missing on the studio computer. Showing the last one, from ${from}.` };
  if (NET.offline) return { kind: "offline", short: "Offline: your phone's last copy", long: `Offline. This is your phone's last copy, from ${from}.` };
  if (!gen) return { kind: "stale", short: "This update has no time on it", long: "This update has no time on it, so it may be out of date." };
  if (Date.now() - gen > 10 * MIN) { const n = span((Date.now() - gen) / 1000); return { kind: "stale", short: `No update for ${n}`, long: `No update for ${n}, so this may be out of date.` }; }
  return { kind: "live", short: "Live", long: `Live · checked ${ago(gen) || "just now"}${d.commit_time ? ` · last bot check-in ${ago(d.commit_time)}` : ""}` };
}
function renderLive() {
  const f = freshness(), r = VIEW ? VIEW : null;
  setHTML($("#fresh"), `${f.kind === "live" ? `<span class="dot" aria-hidden="true"></span>` : ico(BAD.has(f.kind) ? "i-bad" : f.kind === "paused" ? "i-pause" : "i-warn")}<span>${esc(f.long)}</span>`);
  $("#fresh").className = "fresh is-" + f.kind;
  if (r) setHTML($("#recap"), `Since yesterday: <b>${r.recap.shipped}</b> shipped · <b>${r.recap.learned}</b> learned · <b>${r.recap.stuck}</b> stuck`);
  renderControls();
}
function renderControls() {
  const p = $("#pause"), a = $("#anim");
  p.hidden = DEMO || !!(DATA && DATA.demo);          // nothing is live in demo mode, so nothing to pause
  p.setAttribute("aria-pressed", String(paused));
  setHTML(p, `${ico(paused ? "i-play" : "i-pause")}<span>${paused ? "Resume live updates" : "Pause live updates"}</span>`);
  a.setAttribute("aria-pressed", String(!still()));
  a.disabled = REDUCED.matches;
  setHTML(a, `${ico("i-spark")}<span>${REDUCED.matches ? "Animation off (your device's setting)" : ANIM_OFF ? "Animation: off" : "Animation: on"}</span>`);
  $("#lock").hidden = !(SITE && !DEMO && GH.has() && NET.kind !== "locked");
}

/* Waiting on you: one list, one colour, the question's own answers as buttons */
function renderAsks() {
  const v = VIEW, items = v.items, sec = $("#answers");
  sec.hidden = false;
  const q = items.filter((i) => i.kind === "ask").length, s = items.length - q;
  const oldest = items.reduce((m, i) => (i.at != null && i.at < m ? i.at : m), Infinity);
  $("#answers-k").textContent = items.length ? [q ? `${q} ${q === 1 ? "question" : "questions"}` : "", s ? `${s} stuck` : "", isFinite(oldest) ? `oldest ${ago(oldest)}` : ""].filter(Boolean).join(" · ") : "All clear";
  if (!items.length) {
    setHTML($("#asks"), `<li class="calm">${ico("i-ok")}<span>Nothing needs you right now · checked ${esc(ago(DATA.generated) || "just now")}.</span></li>`);
    return;
  }
  setHTML($("#asks"), items.map((i) => askHTML(i, "list")).join(""));
}
// "Needs the lead-form fields" + Forge -> "Needs the lead-form fields from Forge"; otherwise "why · needs Forge"
const whyNeeds = (why, needs) => (why && needs && /^needs\b/i.test(why) ? `${why} from ${needs}` : [why, needs && "needs " + needs].filter(Boolean).join(" · "));
function askHTML(i, where) {
  // keyed by reference AND question: a bot's next question reuses its Q-<bot> reference
  const v = VIEW, who = v.nm(i.from), stuck = i.kind === "stuck", noteKey = "ref:" + (i.ref || "-") + "|" + i.text, sent = SENT.get(noteKey);
  const note = NOTES.get(noteKey), off = sent || PENDING.has(noteKey) ? " disabled" : "";
  const btns = !i.ref ? "" : stuck
    ? i.options.map((o, k) => `<button class="btn ${k ? "alt" : "go"}${sent === o ? " chosen" : ""}" type="button" data-unstick="${esc(i.bot)}" data-option="${esc(o)}" data-note-key="${esc(noteKey)}"${off}>${sent === o ? ico("i-ok") : ""}${esc(unstickLabel(o))}</button>`).join("")
    : i.options.map((o, k) => `<button class="btn ${k ? "alt" : "go"}${sent === o ? " chosen" : ""}" type="button" data-ref="${esc(i.ref)}" data-answer="${esc(o)}" data-note-key="${esc(noteKey)}"${off}>${sent === o ? ico("i-ok") : ""}${esc(o)}</button>`).join("");
  const reply = i.ref ? `<button class="btn quiet" type="button" data-reply="${esc(i.key)}">${ico("i-reply")}Reply</button>` : "";
  const meta = stuck ? `<b>${esc(who)}</b> is stuck${i.at ? " · " + esc(span((Date.now() - i.at) / 1000)) : ""}` : `<b>${esc(who)}</b> asks${i.at ? " · " + esc(ago(i.at)) : ""}`;
  const needs = i.needs && !i.text.toLowerCase().includes(v.nm(i.needs).toLowerCase()) ? v.nm(i.needs) : "";
  const extra = stuck && (i.why || needs) ? `<span class="why">${esc(whyNeeds(i.why, needs))}</span>` : "";
  const body = `<p class="say">${esc(i.text)}${extra}</p>
      <div class="opts" data-group>${btns}${reply}</div>
      <p class="note${note ? " " + note.tone : ""}" data-note="${esc(noteKey)}" role="status">${esc(note ? note.msg : sent ? `Sent: ${sent}. It leaves this list once ${who} has it.` : !i.ref ? "No reference on this one: answer Muddy in the app." : "")}</p>`;
  if (where === "card") return `<div class="card-ask${stuck ? " stuck" : ""}"><div class="k">${ico(stuck ? "i-bang" : "i-q")}${stuck ? "Stuck. Your call:" : "Asks you"}</div>${body}</div>`;
  // the face opens the bot's card; a sender who isn't on the roster has no card, so it's just a picture
  const face = `${ava(v.botOf(i.from), 56)}<span class="qdot" aria-hidden="true">${stuck ? "!" : "?"}</span>`;
  return `<li class="ask${stuck ? " stuck" : ""}">
      ${v.byId.has(i.from) ? `<button class="asker" type="button" data-bot="${esc(i.from)}" aria-label="Open ${esc(who)}'s card">${face}</button>` : `<span class="asker" aria-hidden="true">${face}</span>`}
      <div class="from">${meta}</div>${body}</li>`;
}

/* This week: the studio's whiteboard */
function renderWeek() {
  const v = VIEW, b = DATA.board, sec = $("#week");
  sec.hidden = !(b.shipped.length || b.in_progress.length || b.stuck.length);
  const lane = (title, kind, list, fmt) => `<div class="lane ${kind}"><h3>${ico({ done: "i-ok", prog: "i-dot", stuck: "i-bang" }[kind])}${title}<span class="n">${list.length}</span></h3>${list.length ? list.slice(0, 12).map(fmt).join("") : `<div class="empty">Nothing here. Good.</div>`}</div>`;
  const item = (who, what, meta) => `<div class="item">${ava(v.botOf(who), 36)}<span class="w">${esc(what)}</span><span class="m">${meta}</span></div>`;
  setHTML($("#lanes"),
    lane("Shipped", "done", b.shipped, (s) => item(s.by, s.what, `${esc(v.nm(s.by))}${s.at ? " · " + esc(ago(s.at)) : ""}`)) +
    lane("In progress", "prog", b.in_progress, (s) => item(s.owner, s.what, `${esc(v.nm(s.owner))}${s.due ? " · due " + esc(ago(s.due)) : ""}`)) +
    lane("Stuck", "stuck", b.stuck, (s) => item(s.owner, s.what, `<span class="bad">${esc(whyNeeds(s.why, s.needs ? v.nm(s.needs) : ""))}</span>`)));
}
function renderProjects() {
  const v = VIEW, list = DATA.projects;
  $("#projects").hidden = !list.length;
  setHTML($("#proj-list"), list.map((p) => {
    const warn = /waiting|stuck|late|victor/i.test(p.status);
    return `<div class="proj"><span class="nm">${esc(p.name)}</span><span class="st${warn ? " warn" : ""}">${ico(warn ? "i-q" : "i-ok")}${esc(p.status || "open")}</span>
      <div class="nx">${p.owner ? ava(v.botOf(p.owner), 28) : ""}<span>${p.next ? "Next: " + esc(p.next) : "No next step written"}${p.due ? ` · due ${esc(ago(p.due))}` : ""}</span></div></div>`;
  }).join(""));
}
function renderIdeas() {
  const v = VIEW, list = [...DATA.ideas].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  $("#ideas").hidden = !list.length;
  const open = (i) => ["new", "shortlisted"].includes(i.status);
  setHTML($("#idea-list"), list.map((i) => {
    const sc = i.score == null ? null : clamp(i.score, 0, 10), key = "idea:" + i.title, note = NOTES.get(key), off = PENDING.has(key) ? " disabled" : "";
    const bar = `<span class="bar" role="img" aria-label="${sc == null ? "No score" : `Score ${esc(sc.toFixed(1))} of 10`}">${Array.from({ length: 10 }, (_, k) => `<i class="${sc != null && k < Math.round(sc) ? "on" : ""}"></i>`).join("")}</span>`;
    return `<div class="idea"><div class="sc">${sc == null ? "?" : esc(sc.toFixed(1))}<small>of 10</small></div>
      <div class="body"><div class="t">${esc(i.title)}</div>${bar}<div class="m">${ava(v.botOf(i.by), 24)}${esc(v.nm(i.by))} · ${esc(i.status)}</div>
      ${open(i) ? `<div class="opts" data-group>${["Test it", "Park"].map((o, k) => `<button class="btn small ${k ? "alt" : "go"}" type="button" data-idea="${esc(i.title)}" data-pick="${o}" data-note-key="${esc(key)}"${off}>${o}</button>`).join("")}</div>
      <p class="note${note ? " " + note.tone : ""}" data-note="${esc(key)}" role="status">${esc(note ? note.msg : "")}</p>` : ""}</div></div>`;
  }).join(""));
}
function renderTeams() {
  const v = VIEW, bots = v.bots, study = DATA.study;
  $("#teams").hidden = !bots.length;
  const divs = [...v.divisions];
  for (const b of bots) if (!divs.some((x) => x.id === b.division)) divs.push({ id: b.division, name: b.division || "Everyone else" });
  setHTML($("#team-list"), divs.map((x) => {
    const members = bots.filter((b) => b.division === x.id);
    if (!members.length) return "";
    const seen = new Set(), learned = [...study.filter((s) => members.some((m) => m.id === s.bot)).map((s) => [s.bot, s.learned]), ...members.filter((m) => m.learned).map((m) => [m.id, m.learned])]
      .filter(([, l]) => { const k = l.toLowerCase().replace(/\W/g, ""); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 2);
    const inNow = members.filter((m) => m.state !== "off").length;
    return `<div class="team"><div class="plate"><h3>${esc(x.name || x.id || "Everyone else")}</h3><span>${inNow} of ${members.length} at work</span></div>
      <ul class="crew">${members.map((m) => `<li class="${m.state === "off" ? "off" : ""}"><button type="button" data-bot="${esc(m.id)}">${ava(m, 48)}<span class="nm">${esc(m.name)}</span><span class="st-${v.bucket(m)}">${esc(v.bucket(m) === "needs" ? "needs you" : m.state === "meeting" ? "meeting" : m.state === "lunch" ? "on break" : STATES[m.state].word)}</span></button></li>`).join("")}</ul>
      ${learned.map(([id, l]) => `<p class="learned"><b>${esc(v.nm(id))} learned</b>${esc(l)}</p>`).join("")}</div>`;
  }).join(""));
}
function renderWatch() {
  const w = DATA.watchlist;
  $("#watch").hidden = !w.items.length;
  setHTML($("#tape"), w.items.map((i) => `<div><div class="sy">${esc(i.symbol)}</div><div class="nm">${esc(i.name)}</div><div class="nt">${esc(i.note)}</div></div>`).join(""));
  $("#watch-note").textContent = `${w.note || "Research only. Nothing is bought or sold."}${w.as_of ? " Checked " + ago(w.as_of) + "." : ""}`;
}
function renderEveryone() {
  const v = VIEW;
  $("#everyone-s").textContent = `Everyone, as a list (${v.bots.length})`;
  setHTML($("#roll"), v.bots.map((b) => `<li><button type="button" data-bot="${esc(b.id)}">${ava(b, 40)}
      <span class="who"><span class="n">${esc(b.name)}</span> <span class="r">${esc(b.role)}</span></span>
      <span class="s s-${v.bucket(b)}">${ico(ICON[v.bucket(b)])}${esc(stateWord(b, v))}</span>
      ${b.task || b.stale ? `<span class="t">${esc(b.task)}${b.stale ? (b.task ? " · " : "") + esc(b.stale) : ""}</span>` : ""}</button></li>`).join(""));
}
function renderTask() {
  const demo = DATA && DATA.demo, inbox = DATA ? DATA.inbox : {}, muddy = VIEW && (VIEW.byId.get("muddy") || VIEW.bots.find((b) => b.division === "chief") || VIEW.bots[0]);
  if (muddy) $("#muddy-ava").src = avatarURL(muddy, 56);
  $("#task-send").disabled = !!demo || SITE || PENDING.has("task");
  if (!NOTES.has("task")) $("#task-state").textContent = demo ? "Demo: sending is off." : SITE ? SITE_SEND : inbox.cap ? `${inbox.sent_today} of ${inbox.cap} sent today` : "";
}

/* the website's office, locked: no key on this device, or GitHub turned it down */
const SITE_SEND = "Sending from the website isn't on yet: it starts once Muddy's back after Friday. Until then, message Muddy in the Grok Bot app.";
const LOCK_MSG = {
  shape: "That isn't a GitHub key. It starts with github_pat_.",
  refused: "GitHub didn't take this key: it may have expired. Make a new one (below) and paste it here.",
  norepo: "This key can't see the bots' repo. Make it for ai-hq-agency, with Contents: Read-only (below).",
};
function renderLock(why) {
  DATA = null; VIEW = null;                 // nothing of the agency stays on a locked page
  NET.kind = "locked"; NET.msg = why;
  document.body.dataset.state = "locked";
  document.title = "Office · Aruba Web Studio";
  $("#demo-flag").hidden = true;
  $("#answer").textContent = "The office is locked";
  setHTML($("#sub"), "Only your own devices open it. Paste your office key once on each one, and it stays there.");
  $("#cta").hidden = true;
  $("#unlock").hidden = false;
  if (why !== "none") { $("#unlock-state").textContent = LOCK_MSG[why] || LOCK_MSG.refused; $("#unlock-state").className = "unlock-state bad"; }
  for (const id of ["counts", "recap", "fresh", "asks", "lanes", "proj-list", "idea-list", "team-list", "tape", "watch-note", "roll", "now", "warn"]) setHTML($("#" + id), "");
  for (const id of ["now", "warn", "answers", "week", "projects", "ideas", "teams", "watch"]) $("#" + id).hidden = true;
  if ($("#card").open) $("#card").close();
  NOTES.clear(); SENT.clear(); setReply(null); $("#task-text").value = "";
  renderControls();
  Scene.setData([], [], new Map(), new Map());
}
$("#unlock").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!SITE) return;
  const inp = $("#key"), st = $("#unlock-state"), go = $("#unlock-go");
  go.disabled = true; st.className = "unlock-state"; st.textContent = "Checking with GitHub…";
  try {
    const kept = await GH.unlock(inp.value);
    inp.value = "";
    st.textContent = "";
    NET.kind = "loading"; renderEmpty();
    if (!kept) announce("Opened for this visit only: this browser won't keep the key.");
    await load();
  } catch (err) {
    st.className = "unlock-state bad";
    st.textContent = err instanceof GH.Locked ? LOCK_MSG[err.why] || LOCK_MSG.refused
      : err instanceof TypeError ? "Couldn't reach GitHub. Is this device online?" : "Couldn't check the key: " + String(err.message || err).slice(0, 80);
  } finally { go.disabled = false; }
});
$("#lock").addEventListener("click", () => { GH.forget(); renderLock("none"); $("#key").focus(); });

/* no report to show: nobody's in yet, or hq can't be reached */
function renderEmpty() {
  const missing = NET.kind === "missing";
  document.body.dataset.state = NET.kind;
  const bad = NET.kind === "baddata", offline = NET.msg === "no connection";
  $("#answer").textContent = missing ? "No update yet" : NET.kind === "loading" ? "Opening the studio" : bad ? "Can't show the studio" : offline ? `Can't reach ${HOST}` : "Couldn't get the update";
  setHTML($("#sub"), missing ? "The bots haven't checked in yet, so the studio's empty."
    : NET.kind === "loading" ? "Loading the latest update…"
    : bad ? "Something in the latest update couldn't be shown here. Trying again every minute."
    : `${offline ? OFFLINE_Q : SITE ? `GitHub said: ${esc(NET.msg)}.` : `The studio computer answered with ${esc(NET.msg)}.`} Trying again every minute.`);
  const cta = $("#cta");
  if (NET.kind === "loading") cta.hidden = true;
  else { cta.hidden = false; cta.classList.remove("bad"); setHTML(cta, missing && !DEMO ? `<span class="lbl">See it with demo data</span>${ico("i-down", "arr")}` : `<span class="lbl">Try again</span>`); }
  cta.setAttribute("href", missing && !DEMO ? "?demo" : "#");
  setHTML($("#counts"), "");
  $("#now").hidden = true; $("#warn").hidden = true;
  $("#answers").hidden = true;
  setHTML($("#fresh"), `${ico(missing ? "i-warn" : "i-bad")}<span>${missing ? "No update from the studio computer yet. The bots check in every couple of minutes." : NET.kind === "loading" ? "Loading…" : "Nothing to show yet."}</span>`);
  $("#fresh").className = "fresh is-" + NET.kind;
  setHTML($("#recap"), "");
  $("#unlock").hidden = true;
  renderControls();
  renderTask();
  Scene.setData([], [], new Map(), new Map());
}

/* ---------- the character card ---------- */
let cardId = null;
function fillCard(id) {
  const v = VIEW, b = v && v.byId.get(id);
  if (!b) return false;
  cardId = id;
  const item = v.items.find((i) => i.from === id && (i.kind === "stuck" || i.kind === "ask"));
  drawPortrait($("#card-art"), b, b.state === "stuck" ? "!" : item || b.state === "waiting" ? "?" : "");
  $("#card-team").textContent = v.divName(b.division);
  $("#card-name").textContent = b.name;
  $("#card-role").textContent = b.role;
  const place = Scene.where(id);
  $("#card-where").textContent = place ? `Right now · ${place}` : "";
  const st = $("#card-state"), mine = v.items.filter((i) => i.from === id);
  st.className = "state s-" + v.bucket(b);
  // A waiting bot's question IS its status: say it once, in the answer box below.
  const asksOnly = b.state === "waiting" && mine.some((i) => i.kind === "ask");
  const doing = b.task || { lunch: "On a break.", off: "Off for now. Back when there's work.", studying: "Reading up.", meeting: "In a meeting.", waiting: "Waiting on you." }[b.state] || "Nothing on right now.";
  st.hidden = asksOnly;
  setHTML(st, `${ico(ICON[b.state === "waiting" ? "needs" : b.state])}<span class="w">${esc(STATES[b.state].word)}</span><span class="d">${esc(b.state === "stuck" ? "" : doing)}</span>`);
  if (b.state === "stuck") st.hidden = true;             // the stuck box below says what, with the buttons
  setHTML($("#card-ask"), mine.map((i) => askHTML(i, "card")).join(""));
  const studied = DATA.study.filter((s) => s.bot === id).sort((x, y) => (y.at || 0) - (x.at || 0))[0];
  const learned = b.learned ? `${b.learned}${b.learned_at ? " (" + ago(b.learned_at) + ")" : ""}` : studied ? `${studied.learned}${studied.at ? " (" + ago(studied.at) + ")" : ""}` : "";
  const facts = [["Since", b.since ? ago(b.since) : ""], ["Last finished", b.last_done ? `${b.last_done}${b.last_done_at ? " (" + ago(b.last_done_at) + ")" : ""}` : ""],
    ["Learned", learned], ["Note to self", b.note], ["Report", b.stale]].filter(([, x]) => x);
  setHTML($("#card-facts"), facts.map(([k, x]) => `<dt>${esc(k)}</dt><dd class="${k === "Learned" || k === "Note to self" ? "q" : ""}">${esc(x)}</dd>`).join(""));
  return true;
}
function openCard(id) {
  if (!fillCard(id)) return;
  Scene.select(id);
  const d = $("#card");
  if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute("open", ""); }
  try { localStorage.setItem("aws-agency-tapped", "1"); } catch { /* fine */ }
  for (const h of document.querySelectorAll(".hint")) h.hidden = true;
}
$("#card").addEventListener("close", () => { cardId = null; Scene.select(null); });
$("#card-x").addEventListener("click", () => $("#card").close());
$("#card").addEventListener("click", (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  if (e.target === e.currentTarget && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) e.currentTarget.close();
  if (e.target.closest("[data-close]")) $("#card").close();
});

/* ---------- actions ---------- */
function note(key, msg, tone = "") {
  if (msg) NOTES.set(key, { msg, tone }); else NOTES.delete(key);
  for (const el of document.querySelectorAll("[data-note]")) if (el.dataset.note === key) { el.textContent = msg; el.className = "note" + (tone ? " " + tone : ""); }
  if (key === "task") { if (msg) $("#task-state").textContent = msg; else renderTask(); }
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("button, a");
  if (!t) return;
  if (t.id === "cta" && t.getAttribute("href") === "#") { e.preventDefault(); load(); return; }
  if (t.dataset.bot) { openCard(t.dataset.bot); return; }
  if (t.dataset.answer != null && t.dataset.ref) { send(`Answer to ${t.dataset.ref}: ${t.dataset.answer}`, t.dataset.ref, t, t.dataset.noteKey, t.dataset.answer); return; }
  if (t.dataset.unstick) { const id = t.dataset.unstick, ref = ("S-" + id).slice(0, 20); send(`Unstick ${id}: ${t.dataset.option}`, ref, t, t.dataset.noteKey, t.dataset.option); return; }
  if (t.dataset.idea != null) { send(`Idea "${t.dataset.idea}": ${t.dataset.pick}`, "idea", t, t.dataset.noteKey); return; }
  if (t.dataset.reply) { reply(t.dataset.reply); return; }
  if (t.id === "reply-x") { setReply(null); note("task", ""); $("#task-text").focus(); return; }
});
/* Reply: the task box answers one question (or one stuck bot). The question shows above the box,
   Victor writes only his answer, and it goes out with that question's reference. */
const TASK_HINT = "What should the agency do next? Muddy picks the right team.";
const replyPrefix = (r) => (r.kind === "stuck" ? `Unstick ${r.bot}: ` : `Answer to ${r.ref}: `);
function setReply(r) {
  REPLY = r;
  const el = $("#replying"), ta = $("#task-text");
  el.hidden = !r;
  setHTML($("#replying-t"), r ? `Replying to <b>${esc(r.who)}</b>${r.kind === "stuck" ? ", who's stuck" : ""}: ${esc(r.text)}` : "");
  ta.placeholder = !r ? TASK_HINT : r.kind === "stuck" ? `What should ${r.who} do?` : `Your answer for ${r.who}`;
  $("#task-label").textContent = !r ? "Task for Muddy" : `Your answer for ${r.who}`;
  ta.maxLength = 2000 - (r ? replyPrefix(r).length : 0);
}
function reply(key) {
  const i = VIEW && VIEW.items.find((x) => x.key === key);
  if (!i || !i.ref) return;
  const d = $("#card"); if (d.open) d.close();
  const ta = $("#task-text");
  setReply({ kind: i.kind, ref: i.ref, bot: i.bot || "", who: VIEW.nm(i.from), text: i.text });
  ta.value = "";
  $("#task-sec").scrollIntoView({ behavior: still() ? "auto" : "smooth", block: "center" });
  ta.focus({ preventScroll: true });
  note("task", DATA && DATA.demo ? "Demo: sending is off." : "");
}
$("#task").addEventListener("submit", (e) => {
  e.preventDefault();
  const ta = $("#task-text"), typed = ta.value.trim();
  if (!typed) { note("task", REPLY ? "Write your answer first." : "Write a task first."); ta.focus(); return; }
  let text = typed, ref = "";
  if (REPLY) { text = replyPrefix(REPLY) + typed; ref = REPLY.ref; }
  else {
    // "Answer to D-14: …" typed by hand keeps its reference, but only for a question this page shows
    const a = /^Answer to ([^:]{1,20}):\s*\S/.exec(typed), u = /^Unstick ([a-z0-9][a-z0-9-]{0,39}):\s*\S/.exec(typed);
    const hit = VIEW && (a ? VIEW.items.find((i) => i.kind === "ask" && i.ref && i.ref === a[1]) : u ? VIEW.items.find((i) => i.kind === "stuck" && i.bot === u[1]) : null);
    if (hit) ref = hit.ref;
  }
  send(text, ref, $("#task-send"), "task");
});
// the live buttons for a note key: re-rendering replaces the nodes, so never hold on to old ones
function buttonsFor(key) {
  if (key === "task") return [$("#task-send")];
  return [...document.querySelectorAll("button[data-note-key]")].filter((x) => x.dataset.noteKey === key);
}
async function send(text, ref, button, key, option) {
  key = key || "task";
  // Framed by another page (clickjacking): refuse, whatever the click was.
  if (framed()) { note(key, "Open the control center in its own tab to send.", "bad"); return; }
  if (DATA && DATA.demo) { note(key, "Demo: nothing was sent.", "quiet"); return; }
  if (SITE) { note(key, SITE_SEND, "bad"); return; }
  if (PENDING.has(key)) return;              // already on its way: one send per question
  PENDING.add(key);
  buttonsFor(key).forEach((x) => { x.disabled = true; });
  note(key, "Sending…");
  let ok = false;
  try {
    const r = await fetch("api/task", { method: "POST", headers: { "Content-Type": "application/json", "X-AIHQ": "1" }, body: JSON.stringify({ text, ref }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j || j.ok === false) throw new Error(j && typeof j.error === "string" && j.error ? j.error.slice(0, 200) : `the studio computer answered with error ${r.status}`);
    ok = true;
    if (key === "task") {
      $("#task-text").value = "";
      note(key, REPLY ? `Sent to Muddy: ${text.slice(replyPrefix(REPLY).length)}` : ref ? `Sent to Muddy: ${text}` : "Sent to Muddy. The answer comes in the Grok Bot app.", "ok");
      setReply(null);
    }
    else note(key, ref === "idea" ? `Sent to Muddy: ${button.dataset.pick}. Atlas takes it from here.` : `Sent to Muddy: ${unstickLabel(option)}. It leaves this list once the bot has it.`, "ok");
    if (option && ref && ref !== "idea") SENT.set(key, option);
    if (typeof j.sent_today === "number" && DATA) { DATA.inbox.sent_today = j.sent_today; if (typeof j.cap === "number") DATA.inbox.cap = j.cap; }
  } catch (err) {
    note(key, "Not sent: " + (err instanceof TypeError ? `couldn't reach ${HOST}. ${OFFLINE_Q}` : err.message), "bad");
  } finally {
    PENDING.delete(key);
    // answered: that question's buttons stay down (and show the pick); anything else can be tried again
    for (const x of buttonsFor(key)) {
      x.disabled = (ok && !!option && ref !== "idea") || (key === "task" && !!(DATA && DATA.demo));
      if (ok && option && (x.dataset.answer === option || x.dataset.option === option)) x.classList.add("chosen");
    }
  }
}

/* live updates and animation switches */
$("#pause").addEventListener("click", () => { paused = !paused; if (!paused) load(); if (DATA) { renderLive(); renderWarn(); } else renderControls(); });
$("#anim").addEventListener("click", () => {
  if (REDUCED.matches) return;
  ANIM_OFF = !ANIM_OFF;
  try { localStorage.setItem("aws-agency-anim", ANIM_OFF ? "off" : "on"); } catch { /* remembered for this visit only */ }
  applyMotion();
});
function applyMotion() { document.documentElement.dataset.motion = still() ? "off" : "on"; Scene.motion(); renderControls(); }
REDUCED.addEventListener && REDUCED.addEventListener("change", applyMotion);

/* screen readers: a polite summary, at most every 30 s */
let srLast = "", srAt = 0, srTimer = 0;
function announce(text) {
  if (text === srLast) return;
  clearTimeout(srTimer);
  srTimer = setTimeout(() => { srLast = text; srAt = Date.now(); $("#sr-status").textContent = text; }, srAt ? Math.max(0, 30000 - (Date.now() - srAt)) : 2000);
}

/* ---------- loading ---------- */
function tickClock() { setHTML($("#clock"), `${esc(clockText(aruba()))}<small>Oranjestad</small>`); }
function showTrouble() { if (!DATA) renderEmpty(); else { renderLive(); renderWarn(); } }
async function load() {
  if (NET.busy) return;
  NET.busy = true;
  try {
    // 1. fetch and parse: a failure here is the connection (or a damaged file), and says so
    let raw, offline;
    try {
      if (SITE && !DEMO) {
        try { raw = await GH.report(); }
        catch (err) {
          if (!(err instanceof GH.Locked)) throw err;
          if (err.why === "refused") GH.forget();          // expired or deleted: ask for a new one
          renderLock(err.why);
          return;
        }
      } else {
        const r = await fetch((DEMO ? "demo.json" : "data/agency.json") + "?t=" + Date.now(), { cache: "no-store" });
        if (r.status === 404) { NET.kind = "missing"; NET.msg = ""; showTrouble(); return; }
        if (!r.ok) throw new Error(`error ${r.status}`);
        offline = r.headers.get("X-Hub-Offline") === "1";
        raw = await r.json();
      }
    } catch (err) {
      const damaged = err instanceof SyntaxError;
      NET.kind = damaged ? "baddata" : "error";
      NET.msg = damaged ? "" : err instanceof TypeError ? "no connection" : String(err.message || err).slice(0, 80);
      showTrouble();
      return;
    }
    // 2. show it: a failure here is a bug or a bot's odd text, never "no connection"; the last good report stays up
    const prev = DATA;
    try {
      NET.offline = offline;
      NOW0 = Date.now();
      if (DEMO && raw && typeof raw === "object") { raw.generated = new Date().toISOString(); raw.source = { ...(raw.source && typeof raw.source === "object" ? raw.source : {}), commit_time: new Date().toISOString() }; }
      DATA = clean(raw); NET.kind = "ok"; NET.msg = ""; NET.lastOk = Date.now();
      render();
    } catch (err) {
      console.error("agency: couldn't show this report", err);
      NET.kind = "baddata"; NET.msg = "";
      DATA = prev;
      if (DATA) { try { render(); } catch { /* the page keeps what it last drew */ } renderLive(); renderWarn(); }
      else { VIEW = null; renderEmpty(); }
    }
  } finally { NET.busy = false; }
}
try { if (localStorage.getItem("aws-agency-tapped")) for (const h of document.querySelectorAll(".hint")) h.hidden = true; } catch { /* show the hint */ }
applyMotion();
tickClock();
if (SITE && !DEMO && !GH.has()) renderLock("none"); else renderEmpty();
load();
setInterval(() => { if (!paused) load(); }, 60000);
setInterval(() => { tickClock(); if (DATA) { renderLive(); renderWarn(); } }, 20000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && !paused && Date.now() - NET.lastOk > 60000) load(); });
