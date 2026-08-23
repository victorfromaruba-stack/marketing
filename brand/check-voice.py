#!/usr/bin/env python3
"""Check the site's visible copy against the studio's own voice rules.

    python3 brand/check-voice.py            # check
    python3 brand/check-voice.py --show     # print all visible copy

Runs in CI beside check-contrast.py, and for the same reason. The contrast
checker exists because two WCAG failures shipped that nobody could see by eye.
This one exists because prose fails the same way: every sentence looks fine on
its own, and the tells only show up when you count them across a page.

The test the theme book publishes is "would you say this out loud to a
restaurant owner across a table?" That is the right test and it is not
mechanisable, so this does not try. It catches the specific things that made
the page fail it, which were countable:

  - Em dashes. Five of them. Almost nobody reaches for an em dash in speech or
    in a quick email, so a page full of them reads as written by something that
    did. Use a full stop, a comma, or two sentences.
  - No contractions anywhere. "your POS and your website probably do not share
    data" is not a sentence a person says. This is the single loudest tell and
    it was on every paragraph.
  - Crutch words and agency jargon, from the theme book's own Not column.
  - The "X rather than Y" construction, five times on one page. Once is a
    contrast. Five times is a tic.

Thresholds, not bans, where a word has honest uses. The point is to make the
count visible, not to forbid English.
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

# Files whose visible text is customer-facing.
TARGETS = ["index.html", "brand/index.html"]

BANNED = {
    "—": "em dash. Use a full stop, a comma, or two sentences.",
    "leverage": "say what you actually do with it",
    "seamless": "nobody has ever called a thing seamless out loud",
    "elevate": "agency word",
    "synergy": "agency word",
    "cutting-edge": "agency word",
    "bespoke": "say 'custom', or better, say what it is",
    "digital transformation": "agency word",
    "unlock": "agency word",
    "empower": "agency word",
    "delve": "nobody says this",
    "robust": "vague. Say what holds up, and under what.",
    "in today's": "filler opener",
    "solutions": "say the thing you sell",
}

# (pattern, ceiling, why). Above the ceiling it reads as a tic.
LIMITS = [
    (r"\brather than\b", 2, "the 'X rather than Y' construction"),
    (r"\binstead of\b", 2, "the 'X instead of Y' construction"),
    (r"\bactually\b", 1, "'actually' as emphasis"),
    (r"\bnot just\b", 1, "the 'not just X but Y' construction"),
]

# Uncontracted forms a person would contract in speech.
UNCONTRACTED = [
    (r"\bdo not\b", "don't"), (r"\bdoes not\b", "doesn't"),
    (r"\bis not\b", "isn't"), (r"\bare not\b", "aren't"),
    (r"\bwill not\b", "won't"), (r"\bcannot\b", "can't"),
    (r"\bwe have\b", "we've"), (r"\bwe are\b", "we're"),
    (r"\byou are\b", "you're"), (r"\byou will\b", "you'll"),
    (r"\bwe would\b", "we'd"), (r"\bit is\b", "it's"),
    (r"\bthat is\b", "that's"), (r"\bhave not\b", "haven't"),
]
# A page may keep a few for rhythm or emphasis. A page with none has a problem.
UNCONTRACTED_CEILING = 4


def visible_text(html: str) -> str:
    """Everything a reader sees. Scripts, styles and markup are not copy."""
    body = html[html.index("<body"):] if "<body" in html else html
    body = re.sub(r"<(script|style|svg|code|pre)[^>]*>.*?</\1>", " ", body, flags=re.S | re.I)
    # Comments are for us, not the reader.
    body = re.sub(r"<!--.*?-->", " ", body, flags=re.S)
    # The theme book's "Not" column quotes agency jargon in order to forbid it.
    # Counting those as offences flags the rule for stating the rule, which is
    # how a linter teaches people to delete the documentation.
    body = re.sub(r'<td class="no">.*?</td>', " ", body, flags=re.S)
    body = re.sub(r'<[^>]*\bclass="[^"]*\bavoid\b[^"]*"[^>]*>.*?</[a-z]+>', " ", body, flags=re.S)
    txt = re.sub(r"<[^>]+>", " ", body)
    txt = txt.replace("&nbsp;", " ").replace("&amp;", "&")
    txt = txt.replace("&lt;", "<").replace("&gt;", ">").replace("&#183;", "·")
    return re.sub(r"\s+", " ", txt)


def check(path: Path) -> list[str]:
    txt = visible_text(path.read_text())
    low = txt.lower()
    out = []

    for word, why in BANNED.items():
        n = low.count(word)
        if n:
            label = "em dash" if word == "—" else f"'{word}'"
            out.append(f"{n}x {label} — {why}" if False else f"{n}x {label}: {why}")

    for pattern, ceiling, why in LIMITS:
        n = len(re.findall(pattern, low))
        if n > ceiling:
            out.append(f"{n}x {why}: over the ceiling of {ceiling}. Vary it.")

    total = sum(len(re.findall(p, low)) for p, _ in UNCONTRACTED)
    contractions = len(re.findall(r"\w'(t|s|re|ve|ll|d)\b", txt))
    # Ratio, not a raw count. A long page legitimately carries more of
    # everything, and the first version of this check failed a page that had
    # seventeen contractions against twelve formal forms — which is a page
    # that plainly does not have this problem. What matters is the balance.
    if total > UNCONTRACTED_CEILING:
        share = contractions / (contractions + total)
        if share < 0.35:
            pairs = ", ".join(f"{p.strip(chr(92) + 'b')}→{r}" for p, r in UNCONTRACTED
                              if re.search(p, low))
            out.append(f"{total} uncontracted forms against {contractions} contractions "
                       f"({share:.0%} contracted). Read it aloud: {pairs}")
    return out


def main() -> int:
    if "--show" in sys.argv:
        for t in TARGETS:
            print(f"\n===== {t} =====\n")
            print(visible_text((ROOT / t).read_text()))
        return 0

    print("\n  Voice check — the studio's own rules, applied to its own pages\n")
    failed = 0
    for t in TARGETS:
        path = ROOT / t
        if not path.exists():
            print(f"  {t:<22} SKIP (missing)")
            continue
        problems = check(path)
        if problems:
            failed += 1
            print(f"  {t}")
            for p in problems:
                print(f"      {p}")
            print()
        else:
            print(f"  {t:<22} PASS")

    if failed:
        print(f"\n  {failed} file(s) need a rewrite.")
        print("  The test: would you say this out loud to a restaurant owner")
        print("  across a table? If not, rewrite it.\n")
        return 1
    print("\n  Both pages sound like a person wrote them.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
