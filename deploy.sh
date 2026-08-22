#!/usr/bin/env bash
#
# Publish this checkout to the web root. Called by the VPS deploy agent
# (system/vps/deploy-agent.sh in the app-test repo) on every new commit, and
# safe to run by hand:
#
#   ./deploy.sh /srv/arubawebstudio
#
set -euo pipefail
DEST="${1:-/srv/arubawebstudio}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[[ -f "$SRC/index.html" ]] || { echo "deploy: no index.html in $SRC — refusing" >&2; exit 1; }

mkdir -p "$DEST"

# Copy into a staging directory first, then swap. A half-finished rsync into
# the live root serves a broken page for the duration; this way the switch is
# one rename.
STAGE="$(mktemp -d "${DEST%/}.stage.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT

rsync -a \
  --exclude '.git*' \
  --exclude 'node_modules' \
  --exclude 'deploy.sh' \
  --exclude 'Caddyfile' \
  --exclude 'README.md' \
  --exclude 'brand/check-contrast.py' \
  "$SRC/" "$STAGE/"

# The brand theme book is part of the site (linked from the footer), so it
# stays. Only the tooling that builds it is stripped above.

rsync -a --delete "$STAGE/" "$DEST/"
echo "deploy: published $(find "$DEST" -type f | wc -l) files to $DEST"

# Caddy serves from disk and needs no reload for content changes. It is only
# reloaded when the Caddyfile itself moved, which is a manual step.
