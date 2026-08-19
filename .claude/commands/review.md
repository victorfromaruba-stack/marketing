---
description: The Monday review — the numbers, what got promoted, and an honest read on the week
---

**Chief chairs, librarian presents.** Mondays. Longer than a standup, and the only meeting
where the studio is allowed to talk about itself.

## 1. The numbers

```bash
python3 memory/distill.py
python3 office/build_office.py
```

Librarian presents, in this order:
- prospects contacted · positive rate vs the 3.4% benchmark
- by sector, by hook, by subject line — flagging anything at n≥5
- won / lost / revenue / recurring
- what is now **promotable**, and what should be **retired**

## 2. Promote and retire

Librarian updates `memory/playbook.md`. A rule needs 5+ observations and a clear margin over
baseline, with the numbers written inline. Rules that stopped working move to
`memory/patterns/retired.md` with the numbers that killed them — not softened, removed.

## 3. The honest read

Chief answers one question in plain words: **did this week move revenue, or did it move files?**

Say which. If the repo gained features and the ledger gained nothing, say exactly that. If a
sector Victor likes is under baseline at n≥5, say to stop working it. This is the part of the
meeting that earns the rest of it.

## 4. Close

- Last week's actions: done / not done / dropped, with reasons
- Commitments overdue, and by how long
- **Next week's one focus** — one, not three
- Anything Victor must decide

Append to `memory/chief/meetings/<YYYY-MM-DD>-review.md`.
