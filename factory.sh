#!/usr/bin/env bash
# The deterministic half of the line. Run the agent steps in Claude Code around it.
#   ./factory.sh <slug> [--place-id ID] [--site URL]
set -euo pipefail
SLUG="${1:-}"; shift || true
[ -z "$SLUG" ] && { echo "usage: ./factory.sh <slug> [--place-id ID] [--site URL]"; exit 1; }

PLACE=""; SITE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --place-id) PLACE="$2"; shift 2;;
    --site)     SITE="$2";  shift 2;;
    *) shift;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
step(){ printf "\n\033[1;36m▸ %s\033[0m\n" "$1"; }
halt(){ printf "\n\033[1;31m✕ LINE STOPPED — %s\033[0m\n\n" "$1"; exit 1; }

[ -f "$ROOT/intake/$SLUG.json" ] || halt "no intake/$SLUG.json — run /analyst $SLUG first"

step "2 · assets"
[ -n "$PLACE" ] && python3 "$ROOT/prospector/fetch_assets.py" "$SLUG" --place-id "$PLACE"
[ -n "$SITE"  ] && python3 "$ROOT/prospector/fetch_assets.py" "$SLUG" --from-site "$SITE"
[ -z "$PLACE$SITE" ] && python3 "$ROOT/prospector/fetch_assets.py" "$SLUG" --palette-only

ls "$ROOT/sites/$SLUG/img/" 2>/dev/null | grep -qi '^logo\.' \
  || halt "no client logo. Get it from their Facebook profile picture or signage, drop it in intake/assets/$SLUG/logo.png and re-run with --manual"

step "3-5 · design, copy, build  (run these in Claude Code)"
echo "    /art-director $SLUG"
echo "    /copywriter   $SLUG"
echo "    /engineer     $SLUG"
[ -f "$ROOT/sites/$SLUG/index.html" ] || halt "sites/$SLUG/index.html does not exist yet — run the three commands above, then re-run"

step "6 · inspector — automated gate"
node "$ROOT/qa/check.mjs" "$SLUG" --open || halt "QA failed. Fix the defects and re-run. Do not deploy."

step "7 · guard — security"
if grep -rInE "(AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY)" \
     --exclude-dir={node_modules,.git,.deploy} "$ROOT" >/dev/null 2>&1; then
  halt "secret found in the repo"
fi
grep -riq "github" "$ROOT/sites/$SLUG/" && halt "GitHub reference in shipped output"
echo "    cleared"

step "8 · deploy"
set +e
"$ROOT/deploy/deploy.sh" "$SLUG"
code=$?
set -e
if [ "$code" -eq 2 ]; then
  halt "wrangler not set up yet — see the instructions above. Everything upstream passed."
elif [ "$code" -ne 0 ]; then
  halt "deploy failed (exit $code)"
fi

step "9 · proposal + email"
node "$ROOT/outreach/make_proposal.mjs" "$SLUG"
python3 "$ROOT/outreach/make_email.py" "$SLUG" || true

step "10 · queue"
python3 "$ROOT/office/build_office.py"

printf "\n\033[1;32m✓ %s is queued in Victor's approval tray.\033[0m\n" "$SLUG"
printf "  Nothing has been sent. Sending is his call.\n\n"
