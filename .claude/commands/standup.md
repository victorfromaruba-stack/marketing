---
description: The daily standup — every role reports, chief assigns actions, one thing gets decided
---

**Chief chairs.** 08:30, every working day. Run it even when little has moved — a short honest
standup is the point.

## 1. Read the room first

```bash
python3 office/build_office.py
```

Read `memory/chief/state.md`, `memory/chief/actions.md`, and `memory/chief/commitments.md`.
Come in knowing the numbers. Do not ask a role for something the files already say.

## 2. Round the table — pipeline order

Each role gets **three lines, maximum**. Chief cuts anyone who runs long.

```
<role>
  moved:    <what actually changed on disk since yesterday — a number or a filename>
  blocked:  <what is stopping it, and who owns the unblock>
  needs:    <one specific thing, or "nothing">
```

Order: **scout · analyst · art-director · copywriter · engineer · inspector · guard · closer · librarian**

**A role with nothing to report says "nothing moved" and stops.** No padding, no restating
yesterday, no "continuing to work on". If three roles in a row have nothing, chief names the
bottleneck out loud rather than letting the meeting drift.

## 3. Chief closes the meeting

- **THE ONE THING** — the single next action for the studio today
- **ACTIONS** — assigned, with an owner and a due date. Never "someone should".
- **NEEDS VICTOR** — approvals and decisions only. If nothing, say nothing.
- **AT RISK** — commitments slipping, with how long they have slipped

## 4. Write it down

Append to `memory/chief/meetings/<YYYY-MM-DD>.md`:

```markdown
# Standup — <date>
## Round
<role>: moved … | blocked … | needs …
## The one thing
## Actions
| id | owner | action | due |
## Needs Victor
## At risk
```

Then register each action:

```bash
python3 memory/action.py add --owner engineer --due 2026-09-04 "Build the Rancho Loco demo"
```

## Rules for the room

- **No role self-starts work in a standup.** Chief assigns; roles execute after.
- **No decision without an owner and a date.** "We should look at that" is not a decision.
- **Disagreement is raised here, not afterwards.** If inspector thinks a design brief is wrong,
  the standup is where that gets said.
- **Nothing is sent to anyone but Victor as a result of a standup.** Drafts and queues only.
- Keep the whole meeting under 400 words written. If it is longer, chief let it drift.
