#!/usr/bin/env python3
"""
Turn the ledger into what the evidence actually says. Refuses to report a rate on a
sample too small to mean anything.

  python3 memory/distill.py
  python3 memory/distill.py --min-n 3
"""
import json, argparse
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "memory" / "ledger" / "outcomes.jsonl"

ap = argparse.ArgumentParser()
ap.add_argument("--min-n", type=int, default=5,
                help="minimum observations before a rate is reported (default 5)")
a = ap.parse_args()

if not LEDGER.exists() or not LEDGER.read_text().strip():
    print("\n  Ledger is empty. Nothing to distil.\n")
    print("  This is the point of the whole structure: it learns from outcomes, and there")
    print("  are no outcomes yet. Send the first batch, record what happens, come back.\n")
    raise SystemExit(0)

rows = [json.loads(l) for l in LEDGER.open() if l.strip()]
POSITIVE = {"replied", "meeting", "proposal", "won"}
CLOSED   = {"won", "lost"}

def bucket(key):
    d = defaultdict(lambda: {"n": 0, "pos": 0, "won": 0, "rev": 0.0, "mrr": 0.0})
    for r in rows:
        k = (r.get(key) or "").strip() or "(unset)"
        b = d[k]; b["n"] += 1
        if r["outcome"] in POSITIVE: b["pos"] += 1
        if r["outcome"] == "won":
            b["won"] += 1
            b["rev"] += r.get("value") or 0
            b["mrr"] += r.get("monthly") or 0
    return d

def show(title, key, minn):
    d = bucket(key)
    if not d: return
    print(f"\n{title}")
    print(f"  {'':<34}{'n':>4}{'reply':>9}{'won':>6}")
    for k, b in sorted(d.items(), key=lambda kv: -kv[1]["n"]):
        rate = f"{b['pos']/b['n']*100:>7.0f}%" if b["n"] >= minn else f"{'n<'+str(minn):>8}"
        print(f"  {k[:33]:<34}{b['n']:>4}{rate}{b['won']:>6}")

total = len(rows)
pos   = sum(1 for r in rows if r["outcome"] in POSITIVE)
won   = sum(1 for r in rows if r["outcome"] == "won")
lost  = sum(1 for r in rows if r["outcome"] == "lost")
rev   = sum((r.get("value") or 0) for r in rows if r["outcome"] == "won")
mrr   = sum((r.get("monthly") or 0) for r in rows if r["outcome"] == "won")

print("\n" + "="*56)
print("  LEDGER")
print("="*56)
print(f"  {total} prospects contacted")
if total >= a.min_n:
    print(f"  {pos} positive ({pos/total*100:.1f}%)   benchmark 3.4%")
else:
    print(f"  {pos} positive — sample too small for a meaningful rate")
print(f"  {won} won, {lost} lost")
if won:
    print(f"  ${rev:,.0f} in build fees   ${mrr:,.0f}/mo recurring (${mrr*12:,.0f}/yr)")
    print(f"  avg build fee ${rev/won:,.0f}")
if won + lost >= a.min_n:
    print(f"  close rate {won/(won+lost)*100:.0f}%")

show("BY SECTOR",        "sector",  a.min_n)
show("BY HOOK",          "hook",    a.min_n)
show("BY SUBJECT LINE",  "subject", a.min_n)
show("BY PALETTE",       "palette", a.min_n)

d = bucket("sector")
ready = [(k, b) for k, b in d.items() if b["n"] >= a.min_n and k != "(unset)"]
print("\n" + "="*56)
if ready:
    base = pos / total
    print("  PROMOTABLE — enough evidence to write a rule:")
    for k, b in ready:
        r = b["pos"] / b["n"]
        verdict = "BEATS" if r > base * 1.3 else ("UNDER" if r < base * 0.7 else "matches")
        print(f"    {k[:30]:<32} {r*100:>5.0f}%  {verdict} baseline {base*100:.0f}%")
    print("\n  Run /librarian to promote these into memory/playbook.md with their numbers.")
else:
    print(f"  Nothing promotable yet — no segment has {a.min_n}+ observations.")
    print("  Keep recording. The playbook stays empty until the evidence exists.")
print("="*56 + "\n")
