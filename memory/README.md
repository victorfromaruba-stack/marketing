# Memory

Plain files on disk. Every agent reads before it works and writes when it finishes. Nothing
depends on a conversation staying open.

```
memory/
  playbook.md            PROVEN rules. Read by every agent, first, every time.
  patterns/
    design.md            visual choices, with outcomes attached
    copy.md              hooks and subject lines, with reply rates
    sectors.md           what each sector actually responds to
    retired.md           rules that stopped working, and the numbers that killed them
  ledger/
    outcomes.jsonl       one line per prospect — the raw evidence
    postmortems/         one file per won or lost deal
    shortlist-<date>.md  what scout produced
  clients/               per-client facts (gitignored — other people's material)
```

## The rules

1. **`playbook.md` contains only proven rules.** ≥5 observations, beats baseline, stated as an
   instruction. Everything less certain lives in `patterns/` marked *Pending*.
2. **Every rule carries its evidence inline.** A rule without a number is an opinion.
3. **Record every outcome, including failures.** A pattern cannot be found in wins alone.
4. **Compress relentlessly.** Files over ~150 lines get distilled. Memory nobody reads because
   it is too long is the same as no memory.
5. **Retire, do not soften.** A rule that stops working moves to `retired.md`.

## Recording

```bash
python3 memory/record.py <slug> --outcome replied --hook commission --sector "Guesthouse / Rental"
python3 memory/distill.py                 # what the evidence actually says
python3 memory/distill.py --min-n 3       # loosen the threshold while the sample is small
```
