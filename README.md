# Aruba Web Studio — The Machine

Three parts. Each feeds the next. Nothing is emailed until the demo is live.

```
   PROSPECTOR ──────► INTAKE ──────► DEMO ──────► QA ──────► DEPLOY ──────► EMAIL
   Google Places      research       Claude Code   gate       Cloudflare      + PDF
   every business     their look     builds it     blocks     your domain     personal
   on the island      & their hook   properly      mistakes   no GitHub       to them
```

---

## Start here — A to Z

```bash
./setup.sh            # installs everything missing, then reports readiness
./setup.sh --doctor   # report only, changes nothing — run this any time
```

It checks runtimes, installs the Python and Node packages, creates `.env`, self-tests every
component (office, ledger, actions, QA gate, prospector), and finishes with a scoreboard:

```
  21 of 25 ready

  Blocking:
    · wrangler — cannot publish demos
    · GOOGLE_PLACES_KEY empty — prospector cannot run

  Do these, in order:
    1. npm i -g wrangler && wrangler login && …
    2. console.cloud.google.com → enable Places API (New) → …
```

When it says everything is wired, run the line:

```bash
python3 prospector/find_prospects.py --category Tours
/analyst <slug>
./factory.sh <slug> --place-id <id>
```

## Setup — the manual detail

```bash
npm i -g wrangler playwright
pip install requests

# domains
#   arubawebstudio.com   — your site + email
#   arubawebstudio.co    — cold outreach only, NEVER the main one

# demo hosting
wrangler login
wrangler pages project create aruba-demos --production-branch main
#   then in Cloudflare: Pages -> aruba-demos -> Custom domains -> demo.arubawebstudio.com
```

**Do you need Google Workspace? Yes — the $7/month is the cheapest thing in this whole plan.**
You cannot reliably cold-email from a free Gmail address: you can't set DKIM on your own
domain, `victor@gmail.com` looks like a hobbyist to a business owner, and Google issues
**permanent 550 rejections** for unauthenticated bulk mail as of November 2025. $7/month buys
you `victor@arubawebstudio.com`, working SPF/DKIM/DMARC, and inbox placement. One client pays
for eight years of it. Buy it on the outreach domain and warm it for 14–21 days before sending.

---

## The machine — one command

```bash
/factory <slug>          # in Claude Code: runs the whole line, agent by agent, with gates
./factory.sh <slug> --place-id <id>   # the scriptable half: assets, QA, guard, deploy, proposal, email
```

Ten steps: analyst → assets → art-director → copywriter → engineer → inspector → guard →
deploy → closer → queue. **Every gate stops the line rather than warning past it:**

| Gate | Stops on |
|---|---|
| assets | no client logo |
| art-director | no named signature moment |
| copywriter | a claim that does not trace to the intake |
| engineer | brief cannot be built as written |
| inspector | any QA failure, or a failed competitor/truth test |
| guard | a secret, a third-party script, a leaked path |

It ends by queuing the demo in Victor's approval tray. **It never sends.**

## Daily loop

```bash
# 1. Build the list (once, then top up monthly)
export GOOGLE_PLACES_KEY="..."
python3 prospector/find_prospects.py --dry-run          # see the plan + call count first
python3 prospector/find_prospects.py --category Tours   # start with one sector to sanity-check
python3 prospector/find_prospects.py                    # full sweep
#   -> prospector/prospects.csv, sorted: no-website + Tier A + most-reviewed first
#   -> prints your Island Audit number: "X% of Aruban businesses have no website"

# 2. Research one prospect (in Claude Code)
/intake sunrise-snorkel
#   reads the CSV row, fetches their Facebook/Instagram/TripAdvisor,
#   writes intake/sunrise-snorkel.json — especially the `identity` block

# 2b. Harvest their logo + photos + real palette
python3 prospector/fetch_assets.py sunrise-snorkel --place-id ChIJ...
#   -> sites/<slug>/img/  their photos, their logo, optimised
#   -> intake/<slug>.json  palette extracted from their own logo and photos
#   NO LOGO = do not build. Get it from their Facebook profile picture first.

# 3. Build the demo (in Claude Code)
/demo sunrise-snorkel
#   writes build/decisions/<slug>.md FIRST, then sites/<slug>/index.html

# 4. QA gate — must be clean
node qa/check.mjs sunrise-snorkel --open
#   then eyeball qa/screenshots/ and work through qa/checklist.md

# 5. Deploy
./deploy/deploy.sh sunrise-snorkel
#   -> https://demo.arubawebstudio.com/sunrise-snorkel   (no GitHub anywhere)

# 6. Proposal PDF
node outreach/make_proposal.mjs sunrise-snorkel

# 7. Email
python3 outreach/make_email.py sunrise-snorkel
python3 outreach/make_email.py --batch 25       # everything demo-ready
python3 outreach/make_email.py <slug> --touch 3 # follow-ups
```

Steps 2–6 take about 90 minutes per prospect at first, ~35 once your templates settle.
**Six stunning demos a week beats sixty generic emails.**

The QA gate checks craft, not just correctness: if the hero type is timid, there is no scroll
choreography, no grain, no custom easing, no hover states, or animation isn't switchable off,
the build fails and won't deploy.

---

## The rules the code enforces for you

| Rule | Enforced by |
|---|---|
| No email without a live, QA-passed demo | `make_email.py` refuses and tells you what's missing |
| No deploy with a failing QA check | `deploy.sh` runs the gate first and aborts |
| No GitHub reference in anything shipped | banned in `qa/check.mjs`, re-checked in `deploy.sh` |
| No placeholder text, fake phone numbers, lorem ipsum | banned list in `qa/check.mjs` |
| No unwired contact form | `REPLACE_WITH_*` is a hard failure |
| No generic greeting | `make_email.py` blocks on a missing `owner_name` |
| **No demo without the client's logo** | `qa/check.mjs` fails on a missing logo file or a logo absent from the nav |
| **No stock photography, no hotlinked images** | `qa/check.mjs` fails on stock-host URLs and cross-domain images |
| Google Places photo attribution | `qa/check.mjs` fails if `ATTRIBUTION.txt` credits aren't on the page |
| Emails stay short | word count printed, warns over 90 |

---

## The organisation

Nine roles, each a Claude Code subagent with its own brief and a defined handoff. Full chart
and standing rules in **`ORG.md`**.

```
scout -> analyst -> art-director -> copywriter -> engineer -> inspector -> guard -> closer
                                        |
                                   librarian
                    (reads every outcome, writes memory/playbook.md,
                     which every agent reads before it starts)
```

| | |
|---|---|
| `/scout <query>` | rank prospects worth pitching |
| `/analyst <slug>` | research → intake brief + the hook |
| `/art-director <slug>` | palette, type, signature moment → decisions doc |
| `/copywriter <slug>` | every word, in voice |
| `/engineer <slug>` | build it |
| `/inspector <slug>` | adversarial QA — blocks or passes |
| `/guard <slug>` | security gate — secrets, third-party code, headers |
| `/closer <slug>` | outreach and replies |
| `/librarian` | weekly: turn outcomes into proven rules |

**How it actually improves.** Every outcome goes into `memory/ledger/outcomes.jsonl`.
`memory/distill.py` computes reply and win rates by sector, hook, subject line and palette.
The librarian promotes a pattern into `memory/playbook.md` only at **≥5 observations beating
baseline**, with the numbers inline — and retires rules that stop working. Every agent reads
the playbook before it starts.

That is the whole mechanism. It is not magic, and it does nothing until real emails have gone
out and real replies have come back.

## Running it on the server (OpenClaw)

The nine roles port to OpenClaw as-is — its skills use Claude Code conventions (`SKILL.md` with
YAML frontmatter) and its memory is plain Markdown, which is exactly what `memory/` already is.

```bash
# on a FRESH Hetzner box — not the Minecraft one
export SSH_PUBKEY="$(cat ~/.ssh/id_ed25519.pub)"
bash openclaw/deploy-hetzner.sh
```

That hardens the box (non-root user, key-only SSH, ufw, fail2ban, unattended security updates,
2GB swap), installs Node 22 and the Chromium deps the QA gate needs, and installs OpenClaw as a
non-root user. **Port 18789 is deliberately closed** — reach the control plane over an SSH
tunnel, never the open internet.

| File | Purpose |
|---|---|
| `openclaw/SOUL.md` | Who the studio is and how it speaks |
| `openclaw/AGENTS.md` | The nine roles + **the approval line** |
| `openclaw/HEARTBEAT.md` | What runs unattended, hour by hour |
| `openclaw/TOOLS.md` | The scripts and their constraints |
| `openclaw/MEMORY.md` | Points at `memory/` |
| `openclaw/skills/` | The nine briefs as OpenClaw skills |
| `openclaw/openclaw.json.example` | Config: model routing, WhatsApp allowlist, approval gates |

### The approval line

The team works autonomously right up to the point anything reaches another human.

**Autonomous:** prospecting, research, asset harvesting, design, copy, building, QA, security,
deploying to the *demo* subdomain, recording outcomes, distilling memory, drafting emails,
messaging Victor.

**Needs Victor's explicit yes, every time:** sending any email or message to anyone who is not
Victor, publishing to a client's domain, quoting a price, committing to a date, spending money.

A demo built badly costs one prospect. A message sent badly under Victor's name costs his
reputation on an island where everyone knows everyone.

## The office

```bash
python3 office/build_office.py     # -> office/index.html
```

A live status board read off disk: which desk has work waiting, every prospect at the stage its
files say it is at, what is queued for approval, what is blocked, and what the studio has
actually proven versus assumed. Nothing in it is decorative — every number comes from a file.

## Files

| Path | What it is |
|---|---|
| `CLAUDE.md` | **The constitution.** The Prime Directive (make it look like *them*), **THE WOW STANDARD** (seven things every demo must have), and the hard rules. Claude Code reads this every build. |
| `brand/brand.md` | Positioning, colours, voice, and the full pricing ladder with the reasoning |
| `.claude/commands/intake.md` | `/intake <slug>` — research a prospect into a JSON brief |
| `.claude/commands/demo.md` | `/demo <slug>` — build the site |
| `prospector/find_prospects.py` | Google Places sweep → `prospects.csv` |
| `prospector/fetch_assets.py` | **Their logo, their photos, their real palette.** Places Photos API, their existing site, or a manual drop folder. Extracts brand colours from the images themselves. |
| `prospector/starter-prospects.csv` | 19 real Aruba tour operators to work from before the API key is live |
| `intake/_TEMPLATE.json` | The brief shape. The `identity` block is the one that matters. |
| `sites/sunrise-snorkel/` | **Reference build — the floor, not the ceiling.** Match this level of craft, not its layout. |
| `qa/check.mjs` | 26 automated checks — correctness *and* craft (display scale, reveal choreography, grain, easing, hover states, reduced-motion, no-JS safety) |
| `qa/checklist.md` | The manual pass — taste, truth, "does it look like them" |
| `deploy/deploy.sh` | Cloudflare Pages, your domain, GitHub scrub |
| `outreach/make_proposal.mjs` | Per-business 2-page PDF proposal |
| `outreach/make_email.py` | Personalised email + follow-up sequence, with the readiness gate |
| `ORG.md` | The nine roles, the pipeline, the standing rules |
| `.claude/agents/*.md` | One brief per role |
| `memory/` | Playbook, patterns, outcome ledger, post-mortems |
| `memory/record.py` | Log one outcome — run after every result |
| `memory/distill.py` | What the evidence actually says; flags promotable patterns |
| `.gitignore` / `.env.example` | Secrets and client material stay out of the repo |
| `openclaw/deploy-hetzner.sh` | Hardened server build: SSH keys only, ufw, fail2ban, swap, Node 22, Chromium deps |
| `office/build_office.py` | Regenerates the live office dashboard from repo state |

---

## Pricing (full reasoning in `brand/brand.md`)

|  | Starter | Business | Pro |
|---|---|---|---|
| Build | **$650** | $950 | $1,600 |
| Monthly | **$35** | $60 | $110 |

- **First year all-in: $995** — push this, it's more cash up front
- **Annual prepay:** $350/yr instead of $35/mo
- **Launch offer, first 10 clients only:** $450 + $35/mo for a testimonial and a named reference
- **Google Business Profile setup, standalone: $95** — your foot in the door when they say no
- Never discount below $450. 50% deposit before work starts. Always show three tiers.

---

## Why the demo-first rule is not negotiable

Aruba has roughly 1,500–2,500 businesses worth pitching. That is the entire universe — there is
no second list. A generic email to a prospect burns them permanently, and on an island of
108,000 people they tell each other.

So the machine is built to make the *first* touch count: a real, live, beautiful site with
their name on it. That converts several times better than any email, and it is the only
approach that respects how small this market actually is.
