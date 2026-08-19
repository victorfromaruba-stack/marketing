#!/usr/bin/env python3
"""
Aruba Web Studio. Personalised outreach email from an intake file.

  python3 outreach/make_email.py <slug>              first touch
  python3 outreach/make_email.py <slug> --touch 3    follow-up
  python3 outreach/make_email.py --batch 25          next 25 demo-ready prospects

Writes outreach/queue/<slug>-t<n>.txt and prints it.
Refuses to produce anything unless the demo is built and QA-passed.
"""
import json, sys, argparse, textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INTAKE, QUEUE = ROOT / "intake", ROOT / "outreach" / "queue"
SIG = ("Victor Rosario\n"
       "Aruba Web Studio\n"
       "+297 747 7794  \u00b7  arubawebstudio.com\n\n"
       "Rather I did not email again? Reply 'no' and I will take you off.")


def load(slug):
    f = INTAKE / f"{slug}.json"
    if not f.exists():
        sys.exit(f"no intake file: {f}")
    return json.loads(f.read_text())


def gate(d, slug):
    """Never email a prospect whose demo isn't ready. This rule is the whole strategy."""
    b = d.get("build", {})
    problems = []
    if not b.get("demo_url"):
        problems.append("no demo_url: the demo is not deployed")
    if not b.get("qa_passed"):
        problems.append("qa_passed is false. Run: node qa/check.mjs " + slug)
    if not (ROOT / "outreach" / "proposals" / f"{slug}-proposal.pdf").exists():
        problems.append(f"no proposal PDF. Run: node outreach/make_proposal.mjs {slug}")
    if not d.get("owner_name"):
        problems.append("no owner_name. A generic greeting halves the reply rate")
    if problems:
        print(f"\n  BLOCKED: {d.get('business_name', slug)}")
        for p in problems:
            print(f"    · {p}")
        print("\n  Nothing goes out until the demo is live. There is no second email.\n")
        return False
    return True


def first_touch(d):
    name    = d["business_name"]
    owner   = d.get("owner_name", "")
    sector  = d.get("sector", "")
    hook    = d.get("the_hook", {})
    demo    = d["build"]["demo_url"]
    term    = hook.get("search_term", "")
    rivals  = [r for r in hook.get("who_outranks_them", []) if r]
    comm    = hook.get("commission_paid_to", "")
    prob    = hook.get("observed_problem", "")

    greet = f"Hi {owner},"
    rival_line = ""
    if term:
        who = f"{', '.join(rivals[:3])} came up." if rivals else "Nothing of yours came up."
        rival_line = f'I searched "{term}" this morning. {who} {name} didn\'t.'

    if "Tour" in sector or "Watersport" in sector:
        subj = term.lower() if term else f"{name.lower()} on google"
        body = f"""{rival_line}

So I built you a page: {demo}

It's live, and it has a booking form that doesn't take a cut.{f" Right now you're handing {comm} on every booking that comes through them." if comm else ""}

If you don't want it I'll delete it Friday. No charge either way.

Worth 10 minutes?"""

    elif "Guesthouse" in sector or "Rental" in sector:
        subj = f"the {comm or '15%'} you pay Booking.com"
        body = f"""Every booking through Booking.com or Airbnb costs you {comm or '15-18%'}. On a five-night stay that's real money, every time.

I built {name} a direct booking page: {demo}

One direct booking a month covers it for a whole year.

It's live now. Have a look. If it's not for you I'll take it down, no hard feelings."""

    elif "Restaurant" in sector or "Bar" in sector or "Food" in sector:
        subj = "google can't read your menu"
        body = f"""{prob or 'Your menu is a photo on Facebook.'} Google can't read a photo. So when a visitor searches "restaurants near me" at 8pm, {name} doesn't come up.

I put your menu on a real page: {demo}

Loads in under two seconds on a phone. Live right now.

Delete-able Friday if you hate it."""

    elif "Trade" in sector or "Contractor" in sector or "Auto" in sector:
        subj = f'"{term}"' if term else "when it breaks at 10pm"
        body = f"""Someone's {term.split()[0] if term else 'AC'} dies at 10 on a Sunday night. They grab their phone and search "{term or 'repair aruba'}".

{f"Right now they find {rivals[0]}. Not you." if rivals else "Right now they don't find you."}

Here's a page that would: {demo}

$650 to keep it. $35/month so it never disappears on you like the last one probably did."""

    else:
        subj = f"{name.lower()} on google"
        body = f"""{rival_line or f"When someone gets referred to you, the first thing they do is look you up. Right now they find a Facebook page."}

I built you a proper one: {demo}

Three out of four people judge a business by its website. It's live, so have a look.

If it's not right, no hard feelings."""

    return subj, f"{greet}\n\n{body.strip()}\n\n{SIG}"


FOLLOWUPS = {
    2: ("Re: {subj}",
        "{owner}, did the link come through? Some mail systems here strip them.\n\n"
        "Direct: {demo}\n\nVictor"),
    3: ("Re: {subj}",
        "{owner}, one number that might interest you.\n\n"
        "1.5 million tourists came to Aruba last year. Average spend $1,949 each. Three out of "
        "four American, and they plan on Google before they land.\n\n"
        "Facebook doesn't reach any of them.\n\nPage is still up: {demo}\n\nVictor"),
    4: ("if Facebook deleted your page tomorrow",
        "{owner}, serious question.\n\nIf Meta suspended your page tomorrow morning, with no warning "
        "and no appeal, how would a customer find you? It happens to someone here every month.\n\n"
        "Your website is the one thing online you actually own.\n\n"
        "$650 once, $35/month. That's it.\n\nVictor"),
    5: ("closing this out",
        "{owner}, I'll stop emailing after this one.\n\nThe page I built you comes down Friday. "
        "If you want it, reply and it's yours. If not, no problem at all. I'll take you off my "
        "list.\n\nEither way, good luck this season.\n\nVictor"),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?")
    ap.add_argument("--touch", type=int, default=1)
    ap.add_argument("--batch", type=int)
    args = ap.parse_args()

    QUEUE.mkdir(parents=True, exist_ok=True)

    slugs = []
    if args.batch:
        for f in sorted(INTAKE.glob("*.json")):
            if f.stem.startswith("_"):
                continue
            d = json.loads(f.read_text())
            if d.get("build", {}).get("qa_passed") and d.get("build", {}).get("demo_url"):
                slugs.append(f.stem)
            if len(slugs) >= args.batch:
                break
        if not slugs:
            sys.exit("No demo-ready prospects. Build demos first. That is the whole point.")
        print(f"{len(slugs)} demo-ready prospect(s)\n")
    elif args.slug:
        slugs = [args.slug]
    else:
        sys.exit("give a slug or --batch N")

    sent = 0
    for slug in slugs:
        d = load(slug)
        if not gate(d, slug):
            continue
        subj, body = first_touch(d)
        if args.touch > 1:
            s_t, b_t = FOLLOWUPS[args.touch]
            subj = s_t.format(subj=subj)
            body = b_t.format(owner=d.get("owner_name", ""), demo=d["build"]["demo_url"]) + f"\n\n{SIG}"

        pdf = f"outreach/proposals/{slug}-proposal.pdf"
        msg_words = len(body.replace(SIG, "").split())
        out = (f"To:      {d.get('contact', {}).get('email', '')}\n"
               f"Subject: {subj}\n"
               f"Attach:  {pdf}   <-- link this, do NOT attach on a cold first touch\n"
               f"Words:   {msg_words} (message only; signature excluded)\n"
               f"{'-' * 62}\n{body}\n")
        (QUEUE / f"{slug}-t{args.touch}.txt").write_text(out)
        print(out)
        if msg_words > 80:
            print(f"  ! {msg_words} words in the message. Trim to under 80, short emails reply better.\n")
        sent += 1

    print(f"\n{sent} email(s) queued in outreach/queue/")
    print("Send 20-25 a day, Tue-Thu, 08:00-10:00 Aruba time. Reply within 2 hours.")


if __name__ == "__main__":
    main()
