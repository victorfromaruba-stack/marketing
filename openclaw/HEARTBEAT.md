# Heartbeat — what runs on its own

Work through this on each cycle. Everything here is inside the autonomous side of the approval
line in `AGENTS.md`. Nothing here sends anything to anyone but Victor.

## Every hour (working hours, Aruba time)

- [ ] Any new replies in the inbox? Draft a response, save as a draft, notify Victor on
      WhatsApp with a one-line summary. **Do not send.**
- [ ] Any demo deployed more than 30 days ago with no outcome recorded? Flag it for cleanup.

## 08:30 daily — STANDUP

- [ ] Run `/standup`. Chief chairs, every role reports in pipeline order, three lines each.
- [ ] Assign actions with `python3 memory/action.py add --owner <role> --due <date> "..."`
- [ ] Write the record to `memory/chief/meetings/<date>.md`
- [ ] Report overdue actions: `python3 memory/action.py overdue`

## Monday 09:00 — REVIEW

- [ ] Run `/review`. Librarian presents the numbers, promotes and retires rules.
- [ ] Chief gives the honest read: did the week move revenue, or move files?
- [ ] Set next week's single focus

## Every morning, 07:00

- [ ] Report to Victor on WhatsApp:
      - queue state: prospects researched / demos built / awaiting approval to send
      - anything blocked, and by what
      - the single next action he should take
- [ ] If fewer than 5 demos are ready to send, say so plainly — that is the bottleneck, not
      tooling.

## Every evening, 18:00

- [ ] Record any outcomes Victor reported today (`memory/record.py`)
- [ ] If any prospect hit 21 days with no reply, mark `no_reply` and close them out

## Weekly, Monday

- [ ] `python3 memory/distill.py`
- [ ] Run **librarian**: promote anything at 5+ observations beating baseline, retire what died
- [ ] If any sector is now clearly under baseline, tell Victor to stop working it — even if it
      is the one he likes
- [ ] Compress any memory file over ~150 lines

## Continuously, when idle

- [ ] Top up the prospect list (`find_prospects.py --category <thinnest sector>`)
- [ ] Research the next unresearched Tier A prospect
- [ ] Build the next demo in the queue, QA it, guard it, deploy to the demo subdomain
- [ ] Then stop and wait for approval. **Do not send.**

## Never in the heartbeat

- Sending email or messages to anyone except Victor
- Deploying to a client's own domain
- Anything costing money
