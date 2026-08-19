#!/usr/bin/env python3
"""
Record one outcome. This file is the entire evidence base — if it is not written here,
the studio cannot learn from it.

  python3 memory/record.py <slug> --outcome replied
  python3 memory/record.py <slug> --outcome won --value 650 --monthly 35
  python3 memory/record.py <slug> --outcome lost --reason "went with his nephew"
"""
import json, argparse, sys
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "memory" / "ledger" / "outcomes.jsonl"
OUTCOMES = ["no_reply", "replied", "meeting", "proposal", "won", "lost", "unsubscribed", "bounced"]

ap = argparse.ArgumentParser()
ap.add_argument("slug")
ap.add_argument("--outcome", required=True, choices=OUTCOMES)
ap.add_argument("--sector"); ap.add_argument("--hook"); ap.add_argument("--subject")
ap.add_argument("--touch", type=int, help="which touch produced this (1-5)")
ap.add_argument("--palette", help="palette family, e.g. 'deep-ocean', 'warm-sand'")
ap.add_argument("--value", type=float); ap.add_argument("--monthly", type=float)
ap.add_argument("--reason"); ap.add_argument("--date", help="YYYY-MM-DD, defaults to today")
a = ap.parse_args()

# backfill from the intake brief so the ledger is rich without extra typing
intake = ROOT / "intake" / f"{a.slug}.json"
sector = a.sector; hook = a.hook; palette = a.palette
if intake.exists():
    d = json.loads(intake.read_text())
    sector = sector or d.get("sector")
    hook = hook or (d.get("the_hook") or {}).get("search_term") or ""
    if not palette:
        cols = (d.get("identity") or {}).get("colors") or []
        palette = cols[0] if cols else ""

rec = {
    "date": a.date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    "slug": a.slug, "outcome": a.outcome, "sector": sector or "",
    "hook": hook or "", "subject": a.subject or "", "touch": a.touch,
    "palette": palette or "", "value": a.value, "monthly": a.monthly,
    "reason": a.reason or "",
}
LEDGER.parent.mkdir(parents=True, exist_ok=True)
with LEDGER.open("a") as f:
    f.write(json.dumps(rec) + "\n")

n = sum(1 for _ in LEDGER.open())
print(f"  recorded: {a.slug} -> {a.outcome}")
print(f"  ledger now holds {n} observation(s)")
if n < 5:
    print(f"  {5-n} more before any pattern can be promoted to the playbook.")
if a.outcome in ("won", "lost"):
    print(f"\n  Write the post-mortem: memory/ledger/postmortems/{a.slug}.md")
    print("  Run /librarian — losses are worth more than wins.")
