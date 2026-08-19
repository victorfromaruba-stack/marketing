# What Victor needs to do next

Three inputs are blocking the machine. Nothing else is.

---

## 1. Google Places API key — 10 minutes, unlocks the full prospect sweep

Without this the prospector cannot run, and the 19-row starter list is all you have.

1. Go to **console.cloud.google.com** → sign in with `victor@arubawebstudio.com`
2. Top bar → **Select a project** → **New Project** → name it `aruba-prospector` → Create
3. Left menu → **APIs & Services** → **Library** → search **"Places API (New)"** → **Enable**
4. Left menu → **Credentials** → **+ Create Credentials** → **API key** → copy it
5. Click the new key → **API restrictions** → *Restrict key* → tick **Places API (New)** → Save
6. You will be asked to enable **Billing**. You must add a card, but there is a recurring free
   monthly credit that covers a sweep of this size. Set a budget alert at $10 so nothing surprises you:
   **Billing → Budgets & alerts → Create budget → $10 → email me at 50% / 90% / 100%**

Then:

```bash
export GOOGLE_PLACES_KEY="paste-it-here"
python3 prospector/find_prospects.py --dry-run          # shows the plan, calls nothing
python3 prospector/find_prospects.py --category Tours   # ~117 calls, sanity check the output
python3 prospector/find_prospects.py                    # full island sweep
```

**Always run `--dry-run` first.** It prints the query count so you know the cost before you spend.

---

## 2. ~~Your real phone number~~ — DONE

**+297 747 7794**, wired into the cold-email signature, the proposal PDF and the Gmail
signature block.

Convention for client demos: display as `+297 XXX XXXX`, but `wa.me/` links take digits only
with the country code and no plus — e.g. `wa.me/2977477794`.

---

## 3. A Formspree form ID — 3 minutes

Every demo needs a working contact form. A form that goes nowhere is worse than no form.

1. **formspree.io** → sign up free (50 submissions/month on the free plan)
2. **+ New Form** → name it `Aruba Web Studio demos` → set the destination to your email
3. Copy the endpoint — it looks like `https://formspree.io/f/xayzqwer`
4. Paste that into demos in place of the placeholder

The QA gate hard-fails on `REPLACE_WITH_*`, so a demo cannot deploy with an unwired form.

---

## Optional but worth it

- **Outreach domain** — `getarubawebstudio.com` is available. Add it to your existing Workspace
  as a **domain alias** (free, no second licence) and send cold email from there, so a spam flag
  can never take down `victor@arubawebstudio.com`.
- **Warm-up tool** — Instantly, Mailreach or Warmbox, ~$30–50/month. Start it today; the 14–21 day
  clock runs whether or not you have prospects ready.

---

## What is already done

- Domain registered, Google Workspace live
- MX, DKIM, SPF, DMARC all configured
- The build machine: `CLAUDE.md`, `/intake` and `/demo` commands, QA gate (26 checks),
  Cloudflare deploy script, PDF proposal generator, email generator with the demo-ready gate
- Reference demo at the quality bar, passing QA clean
- Starter list of 19 real Aruba tour operators in `prospector/starter-prospects.csv`

## The order to work in

1. Warm-up tool running (today — it is the long pole)
2. Places API key → full sweep → real prospect list with the no-website percentage
3. `/intake` the 10 best Tier-A targets
4. `/demo` each one, QA clean, deploy
5. `make_proposal.mjs` + `make_email.py`
6. Send 20–25/day, Tue–Thu, 08:00–10:00. Reply within 2 hours.
