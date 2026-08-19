#!/usr/bin/env python3
"""
Aruba Web Studio — the office.

Reads the real state of the repo and renders office/index.html: who is at each desk,
what is waiting on them, where every prospect is in the pipeline, and what is sitting
in the approval queue.

  python3 office/build_office.py
  python3 office/build_office.py --open     # print the path when done

Regenerate it whenever you want a current picture. Nothing here is decorative — every
number comes off disk.
"""
import json, csv, argparse, html, sys
from pathlib import Path
from datetime import datetime, timezone
sys.path.insert(0, str(Path(__file__).resolve().parent))
import floor as F

ROOT = Path(__file__).resolve().parent.parent
OUT  = ROOT / "office" / "index.html"

# ---------------------------------------------------------------- gather state
def read_prospects():
    rows = []
    for name in ("prospects.csv", "starter-prospects.csv"):
        f = ROOT / "prospector" / name
        if f.exists():
            with f.open(encoding="utf-8") as fh:
                for r in csv.DictReader(fh):
                    r["_src"] = name
                    rows.append(r)
    seen, out = set(), []
    for r in rows:
        k = (r.get("slug") or r.get("business_name", "")).lower()
        if k and k not in seen:
            seen.add(k); out.append(r)
    return out

def read_intakes():
    d = {}
    for f in (ROOT / "intake").glob("*.json"):
        if f.stem.startswith("_"):
            continue
        try:
            d[f.stem] = json.loads(f.read_text())
        except Exception:
            pass
    return d

def read_ledger():
    f = ROOT / "memory" / "ledger" / "outcomes.jsonl"
    if not f.exists():
        return []
    return [json.loads(l) for l in f.read_text().splitlines() if l.strip()]

def read_commitments():
    f = ROOT / "memory" / "chief" / "commitments.md"
    if not f.exists():
        return []
    return [l for l in f.read_text().splitlines()
            if l.startswith("|") and l.rstrip().endswith("| open |")]

open_commitments = read_commitments()

def read_actions():
    f = ROOT / "memory" / "chief" / "actions.md"
    if not f.exists():
        return []
    out = []
    for l in f.read_text().splitlines():
        if l.startswith("| A") and l.rstrip().endswith("| open |"):
            out.append([c.strip() for c in l.strip().strip("|").split("|")])
    return out

open_actions = read_actions()

STAFF = {}
_sf = ROOT / "office" / "staff.json"
if _sf.exists():
    STAFF = {k: v for k, v in json.loads(_sf.read_text()).items() if not k.startswith("_")}
def who(role):
    return STAFF.get(role, {}).get("name", "")
prospects = read_prospects()
intakes   = read_intakes()
ledger    = read_ledger()
outcome_by_slug = {r["slug"]: r["outcome"] for r in ledger}

def stage(slug):
    """Where this prospect actually is, judged from files on disk."""
    oc = outcome_by_slug.get(slug)
    if oc in ("won",):                      return "won"
    if oc in ("lost", "unsubscribed"):      return "closed"
    if oc:                                  return "sent"
    d = intakes.get(slug)
    if (ROOT / "outreach" / "proposals" / f"{slug}-proposal.pdf").exists() \
       and d and d.get("build", {}).get("demo_url"):                 return "ready"
    if d and d.get("build", {}).get("demo_url"):                     return "deployed"
    if d and d.get("build", {}).get("qa_passed"):                    return "qa"
    if (ROOT / "sites" / slug / "index.html").exists():              return "built"
    if (ROOT / "build" / "decisions" / f"{slug}.md").exists():       return "designed"
    if d:                                                            return "researched"
    return "prospect"

STAGES = [("prospect","Prospect"),("researched","Researched"),("designed","Designed"),
          ("built","Built"),("qa","QA passed"),("deployed","Demo live"),
          ("ready","Ready to send"),("sent","Contacted"),("won","Won"),("closed","Closed")]

board = {k: [] for k, _ in STAGES}
all_slugs = set(intakes) | {r.get("slug") for r in prospects if r.get("slug")} | set(outcome_by_slug)
all_slugs.discard(None); all_slugs.discard("")
names = {}
for r in prospects:
    if r.get("slug"): names[r["slug"]] = r.get("business_name", r["slug"])
for s, d in intakes.items():
    names[s] = d.get("business_name", s)
for s in sorted(all_slugs):
    board[stage(s)].append((s, names.get(s, s)))

# ---------------------------------------------------------------- desks
def n(k): return len(board[k])

DESKS = [
 ("scout","Intelligence","Finding &amp; ranking prospects",
   n("prospect"), "prospects awaiting research", "Does not design or write copy"),
 ("analyst","Intelligence","Research → brief + the hook",
   n("prospect"), "briefs to write", "Invents nothing"),
 ("art-director","Creative","Palette, type, signature moment",
   n("researched"), "briefs awaiting a design decision", "Writes no code"),
 ("copywriter","Creative","Every word, in voice",
   n("designed"), "designs awaiting copy", "No invented claims"),
 ("engineer","Production","Building to brief",
   n("designed"), "ready to build", "Does not redesign silently"),
 ("inspector","Production","Adversarial QA",
   n("built"), "builds awaiting QA", "Never passes minor issues"),
 ("guard","Security","Security gate before deploy",
   n("qa"), "awaiting security clearance", "Cannot be skipped"),
 ("closer","Revenue","Outreach, replies, meetings",
   n("ready"), "approved &amp; ready to send", "Sends nothing before the demo is live"),
 ("librarian","Learning","Outcomes → proven rules",
   len(ledger), "observations in the ledger", "No rule under 5 observations"),
 ("chief","Right hand","Decides what matters, protects your time",
   len(open_commitments), "open commitments", "Never agrees because you are you"),
]

POSITIVE = {"replied","meeting","proposal","won"}
total_o = len(ledger)
pos_o   = sum(1 for r in ledger if r["outcome"] in POSITIVE)
won_o   = sum(1 for r in ledger if r["outcome"] == "won")
rev     = sum((r.get("value") or 0) for r in ledger if r["outcome"] == "won")
mrr     = sum((r.get("monthly") or 0) for r in ledger if r["outcome"] == "won")

playbook = (ROOT / "memory" / "playbook.md")
pb_rules = 0
if playbook.exists():
    in_promoted, in_fence = False, False
    for l in playbook.read_text().splitlines():
        if l.startswith("```"):
            in_fence = not in_fence; continue
        if in_fence:
            continue
        if l.startswith("## "):
            in_promoted = l.strip().lower().startswith("## promoted")
            continue
        if in_promoted and l.startswith("### "):
            pb_rules += 1

approval_queue = board["ready"]
def has_logo(slug):
    imgdir = ROOT / "sites" / slug / "img"
    if imgdir.exists() and any(f.stem.lower() == "logo" for f in imgdir.iterdir()):
        return True
    return bool((intakes.get(slug, {}).get("identity") or {}).get("logo_file"))

PAST_BUILD = {"built", "qa", "deployed", "ready", "sent", "won", "closed"}
blocked = []
for sl, nm in board["built"] + board["qa"]:
    blocked.append((sl, nm, "awaiting QA / security clearance"))
for sl in intakes:
    if stage(sl) in PAST_BUILD:
        continue
    if not has_logo(sl):
        blocked.append((sl, names.get(sl, sl), "no client logo — cannot build"))

# ---------------------------------------------------------------- the floor plan
load = {d[0]: d[3] for d in DESKS}
W, D = 27, 18

# x, y, w, d, accent, label, floor material, floor colour
ZONES = [
  ( 0,  0, 9, 6, "#2f9fd4", "INTELLIGENCE",       "carpet",   "#2d5f7a"),
  ( 9,  0, 9, 6, "#43b9c4", "CREATIVE",           "wood",     "#a9784a"),
  (18,  0, 9, 6, "#FFC06B", "MEETING ROOM",       "wood",     "#946541"),
  ( 0,  6, 9, 6, "#5b8fb9", "PRODUCTION",         "carpet",   "#2a4a63"),
  ( 9,  6, 9, 6, "#e08a5f", "SECURITY",           "tile",     "#6d5348"),
  (18,  6, 9, 6, "#FFC06B", "VICTOR + CHIEF",     "wood",     "#8a5c38"),
  ( 0, 12, 9, 6, "#9fb4c4", "RECEPTION + BREAK",  "tile",     "#5d6b75"),
  ( 9, 12,18, 6, "#4fc08a", "REVENUE + LEARNING", "carpet",   "#2b6350"),
]

svg  = F.slab(W, D, ZONES)
svg += F.outer(W, D)
for z in ZONES:
    svg += F.skirting(z[0], z[1], z[2], z[3])

# internal partitions, with doorways left open
svg += F.wall(0,  6, "x",  9, doors=(4, 5))
svg += F.wall(9,  6, "x",  9, doors=(4, 5))
svg += F.wall(18, 6, "x",  9, doors=(4, 5))
svg += F.wall(0, 12, "x", 27, doors=(4, 5, 13, 14, 21, 22))
svg += F.wall(9,  0, "y", 12, doors=(2, 3, 8, 9))
svg += F.wall(18, 0, "y", 12, doors=(2, 3, 8, 9))
svg += F.wall(9, 12, "y",  6, doors=(2, 3))

zone_labels = "".join(F.zonelabel(z[0], z[1], z[4], z[5], z[2], z[3]) for z in ZONES)

# everything on the floor, painted far-to-near so overlaps stack correctly
items = [
  (1.4, 1.3,   lambda: F.desk(1.4, 1.3, "#0b4f77", "scout", load["scout"], "to research", who("scout"))),
  (4.9, 3.6,   lambda: F.desk(4.9, 3.6, "#0b4f77", "analyst", load["analyst"], "briefs to write", who("analyst"))),
  (7.9, 0.5,   lambda: F.cabinet(7.9, 0.5)),
  (7.9, 4.6,   lambda: F.plant(7.9, 4.6, True)),
  (10.4, 1.3,  lambda: F.desk(10.4, 1.3, "#1C7FA8", "art-director", load["art-director"], "to design", who("art-director"))),
  (13.7, 3.6,  lambda: F.desk(13.7, 3.6, "#1C7FA8", "copywriter", load["copywriter"], "to write", who("copywriter"))),
  (10.2, 5.0,  lambda: F.whiteboard(10.2, 5.0, 3)),
  (16.8, 0.6,  lambda: F.plant(16.8, 0.6)),
  (19.8, 1.6,  lambda: F.meeting(19.8, 1.6, 10, "Meeting room", "standup 08:30 \u00b7 review Mondays")),
  (25.4, 0.6,  lambda: F.plant(25.4, 0.6, True)),
  (1.4, 7.3,   lambda: F.desk(1.4, 7.3, "#0A2F4E", "engineer", load["engineer"], "to build", who("engineer"))),
  (4.9, 9.6,   lambda: F.desk(4.9, 9.6, "#0A2F4E", "inspector", load["inspector"], "to inspect", who("inspector"))),
  (7.9, 6.9,   lambda: F.cabinet(7.9, 6.9)),
  (11.0, 8.2,  lambda: F.desk(11.0, 8.2, "#8a3b1f", "guard", load["guard"], "to clear", who("guard"))),
  (15.0, 6.6,  lambda: F.cabinet(15.0, 6.6, "#7c5a4a")),
  (16.6, 10.4, lambda: F.plant(16.6, 10.4)),
  (19.4, 7.2,  lambda: F.victor(19.4, 7.2, "#7a5a12", n("ready"))),
  (23.4, 8.4,  lambda: F.chief_desk(23.4, 8.4, "#7a5a12", who("chief"))),
  (25.8, 7.4,  lambda: F.plant(25.8, 7.4, True)),
  (1.2, 13.0,  lambda: F.reception(1.2, 13.0)),
  (5.6, 15.4,  lambda: F.sofa(5.6, 15.4)),
  (5.4, 12.6,  lambda: F.coffee(5.4, 12.6)),
  (7.6, 12.6,  lambda: F.cooler(7.6, 12.6)),
  (10.4, 13.2, lambda: F.desk(10.4, 13.2, "#1d6b52", "closer", load["closer"], "ready to send", who("closer"))),
  (13.9, 15.3, lambda: F.desk(13.9, 15.3, "#1d6b52", "librarian", load["librarian"], "observations", who("librarian"))),
  (18.4, 13.4, lambda: F.shelf(18.4, 13.4, "#1d6b52", pb_rules)),
  (21.4, 14.6, lambda: F.sofa(21.4, 14.6, "#2c6b52")),
  (25.4, 12.8, lambda: F.plant(25.4, 12.8, True)),
]
for _, _, fn in sorted(items, key=lambda t: t[0] + t[1]):
    svg += fn()
svg += zone_labels

xs, ys = [], []
for gx in (0, W):
    for gy in (0, D):
        for gz in (0, 90):
            px, py = F.iso(gx, gy, gz); xs.append(px); ys.append(py)
PAD = 78
minx, maxx = min(xs) - PAD, max(xs) + PAD
miny, maxy = min(ys) - PAD, max(ys) + PAD
FLOOR_SVG = (f'<svg viewBox="{minx:.0f} {miny:.0f} {maxx-minx:.0f} {maxy-miny:.0f}" '
             f'role="img" aria-label="Isometric plan of the studio office: nine desks in five '
             f'rooms, a meeting room, reception and break area, and Victor and chief\'s office" '
             f'font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif">{svg}</svg>')

e0 = lambda x: html.escape(str(x))
if open_actions:
    actions_html = '<ul class="aq">' + "".join(
        f'<li><b>{e0(a[2])}</b> — {e0(a[3])} <span style="color:#5B7488">· due {e0(a[4])}</span></li>'
        for a in open_actions) + '</ul>'
else:
    actions_html = '<p class="note">No open actions. Either the studio is clear, or standup is not assigning.</p>'

e = lambda x: html.escape(str(x))
now = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")

# ---------------------------------------------------------------- render
desk_html = ""
dept_colour = {"Intelligence":"d1","Creative":"d2","Production":"d3","Security":"d4",
               "Revenue":"d5","Learning":"d5","Right hand":"d6"}
for name, dept, job, count, unit, never in DESKS:
    busy = "busy" if count else "idle"
    desk_html += f"""
    <article class="desk {dept_colour[dept]} {busy}">
      <div class="dtop"><span class="dept">{e(dept)}</span>
        <span class="light {busy}" title="{'work waiting' if count else 'nothing waiting'}"></span></div>
      <h3>{e(who(name) or name)}</h3>
      <p class="job"><b style="color:#0A2F4E">{e(name)}</b> · {job}</p>
      <div class="load"><b>{count}</b><span>{unit}</span></div>
      <p class="never">✕ {e(never)}</p>
    </article>"""

board_html = ""
for key, label in STAGES:
    items = board[key]
    lis = "".join(f"<li>{e(nm)}</li>" for _, nm in items[:8]) or '<li class="empty">—</li>'
    more = f'<li class="more">+{len(items)-8} more</li>' if len(items) > 8 else ""
    board_html += f"""
      <div class="col{' hot' if key=='ready' else ''}">
        <h4>{e(label)}<span>{len(items)}</span></h4>
        <ul>{lis}{more}</ul>
      </div>"""

if approval_queue:
    aq = "".join(f"<li><b>{e(nm)}</b> — demo live, proposal built, email drafted</li>"
                 for _, nm in approval_queue)
    approval = f'<ul class="aq">{aq}</ul><p class="note">Nothing is sent without your explicit go-ahead.</p>'
else:
    approval = '<p class="note">Nothing waiting for approval. The queue fills as demos are built and QA-cleared.</p>'

if blocked:
    bl = "".join(f"<li><b>{e(nm)}</b> — {e(why)}</li>" for _, nm, why in blocked[:10])
    blocked_html = f'<ul class="bl">{bl}</ul>'
else:
    blocked_html = '<p class="note">Nothing blocked.</p>'

evidence = (f"{pb_rules} proven rule(s) in the playbook" if pb_rules
            else "Playbook is empty — every rule in the system is still labelled <code>[assumed]</code>")

HTML = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aruba Web Studio — The Office</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNDAgMjQwIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMC4wLDAuMCkgc2NhbGUoMC4zMTAyNCkgdHJhbnNsYXRlKC0xMjQuNywtMTI0LjcpIj48cGF0aCBkPSJNIDQ5OSAxNTUgTCA0MjIgMTY2IEwgMzYxIDE4OCBMIDI5OCAyMjYgTCAyNTMgMjY2IEwgMjA5IDMyMyBMIDE3OCAzODUgTCAxNjAgNDUxIEwgMTU1IDUyMyBMIDE2NCA1OTIgTCAxODggNjYxIEwgMjI4IDcyNyBMIDI3MCA3NzMgTCAzMjUgODE1IEwgMzkxIDg0NyBMIDQ1MSA4NjMgTCA1MjEgODY4IEwgNTkxIDg1OSBMIDY2MSA4MzUgTCA3MjcgNzk1IEwgNzc1IDc1MSBMIDgxNyA2OTUgTCA4NDkgNjI3IEwgODY1IDU2MSBMIDg2OCA0OTYgTCA4NTcgNDIzIEwgODMzIDM1NyBMIDgwMCAzMDIgTCA3NTUgMjUxIEwgNzAyIDIxMCBMIDY0MSAxNzkgTCA1NzMgMTYwIFogTSA0ODggMTc4IEwgNTQ4IDE3OSBMIDYxOSAxOTUgTCA2NzggMjIyIEwgNzMyIDI2MSBMIDc3NiAzMDggTCA4MDggMzU4IEwgODMwIDQxMCBMIDg0NSA0ODcgTCA4NDQgNTQ4IEwgODMyIDYwNiBMIDgxMCA2NjEgTCA3NzEgNzIxIEwgNzI3IDc2NiBMIDY2MSA4MTAgTCA1OTkgODM0IEwgNTM1IDg0NSBMIDQ3NyA4NDQgTCA0MTEgODMwIEwgMzUxIDgwNCBMIDI5NCA3NjQgTCAyNTMgNzIyIEwgMjE5IDY3MiBMIDE5MyA2MTIgTCAxNzggNTM0IEwgMTgwIDQ2OSBMIDE5NyAzOTkgTCAyMjcgMzM3IEwgMjYzIDI4OSBMIDMxNiAyNDEgTCAzNzAgMjA5IEwgNDIzIDE4OSBaIiBmaWxsPSIjRkZDMDZCIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz48cGF0aCBkPSJNIDI4NiAzODEgTCAyODIgMzkwIEwgMzI1IDM5MCBMIDMyNiAzOTUgTCAzMTEgNDE2IEwgMjcxIDQyMyBMIDI1OCA0MzYgTCAzMDcgNDM3IEwgMzEwIDQ2MyBMIDMyMiA0OTAgTCA0MTUgNjM0IEwgNDMzIDY3NyBMIDQzMyA2OTUgTCAzNTQgNjk1IEwgMzU0IDcxMCBMIDYwNiA3MTAgTCA2MDYgNjk1IEwgNTQyIDY5NSBMIDM5MyA1MDggTCAzODcgNDgzIEwgMzk1IDQ3MyBMIDQzNSA0NzIgTCA0ODAgNDg4IEwgNTExIDUwOSBMIDUxNCA1MTggTCA1NjMgNTQyIEwgNTQ4IDU2MSBMIDc1NiA1NjEgTCA3NDEgNTQ1IEwgNzAwIDU0MSBMIDY3OCA1MjkgTCA2MzMgNTI3IEwgNTkzIDUzOCBMIDU1OCA1MjUgTCA1NTcgNTE4IEwgODA2IDUxOCBMIDc5NCA1MDUgTCA3NDIgNDk5IEwgNzMyIDQ4NyBMIDcxOSA0ODMgTCA3MjAgNDc4IEwgNzc1IDQ3OCBMIDc1NCA0NjIgTCA2NjcgNDU4IEwgNjU4IDQ0NSBMIDU0OSA0NDggTCA1MzkgNDQyIEwgNTM5IDQzNiBMIDczOCA0MzYgTCA3MjEgNDIyIEwgNjQ5IDQxNSBMIDY0MCA0MDQgTCA2MTAgMzk1IEwgNjExIDM5MCBMIDY2MSAzOTAgTCA2NDggMzc3IEwgNjAxIDM3MiBMIDU4NSAzNjIgTCA1NDggMzU0IEwgNTQ5IDM0OSBMIDYxMyAzNDkgTCA1OTMgMzM0IEwgNTI0IDMzMCBMIDUxOSAzMTcgTCA1MDggMzEzIEwgNDE1IDMxNiBMIDM3NCAzMjUgTCAzMzQgMzQzIEwgMzMwIDM0OSBMIDM2NCAzNTAgTCAzNTkgMzYxIEwgMzQyIDM3MiBaIE0gNTA0IDQ3OSBMIDU2OCA0NzggTCA1ODggNDkyIEwgNTU4IDQ5NCBMIDUzMCA1MDQgWiBNIDQxNSA0NDQgTCA0MjUgNDM2IEwgNDY5IDQzNiBMIDUwOCA0NDUgTCA1MjAgNDU1IEwgNDgyIDQ2OSBMIDQ0NyA0NTQgTCA0MTYgNDQ5IFogTSAzMzYgNDM3IEwgMzc3IDQzNiBMIDM3OCA0NDEgTCAzNTIgNDcwIFogTSA0NjIgNDAyIEwgNDY4IDM5MCBMIDUwNSAzOTEgTCA0OTYgNDAzIFogTSAzNDQgNDE0IEwgMzYyIDM5MCBMIDQ0MCAzOTEgTCA0MzEgNDAzIEwgMzcyIDQwMyBMIDM2MyA0MTUgWiIgZmlsbD0iIzBBMkY0RSIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9nPjwvc3ZnPg==">
<style>
:root{{--abyss:#02141f;--deep:#0A2F4E;--ocean:#0b4f77;--sea:#1C7FA8;--shallow:#43b9c4;
--glass:#a9e4e8;--sun:#FF7A45;--gold:#ffc06b;--sand:#F7F3EC;--paper:#FFFDF9;--foam:#EAF3F6;
--ink:#0B1A26;--muted:#5B7488;--ok:#1d6b52;
--display:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
--sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:var(--sans);font-size:15.5px;line-height:1.6;color:var(--ink);background:var(--sand)}}
body::after{{content:"";position:fixed;inset:0;z-index:99;pointer-events:none;opacity:.05;
background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}}
.wrap{{width:min(1340px,100% - 2.6rem);margin-inline:auto}}
header{{background:linear-gradient(150deg,var(--abyss),var(--deep) 55%,var(--ocean));color:#fff;padding:2.8rem 0 2.4rem}}
.hrow{{display:flex;flex-wrap:wrap;gap:1rem;justify-content:space-between;align-items:flex-end}}
.eyebrow{{font-size:.72rem;letter-spacing:.24em;text-transform:uppercase;color:var(--gold);margin-bottom:.5rem}}
h1{{font-family:var(--display);font-size:clamp(1.9rem,4.4vw,3rem);font-weight:600;letter-spacing:-.02em;line-height:1.04}}
.stamp{{font-size:.85rem;color:rgba(255,255,255,.62)}}
.kpis{{display:grid;gap:1px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.14);border-radius:14px;overflow:hidden;margin-top:1.9rem}}
.kpi{{background:var(--deep);padding:1.05rem 1.15rem}}
.kpi b{{font-family:var(--display);font-size:1.85rem;color:#fff;display:block;line-height:1.1}}
.kpi span{{font-size:.76rem;letter-spacing:.13em;text-transform:uppercase;color:rgba(255,255,255,.55)}}
section{{padding:2.6rem 0}}
h2{{font-family:var(--display);font-size:1.75rem;font-weight:600;letter-spacing:-.015em;margin-bottom:.35rem}}
.sub{{color:var(--muted);margin-bottom:1.5rem;max-width:64ch;font-size:.98rem}}
.plan{{background:linear-gradient(180deg,#0d2233 0%,#123246 100%);padding:2.6rem 0 2.2rem}}
.plan h2{{color:#fff}} .plan .sub{{color:rgba(255,255,255,.68)}}
.floorplan{{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);
border-radius:16px;padding:1rem}}
.floorplan svg{{width:100%;height:auto;display:block}}
.legend{{margin-top:.9rem;font-size:.85rem;color:rgba(255,255,255,.62);display:flex;gap:1.2rem;flex-wrap:wrap;align-items:center}}
.sw{{display:inline-block;width:10px;height:10px;border-radius:99px;vertical-align:-1px;margin-right:.35rem}}
.sw.on{{background:#FFC06B}} .sw.off{{background:#4a5560}} .sw.amber{{background:#FF7A45}}
.desks{{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(238px,1fr))}}
.desk{{background:var(--paper);border:1px solid rgba(10,47,78,.13);border-radius:14px;padding:1.2rem;border-top:3px solid var(--sea)}}
.desk.d1{{border-top-color:var(--ocean)}}.desk.d2{{border-top-color:var(--sea)}}
.desk.d3{{border-top-color:var(--deep)}}.desk.d4{{border-top-color:#8a3b1f}}.desk.d5{{border-top-color:var(--ok)}}
.desk.d6{{border-top-color:var(--gold);background:#fffaf0}}
.dtop{{display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem}}
.dept{{font-size:.67rem;letter-spacing:.17em;text-transform:uppercase;color:var(--muted)}}
.light{{width:9px;height:9px;border-radius:99px;background:rgba(10,47,78,.2)}}
.light.busy{{background:var(--sun);box-shadow:0 0 0 3px rgba(255,122,69,.20)}}
.desk h3{{font-family:var(--display);font-size:1.3rem;color:var(--deep);font-weight:600}}
.job{{font-size:.9rem;color:var(--muted);margin-bottom:.75rem}}
.load{{display:flex;align-items:baseline;gap:.45rem;padding-top:.65rem;border-top:1px solid rgba(10,47,78,.1)}}
.load b{{font-family:var(--display);font-size:1.6rem;color:var(--deep)}}
.load span{{font-size:.82rem;color:var(--muted)}}
.never{{font-size:.78rem;color:#a04a2c;margin-top:.6rem}}
.board{{display:grid;gap:.7rem;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}}
.col{{background:var(--paper);border:1px solid rgba(10,47,78,.12);border-radius:12px;padding:.85rem}}
.col.hot{{border-color:var(--sun);background:#fff6f2}}
.col h4{{font-size:.73rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);
display:flex;justify-content:space-between;margin-bottom:.5rem}}
.col h4 span{{color:var(--deep);font-weight:700}}
.col ul{{list-style:none;font-size:.85rem}}
.col li{{padding:.28rem 0;border-top:1px solid rgba(10,47,78,.07);color:var(--ink)}}
.col li:first-child{{border-top:0}}
.col .empty,.col .more{{color:var(--muted)}}
.two{{display:grid;gap:1.3rem;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}}
.panel{{background:var(--paper);border:1px solid rgba(10,47,78,.13);border-radius:14px;padding:1.4rem}}
.panel.approve{{border-left:4px solid var(--sun)}}
.panel h3{{font-family:var(--display);font-size:1.3rem;color:var(--deep);margin-bottom:.6rem}}
.aq,.bl{{list-style:none;font-size:.93rem}}
.aq li,.bl li{{padding:.5rem 0;border-top:1px solid rgba(10,47,78,.09)}}
.aq li:first-child,.bl li:first-child{{border-top:0}}
.note{{color:var(--muted);font-size:.92rem}}
code{{font-family:ui-monospace,Menlo,monospace;font-size:.86em;background:var(--foam);padding:.1em .4em;border-radius:5px;color:var(--ocean)}}
footer{{background:var(--abyss);color:rgba(255,255,255,.55);padding:1.9rem 0;font-size:.86rem;margin-top:1.5rem}}
</style></head><body>

<header><div class="wrap">
  <div class="hrow">
    <div style="display:flex;align-items:center;gap:18px">
      <svg viewBox="0 0 240 240" width="62" height="62" style="flex:none"><g transform="translate(0.0,0.0) scale(0.31024) translate(-124.7,-124.7)"><path d="M 499 155 L 422 166 L 361 188 L 298 226 L 253 266 L 209 323 L 178 385 L 160 451 L 155 523 L 164 592 L 188 661 L 228 727 L 270 773 L 325 815 L 391 847 L 451 863 L 521 868 L 591 859 L 661 835 L 727 795 L 775 751 L 817 695 L 849 627 L 865 561 L 868 496 L 857 423 L 833 357 L 800 302 L 755 251 L 702 210 L 641 179 L 573 160 Z M 488 178 L 548 179 L 619 195 L 678 222 L 732 261 L 776 308 L 808 358 L 830 410 L 845 487 L 844 548 L 832 606 L 810 661 L 771 721 L 727 766 L 661 810 L 599 834 L 535 845 L 477 844 L 411 830 L 351 804 L 294 764 L 253 722 L 219 672 L 193 612 L 178 534 L 180 469 L 197 399 L 227 337 L 263 289 L 316 241 L 370 209 L 423 189 Z" fill="#FFC06B" fill-rule="evenodd"/><path d="M 286 381 L 282 390 L 325 390 L 326 395 L 311 416 L 271 423 L 258 436 L 307 437 L 310 463 L 322 490 L 415 634 L 433 677 L 433 695 L 354 695 L 354 710 L 606 710 L 606 695 L 542 695 L 393 508 L 387 483 L 395 473 L 435 472 L 480 488 L 511 509 L 514 518 L 563 542 L 548 561 L 756 561 L 741 545 L 700 541 L 678 529 L 633 527 L 593 538 L 558 525 L 557 518 L 806 518 L 794 505 L 742 499 L 732 487 L 719 483 L 720 478 L 775 478 L 754 462 L 667 458 L 658 445 L 549 448 L 539 442 L 539 436 L 738 436 L 721 422 L 649 415 L 640 404 L 610 395 L 611 390 L 661 390 L 648 377 L 601 372 L 585 362 L 548 354 L 549 349 L 613 349 L 593 334 L 524 330 L 519 317 L 508 313 L 415 316 L 374 325 L 334 343 L 330 349 L 364 350 L 359 361 L 342 372 Z M 504 479 L 568 478 L 588 492 L 558 494 L 530 504 Z M 415 444 L 425 436 L 469 436 L 508 445 L 520 455 L 482 469 L 447 454 L 416 449 Z M 336 437 L 377 436 L 378 441 L 352 470 Z M 462 402 L 468 390 L 505 391 L 496 403 Z M 344 414 L 362 390 L 440 391 L 431 403 L 372 403 L 363 415 Z" fill="#FFFDF9" fill-rule="evenodd"/></g></svg>
      <div><p class="eyebrow">Aruba Web Studio</p><h1>The Office</h1></div>
    </div>
    <p class="stamp">state read from disk · {now}</p>
  </div>
  <div class="kpis">
    <div class="kpi"><b>{len(all_slugs)}</b><span>in the system</span></div>
    <div class="kpi"><b>{n('deployed')+n('ready')}</b><span>demos live</span></div>
    <div class="kpi"><b>{n('ready')}</b><span>awaiting approval</span></div>
    <div class="kpi"><b>{total_o}</b><span>outcomes recorded</span></div>
    <div class="kpi"><b>{won_o}</b><span>won</span></div>
    <div class="kpi"><b>{len(open_actions)}</b><span>open actions</span></div>
    <div class="kpi"><b>${rev:,.0f}</b><span>build fees</span></div>
    <div class="kpi"><b>${mrr:,.0f}</b><span>per month</span></div>
  </div>
</div></header>

<section class="plan"><div class="wrap">
  <h2>The floor</h2>
  <p class="sub">The whole floor. A lamp is lit and a badge is showing wherever work is waiting.
  The tray on Victor's desk is the approval queue — nothing leaves the building without passing
  through it. Standup happens at the table in the meeting room, 08:30 daily.</p>
  <div class="floorplan">{FLOOR_SVG}</div>
  <p class="legend"><span class="sw on"></span> work waiting &nbsp;
     <span class="sw off"></span> clear &nbsp;
     <span class="sw amber"></span> awaiting your approval</p>
</div></section>

<section><div class="wrap">
  <h2>The desks</h2>
  <p class="sub">Nine roles plus your right hand. The light is on where work is waiting.</p>
  <div class="desks">{desk_html}</div>
</div></section>

<section style="padding-top:0"><div class="wrap">
  <h2>The pipeline</h2>
  <p class="sub">Every prospect, at the stage its files say it is at — not where anyone remembers putting it.</p>
  <div class="board">{board_html}</div>
</div></section>

<section style="padding-top:.4rem"><div class="wrap">
  <div class="two">
    <div class="panel approve">
      <h3>Awaiting your approval</h3>
      {approval}
    </div>
    <div class="panel">
      <h3>Blocked</h3>
      {blocked_html}
    </div>
    <div class="panel">
      <h3>Open actions</h3>
      {actions_html}
      <p class="note" style="margin-top:.7rem">Assigned in standup, 08:30 daily. Every one has an
      owner and a date — chief chases what slips.</p>
    </div>
  </div>
  <div class="panel" style="margin-top:1.3rem">
    <h3>What the studio actually knows</h3>
    <p class="note">{evidence}. {pos_o} positive outcome(s) from {total_o} recorded.
    A rule reaches the playbook only at 5+ observations beating baseline — until then the
    team works from reasoning and says so.</p>
  </div>
</div></section>

<footer><div class="wrap">Regenerate with <code>python3 office/build_office.py</code> · nine roles, one memory</div></footer>
</body></html>"""

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(HTML, encoding="utf-8")
print(f"  office rendered -> {OUT}")
print(f"  {len(all_slugs)} in system · {n('ready')} awaiting approval · {total_o} outcomes")
if not total_o:
    print("  ledger empty — KPIs stay at zero until real outcomes are recorded")
