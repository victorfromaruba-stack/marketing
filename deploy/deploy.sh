#!/usr/bin/env bash
# Aruba Web Studio — deploy a demo to Cloudflare Pages
#
# One-time setup:
#   npm i -g wrangler
#   wrangler login
#   wrangler pages project create aruba-demos --production-branch main
#   Then in the Cloudflare dashboard: Pages -> aruba-demos -> Custom domains
#     -> add  demo.arubawebstudio.com
#
# Usage:  ./deploy/deploy.sh <slug>
# Result: https://demo.arubawebstudio.com/<slug>
#
# No GitHub involved. The URL is yours.

set -euo pipefail
SLUG="${1:-}"
[ -z "$SLUG" ] && { echo "usage: ./deploy/deploy.sh <slug>"; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/sites/$SLUG"
[ -d "$SRC" ] || { echo "no such site: $SRC"; exit 1; }

echo "→ QA gate"
node "$ROOT/qa/check.mjs" "$SLUG" || { echo "QA FAILED — not deploying."; exit 1; }

STAGE="$ROOT/.deploy/$SLUG"
rm -rf "$STAGE"; mkdir -p "$STAGE/$SLUG"
cp -r "$SRC"/* "$STAGE/$SLUG/"

# strip anything that could leak the build process
find "$STAGE" -name '*.md' -delete
find "$STAGE" -name '.DS_Store' -delete
grep -ril "github" "$STAGE" 2>/dev/null && { echo "GitHub reference found in output — aborting."; exit 1; }

cat > "$STAGE/_headers" <<'HDR'
/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
/*.jpg
  Cache-Control: public, max-age=31536000, immutable
/*.webp
  Cache-Control: public, max-age=31536000, immutable
HDR

command -v wrangler >/dev/null 2>&1 || {
  echo ""
  echo "  wrangler not installed — cannot deploy."
  echo "    npm i -g wrangler"
  echo "    wrangler login"
  echo "    wrangler pages project create aruba-demos --production-branch main"
  echo "  Then add demo.arubawebstudio.com as a custom domain in the Cloudflare dashboard."
  echo ""
  echo "  Everything upstream passed. The build is ready; only the publish step is missing."
  exit 2
}

echo "→ deploying"
wrangler pages deploy "$STAGE" --project-name=aruba-demos --branch=main --commit-dirty=true

echo ""
echo "  Live: https://demo.arubawebstudio.com/$SLUG"
echo "  Put that URL in the email. Never mention where it was built."
