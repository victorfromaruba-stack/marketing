# Aruba Web Studio: Build Report and Handoff

Everything a fresh Claude Code session needs to run this business. Read this first, then
`CLAUDE.md`. Last updated 19 August 2026.

---

## 1. Mission

**Victor Rosario**, based in Aruba, sells websites to local small businesses that have none.
Trading as **Aruba Web Studio**, `arubawebstudio.com`, +297 747 7794.

This repo is the business. A ten role agent studio finds prospects, researches them, builds a
demo site from their own logo and photographs, gates it through QA and security, deploys it,
drafts the outreach, then **stops and waits for Victor to approve the send**.

**Positioning:** top tier craft at an entry level price. Cheap because the process is efficient,
never because the output is thin.

---

## 2. The market, with sources

| Fact | Figure |
|---|---|
| Population | 108,164 |
| GDP per capita | ~US$42,862 |
| Stopover visitors 2025 | **1,515,102**, up 6.6% |
| Average spend per visitor | **US$1,949** |
| US share of visitors | ~75% |
| Internet penetration | 97.2% |
| Facebook reach | 99.1% of adults |
| Tourism share of GNP | ~70% |
| Businesses worth pitching | **~1,500 to 2,500 total** |
| Cheapest visible local competitor | $750 (JunTech) |
| Cold email reply benchmark | 3.4% |

**The strategic fact that shapes everything:** the addressable market is small enough that there
is no second list. One careless email burns a prospect permanently, and on an island of 108,000
owners talk to each other. That is why the machine is demo first and approval gated.

**The pitch:** Facebook is rented, Google is where the tourists are. For tour operators and
guesthouses the sharper version is the commission argument, because they already pay Viator,
Booking.com or Airbnb 15 to 25% on every booking.

---

## 3. Current state

| | Status |
|---|---|
| Domain and Google Workspace | Live. MX, DKIM, SPF, DMARC all verified in DNS |
| Phone number | Done. +297 747 7794, wired into email, PDF and Gmail signature |
| Logo and brand kit | Done. `brand/`, traced from Victor's own artwork |
| The machine | Built and tested end to end |
| Reference demo | `sites/sunrise-snorkel/`, passes 30 QA checks clean |
| Prospect list | 19 hand researched names only |
| **Prospects contacted** | **0** |
| **Outcomes recorded** | **0.** Ledger empty, playbook empty |

Readiness: **21 of 25**. Run `./setup.sh --doctor` for the live count.

### The three remaining blockers, all owned by Victor

1. **Google Places API key.** Without it the prospector cannot sweep and only 19 names exist.
   `console.cloud.google.com` then enable Places API (New), create a key, put it in `.env`.
2. **Formspree form ID.** QA hard fails any demo with an unwired form. `formspree.io`, new form,
   id into `.env`.
3. **Wrangler not installed.** Cannot publish demos.
   `npm i -g wrangler && wrangler login && wrangler pages project create aruba-demos --production-branch main`,
   then add `demo.arubawebstudio.com` as a custom domain in the Cloudflare dashboard.

Also outstanding but not code blocking: **the mailbox warm up has not started.** That clock runs
14 to 21 days and cannot be recovered. It should start today.

**The bottleneck is not tooling.** Everything upstream of sending is built and nothing is moving
through it. Say that plainly if Victor proposes more infrastructure before the first send.

---

## 4. Decisions already made. Do not relitigate.

| Decision | Value |
|---|---|
| Build price | **$650** |
| Monthly | **$35** |
| First year bundle | **$995** all in, push this |
| Launch offer | $450 build, first 10 clients only, in exchange for a testimonial |
| Never discount below | $450 |
| Deposit | 50% before work starts |
| Google Business Profile setup, standalone | $95, the foot in the door when they say no |
| Extra work beyond the monthly allowance | $45/hour, quoted before starting |
| Monthly includes | hosting, SSL, backups, security updates, uptime monitoring, one content change per month up to 30 minutes |
| Outreach | Email, ~25/day, Tuesday to Thursday, 08:00 to 10:00 Aruba time, **all English** |
| Demo hosting | Cloudflare Pages at `demo.arubawebstudio.com/<slug>`. Never GitHub, never the VPS |
| Sending domain | Should be **separate** from the main domain, added as a free Workspace alias |
| Server | Hetzner box for OpenClaw. **Not** the Minecraft box. Build a clean one |

### The pricing ladder, always show three

| | Starter | Business | Pro |
|---|---|---|---|
| Build | $650 | $950 | $1,600 |
| Monthly | $35 | $60 | $110 |
| Updates included | 1/month | 3/month | unlimited |
| Booking system | no | yes | yes |
| Online payments | no | no | yes |

---

## 5. The rules that must never be broken

1. **No dashes as sentence breaks.** Victor's rule number one. Never an em dash or en dash
   joining clauses, in site copy, emails, subject lines, alt text or titles. Use a full stop,
   comma or colon. Hyphens inside compound words are fine and number ranges like 7:00 to 10:00
   are fine. **QA fails the build on this.**
2. **Stillness.** Nothing on a client site animates or moves on scroll. No Ken Burns zoom, no
   marquee, no scroll reveals, no parallax, no offset cards, no `scroll-behavior: smooth`. Hover
   may change colour and shadow, **never position**. QA fails on looping animations and on
   scroll driven transforms.
3. **Their logo and their photographs, or no build.** No stock imagery, no hotlinked assets. If
   the logo is missing the line stops. QA fails on a missing logo file, on a logo absent from the
   nav, on any stock host URL and on any cross domain image.
4. **The approval line.** The team works autonomously right up to sending. Anything that reaches
   a human who is not Victor, meaning an email, a WhatsApp, a price, a date or a payment, waits
   for his explicit yes. Draft it, queue it, say it is ready. **Never send.**
5. **Evidence threshold.** A rule enters `memory/playbook.md` only at **5 or more observations
   beating baseline**, with the numbers written inline. Everything less certain stays labelled
   `[assumed]`. Say so when working from hypothesis rather than evidence.
6. **Invent nothing.** No made up price, opening hour, review, client or result. Empty means the
   section is omitted, which is the correct outcome.
7. **Gates stop the line.** They do not warn and continue.
8. **The client's own mark is the favicon** on their demo, never Aruba Web Studio's.

---

## 6. The team

Ten roles, each a subagent in `.claude/agents/`. Names in `office/staff.json`.

| Role | Person | Owns | Must not |
|---|---|---|---|
| chief | Sharina | Priorities, dispatch, commitments, the honest read | Agree because Victor is Victor |
| scout | Rendell | Finding and ranking prospects | Judge design or write copy |
| analyst | Kimberly | Research into a brief, plus the hook | Invent any fact |
| art-director | Xiomara | Palette, type, the signature moment | Write code |
| copywriter | Dario | Every word, in voice | Invent claims or reviews |
| engineer | Jeandro | Building to brief | Redesign silently |
| inspector | Farah | Adversarial QA, pass or block | Pass with minor issues |
| guard | Orlando | Security gate | Be skipped, ever |
| closer | Marisol | Outreach, replies, meetings | Send before the demo is live |
| librarian | Elvin | Outcomes into proven rules | Promote under 5 observations |

**chief is the right hand.** One next action per briefing, never a list. Explicitly tasked with
naming avoidance, killing Victor's ideas when the numbers say so, and never flattering. If Victor
overrules chief, that gets recorded with the date and his reason, then chief moves on.

### The pipeline

```
scout > analyst > art-director > copywriter > engineer > inspector > guard > closer
                                     ^
                                 librarian reads every outcome and writes the playbook
```

### The rhythm

| When | Meeting | Output |
|---|---|---|
| 08:30 daily | `/standup`, three lines per role | The one thing, plus assigned actions |
| Monday 09:00 | `/review`, librarian presents numbers | Rules promoted or retired, next week's focus |

No decision without an owner and a date.

---

## 7. Repo map

```
HANDOFF.md             This report
CLAUDE.md              The constitution. Prime Directive, WOW STANDARD, Stillness, hard rules
ORG.md / ORG.html      Org chart and standing rules
setup.sh               A to Z install, self test, readiness scoreboard. --doctor to check only
factory.sh             The deterministic half of the production line
.claude/agents/*.md    One brief per role, 10 files
.claude/commands/*.md  /chief /scout /analyst ... /factory /standup /review, 15 files
brand/                 Logo kit, brand.md with pricing and voice, email-signature.html
prospector/
  find_prospects.py    Google Places sweep into prospects.csv
  fetch_assets.py      Their logo, photos, and real brand palette extracted from those images
  starter-prospects.csv  19 real Aruba operators, 13 of them Tier A
intake/<slug>.json     The brief everything is built from. The identity block is the important part
build/decisions/       Art director's doc, written BEFORE any code
sites/<slug>/          The built demo. sunrise-snorkel is the quality reference
qa/check.mjs           30 automated checks: correctness, craft, client assets, stillness, dashes
qa/checklist.md        The manual pass: taste, truth, does it look like them
deploy/deploy.sh       QA gate, then Cloudflare Pages, then a scrub for GitHub references
outreach/              PDF proposal generator, email generator with the demo ready gate
memory/                playbook, patterns, ledger, chief's state, commitments, actions, meetings
office/                build_office.py renders the isometric floor plan from live repo state
openclaw/              Hardened Hetzner deploy, SOUL, AGENTS, HEARTBEAT, TOOLS, MEMORY, skills
```

---

## 8. Commands

```bash
./setup.sh                       # from nothing. installs, self tests, scoreboard
./setup.sh --doctor              # health check, changes nothing

/chief                           # the briefing. one next action, what needs Victor, what is at risk
/standup                         # 08:30 daily
/review                          # Mondays

python3 prospector/find_prospects.py --dry-run          # plan and call count, spends nothing
python3 prospector/find_prospects.py --category Tours   # one sector first
python3 prospector/find_prospects.py                    # full island sweep

/analyst <slug>                  # research into intake JSON
python3 prospector/fetch_assets.py <slug> --place-id <id>

/factory <slug>                  # the whole line in Claude Code, gated
./factory.sh <slug> --place-id <id>   # the scriptable half

node qa/check.mjs <slug> --open
./deploy/deploy.sh <slug>
node outreach/make_proposal.mjs <slug>
python3 outreach/make_email.py <slug>

python3 memory/record.py <slug> --outcome replied
python3 memory/distill.py
python3 memory/action.py list
python3 office/build_office.py
```

---

## 9. The production line, with its gates

`/factory <slug>` runs ten steps. Each gate stops the line rather than warning past it.

| Step | Gate |
|---|---|
| 1 analyst | No owner name or no real hook stops it |
| 2 assets | **No client logo stops it** |
| 3 art-director | No named signature moment stops it |
| 4 copywriter | Any claim that does not trace to the intake stops it |
| 5 engineer | Brief cannot be built as written stops it |
| 6 inspector | Any QA failure, or a failed competitor or truth test, stops it |
| 7 guard | A secret, a third party script or a leaked path stops it |
| 8 deploy | Cloudflare Pages, GitHub scrub |
| 9 closer | Proposal PDF and drafted email |
| 10 queue | Appears in Victor's approval tray. **Never sends** |

---

## 10. Setup from zero

```bash
./setup.sh
```

Then the three blockers in section 3. After that:

```bash
export GOOGLE_PLACES_KEY="..."          # or put it in .env
python3 prospector/find_prospects.py --dry-run
python3 prospector/find_prospects.py --category Tours
```

### Running always on, OpenClaw

OpenClaw skills use Claude Code conventions and its memory is plain Markdown, so these briefs and
the whole `memory/` folder port across unchanged.

```bash
export SSH_PUBKEY="$(cat ~/.ssh/id_ed25519.pub)"
bash openclaw/deploy-hetzner.sh          # on a FRESH box, not the Minecraft one
```

That hardens the box with a non root user, key only SSH, ufw, fail2ban, unattended security
updates and 2GB swap, installs Node 22 and the Chromium dependencies the QA gate needs, and
installs OpenClaw as a non root user. **Port 18789 stays closed.** Reach the control plane over
an SSH tunnel only:

```bash
ssh -L 18789:localhost:18789 studio@<ip>
```

Two constraints. The 4GB box is exactly OpenClaw's recommended minimum for browser automation, so
do not run the QA gate and a large model call at the same time. And demos stay on Cloudflare
Pages, because moving them to the server would be slower for a visitor loading from Boston and
would put the $35/month margin on a machine that needs maintaining.

---

## 11. Sales assets already written

- **Five sector specific cold email templates**, all under 80 words: tours and watersports,
  guesthouses, restaurants, trades, professional services.
- **A four touch follow up sequence** at days 4, 8, 14 and 21. The day 21 break up email
  routinely outperforms everything except the first touch.
- **Objection handling** in `.claude/agents/closer.md`, covering price, "Facebook works fine",
  "I already have a site", "send me more info" and "remove me".
- **A two page proposal PDF**, generated per business, carrying the logo, the hook, the demo URL
  and the pricing ladder.

Deliverability rules that matter. Warm the mailbox 14 to 21 days. Stay at 20 to 30 sends per day.
Stop immediately if bounces exceed 3%. Link the PDF on a cold first touch, never attach it,
because attachments are a spam signal. Attach freely once they have replied.

---

## 12. What to do next, in order

1. Clear the three blockers in section 3. Chief chases these at every standup.
2. **Start the mailbox warm up today.** It is the long pole and the clock cannot be recovered.
3. Sweep prospects, then `/analyst` the 13 Tier A operators in the starter list.
4. `/factory` the best 10. Deploy the demos.
5. Send 25 a day. **Record every outcome, including the failures.**
6. `/review` on Monday. The playbook fills from there and the studio starts compounding.

**Acceptance criteria for "this is working":** 30 or more prospects researched, 10 or more demos
live, 100 or more emails sent, and a ledger with real outcomes in it. Until step 5 happens
nothing in this system learns anything.

---

## 13. Known gotchas

- **Gmail strips data URI images from signatures.** Upload the logo through Gmail's Insert image
  button instead. `brand/email-signature.html` explains it.
- **Google Workspace does not add SPF or DMARC.** It never does. Those are deliberate manual
  steps and they are the two records that decide cold email deliverability.
- **The QA gate needs Playwright.** `npm i -g playwright`. Without it every build fails on the
  gate rather than on its own merits.
- **A number range like 7:00 to 10:00 is not a dash violation.** The check allows digit to digit
  ranges and catches only dashes joining words or preceding a price.
- **`.env` must stay gitignored.** Guard blocks the deploy if a secret appears in a tracked file.
- **The reference demo keeps Sunrise Snorkel's fictional phone number.** That is the client's
  number in a sample, not Victor's, and it should stay that way.
