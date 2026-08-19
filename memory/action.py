#!/usr/bin/env python3
"""Actions assigned in standup.

  python3 memory/action.py add --owner engineer --due 2026-09-04 "Build the Rancho Loco demo"
  python3 memory/action.py done A3
  python3 memory/action.py list
  python3 memory/action.py overdue --today 2026-09-05
"""
import argparse, re, sys
from pathlib import Path
from datetime import datetime, timezone

F = Path(__file__).resolve().parent / "chief" / "actions.md"
ROW = re.compile(r"^\|\s*(A\d+)\s*\|(.*)\|\s*$")

def rows():
    out = []
    for line in F.read_text().splitlines():
        m = ROW.match(line)
        if m:
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            out.append(cells)
    return out

def write(rs):
    txt = F.read_text().splitlines()
    head = []
    for l in txt:
        head.append(l)
        if l.startswith("|---"):
            break
    body = ["| " + " | ".join(r) + " |" for r in rs]
    tail = txt[txt.index("## Rules"):] if "## Rules" in txt else []
    F.write_text("\n".join(head + body + [""] + tail) + "\n")

ap = argparse.ArgumentParser()
sub = ap.add_subparsers(dest="cmd", required=True)
a = sub.add_parser("add"); a.add_argument("action"); a.add_argument("--owner", required=True)
a.add_argument("--due", required=True)
d = sub.add_parser("done"); d.add_argument("id")
sub.add_parser("list")
o = sub.add_parser("overdue"); o.add_argument("--today")
args = ap.parse_args()

rs = rows()
today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

if args.cmd == "add":
    nid = f"A{max([int(r[0][1:]) for r in rs], default=0) + 1}"
    rs.append([nid, today, args.owner, args.action, args.due, "open"])
    write(rs)
    print(f"  {nid}  {args.owner} -> {args.action}  (due {args.due})")

elif args.cmd == "done":
    hit = False
    for r in rs:
        if r[0].lower() == args.id.lower():
            r[5] = "done"; hit = True
    write(rs)
    print(f"  {args.id} closed" if hit else f"  no action {args.id}")

elif args.cmd == "list":
    open_rows = [r for r in rs if r[5] == "open"]
    if not open_rows:
        print("\n  No open actions. Either the studio is clear or the standup is not assigning.\n")
    for r in open_rows:
        print(f"  {r[0]:<4} {r[2]:<14} due {r[4]}   {r[3]}")

elif args.cmd == "overdue":
    t = args.today or today
    late = [r for r in rs if r[5] == "open" and r[4] < t]
    if not late:
        print("  nothing overdue")
    for r in late:
        days = (datetime.strptime(t, "%Y-%m-%d") - datetime.strptime(r[4], "%Y-%m-%d")).days
        print(f"  {r[0]:<4} {r[2]:<14} {days}d late   {r[3]}")
