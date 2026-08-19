# Aruba Web Studio — Organisation

A nine-role studio. Every role is a Claude Code subagent with its own brief, its own slice of
memory, and a defined handoff. Nobody works from vibes; everybody reads before acting and
writes after.

```
                    ┌──────────────────────┐   ┌──────────────┐
                    │       VICTOR         │───│    CHIEF     │
                    │  owner · final call  │   │  right hand  │
                    └──────────┬───────────┘   └──────────────┘
                                     │
        ┌────────────────┬───────────┼───────────┬────────────────┐
        │                │           │           │                │
  ╔═════▼══════╗  ╔══════▼═════╗ ╔═══▼════╗ ╔════▼═════╗  ╔═══════▼══════╗
  ║INTELLIGENCE║  ║  CREATIVE  ║ ║PRODUCE ║ ║ SECURITY ║  ║   REVENUE    ║
  ╚═════╤══════╝  ╚══════╤═════╝ ╚═══╤════╝ ╚════╤═════╝  ╚═══════╤══════╝
        │                │           │           │                │
    ┌───┴───┐        ┌───┴────┐  ┌───┴───┐   ┌───┴───┐        ┌───┴───┐
    │ scout │        │  art-  │  │engineer│  │ guard │        │closer │
    │analyst│        │director│  │inspector│ └───────┘        └───────┘
    └───────┘        │copywriter│ └───────┘
                     └────────┘
                                     │
                          ┌──────────▼───────────┐
                          │      LIBRARIAN       │
                          │  reads every outcome │
                          │  writes the playbook │
                          └──────────────────────┘
```

## The pipeline

```
scout ─► analyst ─► art-director ─► copywriter ─► engineer ─► inspector ─► guard ─► closer
  │         │             │              │            │            │          │        │
  └─────────┴─────────────┴──────────────┴────────────┴────────────┴──────────┴────────┘
                                         │
                                    librarian
                        (reads outcomes, updates the playbook,
                         every agent reads the playbook first)
```

## The roles

| Agent | Owns | Hands off | Must not |
|---|---|---|---|
| **scout** | Finding and qualifying prospects | A ranked shortlist | Judge design or write copy |
| **analyst** | Deep research on one business → intake JSON + the hook | A complete brief | Invent any fact |
| **art-director** | Palette, type, layout, the signature moment | `decisions/<slug>.md` | Write code |
| **copywriter** | Every word on the site and in the email | Copy deck | Invent claims, prices or reviews |
| **engineer** | Building the site to the decisions + copy | A finished site | Change the design brief silently |
| **inspector** | QA gate + adversarial craft review | Pass or a defect list | Approve their own team's work loosely |
| **guard** | Secrets, dependencies, headers, client data | Security sign-off | Be skipped, ever |
| **closer** | Outreach, replies, objection handling, pricing | A booked meeting | Send before the demo is live |
| **librarian** | Memory: outcomes, patterns, the playbook | Promoted rules | Promote a rule on fewer than 5 data points |
| **chief** | Victor's right hand — priorities, dispatch, commitments, honest read | The one next action | Agree with Victor because he is Victor |

## The three properties you asked for, made concrete

### Never forgets
Everything lives on disk in `memory/`, in plain Markdown and JSONL. Every agent reads
`memory/playbook.md` before starting and writes what it learned when it finishes. Nothing
depends on a conversation staying open.

### Self-improving
`memory/ledger/outcomes.jsonl` records, for every prospect: the sector, the hook used, the
palette family, the subject line, and what actually happened — no reply, reply, meeting, won,
lost. `memory/distill.py` turns that into real reply rates by hook, by sector, by subject
pattern. The **librarian** promotes a pattern into `memory/playbook.md` only once it has at
least 5 observations and beats the baseline. Rules that stop working get demoted.

This is the only honest version of self-improvement: measured outcomes, a threshold, and a
written rule. It needs real sends to work — with no data flowing in, the loop has nothing to
learn from.

### Secure
**guard** runs before every deploy and blocks it on: any secret in the repo, any third-party
script, any hotlinked asset, any dependency added without reason, missing security headers,
or client data stored where it shouldn't be. Security is a gate, not a review.

## How Victor runs it

```bash
/chief                               # the briefing: one next action, what needs you, what is at risk
/scout          "tours in Noord"     # shortlist
/analyst        <slug>               # research → intake JSON
/art-director   <slug>               # design decisions
/copywriter     <slug>               # the words
/engineer       <slug>               # build it
/inspector      <slug>               # QA + craft review
/guard          <slug>               # security gate
/closer         <slug>               # email + PDF, or draft a reply
/librarian                           # weekly: distill outcomes into rules
```

Or `/demo <slug>` to run analyst → art-director → copywriter → engineer → inspector in one pass
for a straightforward prospect.

## Running always-on

The org runs under OpenClaw on a hardened Hetzner box — see `openclaw/`. Its skills use Claude
Code conventions, so these same briefs work in both places.

**The approval line** (`openclaw/AGENTS.md`) is the rule that matters most once the team is
autonomous: everything up to *sending* happens without asking; anything that reaches another
human being waits for Victor. Draft it, queue it, say it is ready. Never send.

`python3 office/build_office.py` renders the current state of the floor.

## From nothing to running

```bash
./setup.sh          # A to Z — installs, self-tests, and tells you exactly what is still missing
./setup.sh --doctor # health check, any time
```

## The machine

```bash
/factory <slug>     # the whole line, one command, gates enforced, ends queued for approval
```

## The rhythm

| When | Meeting | Chair | Output |
|---|---|---|---|
| 08:30 daily | **Standup** — every role, three lines each | chief | The one thing + assigned actions |
| Monday 09:00 | **Review** — the numbers, promote and retire | chief / librarian | Rules promoted, next week's focus |
| End of day | Close — record outcomes, tomorrow's one thing | chief | Ledger updated |

```bash
/standup        # daily
/review         # mondays
python3 memory/action.py list        # what is open
python3 memory/action.py overdue     # what has slipped
```

**No decision without an owner and a date.** "We should look at that" is not a decision, and
chief will not let it into the record as one.

## Standing rules

1. **The playbook outranks personal taste.** If `memory/playbook.md` says a pattern converts,
   use it — or write down why this business is the exception.
2. **No agent skips its read step.** Reading memory first is what makes the org compound.
3. **Evidence or silence.** No agent writes a rule from one observation.
4. **guard cannot be bypassed**, including by Victor in a hurry.
5. **Every outcome gets recorded**, including the failures. Especially the failures.
