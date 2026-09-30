// The website's copy of the office (arubawebstudio.com/office) has no server behind it.
// It reads the bots' private repo straight from GitHub with Victor's own key: a
// read-only GitHub token for that one repo, kept on his device only, never in any repo.
// It builds the same report hq's agency_sync.py writes (data/agency.json), with the same
// limits: only status/*.json, plain files, 64 KB each, 1 MB in all, known fields only.
// agency.js then cleans it again, as it does hq's.
"use strict";

const GH = (() => {
  const REPO = document.documentElement.dataset.repo || "";
  const API = "https://api.github.com/repos/" + REPO;
  const STORE = "aws-office-key";
  const MAX_FILE = 64 * 1024, MAX_TOTAL = 1024 * 1024, MAX_BOTS = 40;
  const STATES = new Set(["working", "waiting", "stuck", "studying", "meeting", "lunch", "off"]);
  const ID = /^[a-z0-9][a-z0-9-]{0,39}$/, HEX = /^#[0-9a-fA-F]{6}$/;
  const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:?\d\d)?$/;

  let memKey = "";                 // when this browser won't store it: this visit only
  const blobs = new Map();         // sha -> parsed file (null if not JSON); a sha never changes
  let last = null;                 // { sha, report } of the last commit read

  /* ---------- the key ---------- */
  // "none": no key on this device. "refused": GitHub turned it down (expired, deleted).
  // "norepo": it works, but can't see the bots' repo.
  class Locked extends Error { constructor(why) { super(why); this.why = why; } }
  const looksRight = (k) => /^(github_pat_[A-Za-z0-9_]{30,255}|gh[pousr]_[A-Za-z0-9]{30,255})$/.test(k);
  function key() {
    try { return localStorage.getItem(STORE) || memKey; } catch { return memKey; }
  }
  function forget() {
    memKey = ""; blobs.clear(); last = null;
    try { localStorage.removeItem(STORE); } catch { /* nothing stored */ }
  }
  // Checks a new key with GitHub before keeping it. Returns true if this browser keeps it,
  // false if only for this visit.
  async function unlock(k) {
    k = String(k || "").trim();
    if (!looksRight(k)) throw new Locked("shape");
    await get("/branches/main", false, k);
    forget();
    try { localStorage.setItem(STORE, k); return true; } catch { memKey = k; return false; }
  }

  /* ---------- GitHub ---------- */
  async function get(path, raw, k = key()) {
    if (!k) throw new Locked("none");
    const r = await fetch(API + path, {
      cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer",
      headers: { Authorization: "Bearer " + k, Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json" },
    });
    if (r.status === 401) throw new Locked("refused");
    if (r.status === 403 || r.status === 429) {
      if (r.headers.get("X-RateLimit-Remaining") === "0" || r.status === 429) throw new Error("GitHub's hourly limit is used up");
      throw new Locked("norepo");
    }
    if (r.status === 404) throw new Locked("norepo");
    if (!r.ok) throw new Error(`GitHub answered ${r.status}`);
    return raw ? r.text() : r.json();
  }

  /* ---------- cleaning: the same rules as hub/agency_sync.py ---------- */
  const s = (v, n = 200) => (typeof v === "string" ? v.slice(0, n) : "");
  const when = (v) => (typeof v === "string" && ISO.test(v) ? v : "");
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
  const list = (v, n) => (Array.isArray(v) ? v : []).slice(0, n);
  const strs = (v) => list(v, 4).filter((x) => typeof x === "string").map((x) => s(x, 60));
  const stamp = (v) => { const t = Date.parse(v); return isNaN(t) ? 0 : t; };

  function bot(d) {
    if (!obj(d) || !ID.test(String(d.id ?? ""))) return null;
    return {
      id: d.id, name: s(d.name || d.id, 40), division: s(d.division, 40), role: s(d.role, 80),
      color: typeof d.color === "string" && HEX.test(d.color) ? d.color : "",
      state: STATES.has(d.state) ? d.state : "off", task: s(d.task, 240),
      since: when(d.since), updated: when(d.updated), last_done: s(d.last_done, 200),
      last_done_at: when(d.last_done_at), note: s(d.note, 240),
      learned: s(d.learned, 240), learned_at: when(d.learned_at),
      ask: s(d.ask, 300), asked_at: when(d.asked_at), options: strs(d.options),
    };
  }
  function items(v, fields, limit = 20) {
    const out = [];
    for (const d of list(v, limit)) {
      if (!obj(d)) continue;
      const row = {};
      for (const [f, n] of Object.entries(fields)) {
        const val = d[f];
        if (n === "time") row[f] = when(val);
        else if (n === "num") row[f] = typeof val === "number" && isFinite(val) ? val : null;
        else if (n === "list") row[f] = strs(val);
        else row[f] = s(val, n);
      }
      out.push(row);
    }
    return out;
  }
  function board(d) {
    d = obj(d) || {};
    return {
      waiting: items(d.waiting, { id: 20, question: 300, from: 40, asked_at: "time", options: "list" }),
      shipped: items(d.shipped, { what: 200, by: 40, at: "time" }),
      in_progress: items(d.in_progress, { what: 200, owner: 40, due: "time" }),
      stuck: items(d.stuck, { what: 200, owner: 40, why: 200, needs: 40, since: "time" }),
    };
  }

  /* ---------- the report ---------- */
  async function report() {
    const br = await get("/branches/main");
    const c = br && br.commit, treeSha = c && c.commit && c.commit.tree && c.commit.tree.sha;
    if (!c || typeof c.sha !== "string" || typeof treeSha !== "string") throw new Error("GitHub sent something unexpected");
    const generated = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    if (last && last.sha === c.sha) return { ...last.report, generated };   // nothing new: one request a minute

    const tree = await get(`/git/trees/${treeSha}?recursive=1`);
    const files = {}, keep = new Set();
    let total = 0;
    for (const e of Array.isArray(tree.tree) ? tree.tree : []) {
      const size = Number(e.size);
      if (typeof e.path !== "string" || !e.path.startsWith("status/") || !e.path.endsWith(".json")) continue;
      if (e.type !== "blob" || e.mode !== "100644" || !Number.isInteger(size)) continue;   // no symlinks or submodules
      if (size > MAX_FILE || total + size > MAX_TOTAL) continue;
      if (!blobs.has(e.sha)) {
        let v = null;
        try { v = JSON.parse(await get(`/git/blobs/${e.sha}`, true)); } catch (err) { if (err instanceof Locked) throw err; }
        blobs.set(e.sha, v);
      }
      keep.add(e.sha);
      const v = blobs.get(e.sha);
      if (v === null) continue;
      files[e.path] = v;
      total += size;
    }
    for (const sha of blobs.keys()) if (!keep.has(sha)) blobs.delete(sha);

    const bots = Object.keys(files).sort().filter((p) => p.startsWith("status/bots/"))
      .map((p) => bot(files[p])).filter(Boolean).slice(0, MAX_BOTS);
    const roster = obj(files["status/roster.json"]) || {}, watch = obj(files["status/watchlist.json"]) || {};
    // Questions for Victor: Muddy's board, plus every waiting bot's own question.
    const brd = board(files["status/board.json"]);
    for (const b of bots) {
      if (b.ask) brd.waiting.push({ id: ("Q-" + b.id).slice(0, 20), question: b.ask, from: b.id,
        asked_at: b.asked_at || b.since || b.updated, options: b.options.length ? b.options : ["Yes", "No"] });
    }
    brd.waiting = brd.waiting.slice(0, 20);
    // What they learned: each bot's latest note, newest first (study.json still works too).
    const study = items(files["status/study.json"], { bot: 40, at: "time", learned: 240 }, 40)
      .concat(bots.filter((b) => b.learned).map((b) => ({ bot: b.id, at: b.learned_at, learned: b.learned })))
      .sort((a, b) => stamp(b.at) - stamp(a.at));
    const rep = {
      generated,
      source: { commit: c.sha.slice(0, 12), commit_time: when(c.commit && c.commit.committer && c.commit.committer.date) },
      bots,
      divisions: items(roster.divisions, { id: 40, name: 60, head: 40 }, 12),
      board: brd,
      projects: items(files["status/projects.json"], { id: 40, name: 80, status: 40, owner: 40, next: 200, due: "time" }),
      ideas: items(files["status/ideas.json"], { title: 200, by: 40, score: "num", status: 20 }),
      study: study.slice(0, 40),
      watchlist: { as_of: when(watch.as_of), note: s(watch.note, 200),
        items: items(watch.items, { symbol: 12, name: 60, note: 80 }) },
      inbox: {},
    };
    last = { sha: c.sha, report: rep };
    return rep;
  }

  return { report, unlock, forget, has: () => !!key(), Locked };
})();
