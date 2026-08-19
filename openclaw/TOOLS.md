# Tools

Everything lives in the studio repo (`~/studio`). Prefer these over improvising.

## Prospecting
```bash
python3 prospector/find_prospects.py --dry-run            # plan + call count, spends nothing
python3 prospector/find_prospects.py --category Tours     # one sector
python3 prospector/fetch_assets.py <slug> --place-id <id> # their logo, photos, real palette
```

## Building
```bash
node qa/check.mjs <slug> --open      # 30 checks, mobile + desktop, screenshots
./deploy/deploy.sh <slug>            # QA gate → Cloudflare Pages → demo.arubawebstudio.com
```

## Outreach — drafts only, never send
```bash
node outreach/make_proposal.mjs <slug>
python3 outreach/make_email.py <slug>
python3 outreach/make_email.py <slug> --touch 3
```

## Memory
```bash
python3 memory/record.py <slug> --outcome replied
python3 memory/distill.py
```

## The office
```bash
python3 office/build_office.py       # regenerates office/index.html from live repo state
```

## Environment

`GOOGLE_PLACES_KEY`, `FORMSPREE_FORM_ID`, `CLOUDFLARE_API_TOKEN` — in `.env`, never committed.

## Constraints

- Demos are hosted on Cloudflare Pages, not this server. Do not move them.
- The QA gate needs Chromium. On a 4GB box do not run QA and a large model call at once.
- Port 18789 is firewalled. Reach the control plane over an SSH tunnel only.
