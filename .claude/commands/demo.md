---
description: Build a complete, QA-passed demo site for one prospect from their intake JSON
---

Build a demo site for: **$ARGUMENTS**

Follow `CLAUDE.md` exactly. It is the spec, not background reading. Re-read it now if it is
not already in context.

## Step 1 — Absorb the business

Read `intake/$ARGUMENTS.json` completely. Read it twice.

If the `identity` block is thin or generic, **stop and tell Victor what is missing** rather
than guessing. A demo built on a vague identity brief will look like a template and will
lose the prospect. Missing identity information is a blocker, not something to work around.

If `identity.photos` is empty, say so. A site with no real photos of their place is a
fundamentally weaker demo — flag it before building, so Victor can pull images from their
Facebook first.

## Step 1b — Harvest their real assets. NO LOGO = STOP.

```bash
python3 prospector/fetch_assets.py $ARGUMENTS --place-id <their_place_id>
python3 prospector/fetch_assets.py $ARGUMENTS --from-site https://theirsite.com   # if they have one
python3 prospector/fetch_assets.py $ARGUMENTS --manual                            # photos Victor saved
```

This pulls their photos, finds their logo, optimises everything, and extracts their real brand
palette out of their own material into `intake/$ARGUMENTS.json`.

**If it reports `logo: MISSING`, stop and tell Victor.** Do not build around a text wordmark.
The logo is the single thing that makes an owner recognise the page as theirs, and a demo
without it looks like every template they have already ignored. He can pull it from their
Facebook profile picture, their signage, or their van, and drop it in
`intake/assets/$ARGUMENTS/logo.png`.

If it reports no photos, say so too — a demo with no pictures of their actual place is weak.

## Step 2 — Write the decisions BEFORE any code

Create `build/decisions/$ARGUMENTS.md`:

```markdown
# <Business Name> — build decisions

## What this business feels like
<2-3 sentences. Written as if describing the place to someone who has never been.>

## Palette
| Colour | Hex | Where it came from |
|---|---|---|
<Every colour traced to something real — their sign, their logo, their food, their boat.>

## Typography
Display: <face> — because <specific reason tied to their signage/logo>
Body: <face>

## Base template
<booking | hospitality | services> — changing <what, specifically>

## The hero
The single thing this business wants a stranger to see: <...>

## Primary conversion action
<book | call | whatsapp | reserve | menu> — because <...>

## What I am deliberately NOT including
<Sections omitted because the intake lacks real information for them.>
```

**Do not skip this.** If you cannot explain why this palette suits this business, you have not
looked at their photos properly. Go back and look.

## Step 3 — Build

Create `sites/$ARGUMENTS/index.html` — one self-contained file, CSS in a `<style>` block.

Use `sites/sunrise-snorkel/index.html` as the **quality reference**, not as a template to
fill in. Match its standard of craft. Do not match its layout, palette, or structure unless
that genuinely suits this business too.

Non-negotiables from CLAUDE.md, restated because they are the ones most often missed:

- Every fact traces to the intake JSON. **Invent nothing.**
- **Their logo in the nav and the footer.** Compact lockup in the nav — a logo with a strapline
  becomes unreadable below ~40px, so use the compact variant there and the full one in the footer.
- **Their photos only.** Palette from `identity.colors` — do not "improve" their brand colours.
- Write real alt text after actually looking at each harvested image.
- If `img/ATTRIBUTION.txt` exists, those Google Places credits must appear in the footer.
- No section without real content. Omit rather than pad.
- Their photos only. Never stock imagery of somewhere else.
- Click-to-call and click-to-WhatsApp above the fold, real numbers.
- Working form with a real Formspree action ID.
- LocalBusiness JSON-LD with real NAP.
- One `<h1>`. Sequential headings. Alt text on every image.
- 375px first. Tap targets ≥ 44px.
- No GitHub reference anywhere. No Aruba Web Studio branding anywhere.

## Step 4 — Optimise assets

Every image: WebP or JPEG, max 1600px wide, quality 82, explicit `width`/`height`,
`loading="lazy"` below the fold. Target: full page under 900KB.

## Step 5 — QA gate

```bash
node qa/check.mjs $ARGUMENTS --open
```

Zero failures required. Fix and re-run until clean. Then **look at the mobile screenshot**
in `qa/screenshots/` with your own eyes and work through `qa/checklist.md`.

## Step 6 — Report back

Tell Victor:

1. The design decision in one sentence — what you matched and why
2. What you omitted and what information would fill those gaps
3. QA result
4. The exact hook line to use in the email (from `the_hook` in the intake), phrased as one
   concrete, verifiable sentence about what this business is losing right now

Then stop. Do not deploy and do not draft the email unless asked.
