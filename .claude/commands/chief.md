---
description: Your right hand — briefing, dispatch, and a straight read on where the studio actually is
---

Use the **chief** subagent. Brief is in `.claude/agents/chief.md`.

$ARGUMENTS

If no instruction was given, run the standard briefing: read `memory/chief/state.md` and
`memory/chief/commitments.md`, run `python3 office/build_office.py`, and report in the format
at the end of the brief.

End with one next action. Not a list. One.
