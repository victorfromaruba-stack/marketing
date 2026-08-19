---
description: Turn a raw prospect row + their social links into a complete intake JSON
---

Build the intake file for: **$ARGUMENTS**

You are doing the research step that makes a good demo possible. A thin intake produces a
generic site, which loses the prospect permanently — there is no second email.

1. Read `intake/_TEMPLATE.json` for the shape.
2. Pull everything available about this business from `prospector/prospects.csv`.
3. Use WebFetch on their Facebook page, Instagram, TripAdvisor listing and any existing site.
4. Fill in `intake/<slug>.json`.

**The `identity` block is the part that matters.** Do not write "modern and clean" — that is
not an observation, it is a default. Look at their actual photographs and describe what is
really there: the colour of their building, whether their signage is hand-painted or printed,
whether their photos are bright and busy or dark and moody, whether their captions use
exclamation marks, whether they post food or people or the view.

Rules:

- **Never invent a price, an opening hour, or a review.** Leave the field empty. Empty means
  "omit this section from the site", which is the correct outcome.
- Copy their business name character for character, including Papiamento or Dutch spelling.
- Quote reviews exactly. Never paraphrase, never tidy up the grammar.
- Record where each photo came from, in `source`.

Then harvest their assets:

```bash
python3 prospector/fetch_assets.py <slug> --place-id <place_id>
```

This fills in `identity.colors`, `identity.logo_file` and `identity.photos` from their own
material, so the build is working from real brand colours rather than your guess at them.

**Flag it loudly if the logo comes back missing** — Victor needs to grab it before any build starts.

Finish by listing, in your reply:
- what you could not find
- whether the logo was found, and if not, where Victor should look for it
- how many usable photos there are
- the single strongest hook for the email — the specific, verifiable thing this business is
  losing right now (a search they don't appear in, a commission they're paying, a menu Google
  cannot read)
