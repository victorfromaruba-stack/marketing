#!/usr/bin/env bash
# Aruba Web Studio — A to Z
#
#   ./setup.sh            install everything, then report readiness
#   ./setup.sh --doctor   report only, change nothing
#
# Safe to run repeatedly. Installs what is missing, skips what is there.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCTOR=0; [ "${1:-}" = "--doctor" ] && DOCTOR=1

G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; C=$'\033[36m'; B=$'\033[1m'; X=$'\033[0m'
READY=(); MISSING=(); NEXT=()

ok(){   READY+=("$1");   printf "  ${G}✓${X} %s\n" "$1"; }
miss(){ MISSING+=("$1"); printf "  ${R}✗${X} %s\n" "$1"; [ -n "${2:-}" ] && NEXT+=("$2"); }
warn(){ printf "  ${Y}!${X} %s\n" "$1"; }
head(){ printf "\n${B}${C}%s${X}\n" "$1"; }

head "1 · Runtimes"
if command -v python3 >/dev/null; then ok "python3 $(python3 -V 2>&1 | cut -d' ' -f2)"
else miss "python3 not installed" "install python 3.10+"; fi
if command -v node >/dev/null; then
  NV=$(node -v | tr -d 'v' | cut -d. -f1)
  [ "$NV" -ge 20 ] && ok "node $(node -v)" || warn "node $(node -v) — 20+ recommended"
else miss "node not installed" "install node 22: curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs"; fi

head "2 · Python packages"
for m in requests PIL openpyxl; do
  if python3 -c "import $m" 2>/dev/null; then ok "python: $m"
  elif [ $DOCTOR -eq 1 ]; then miss "python: $m" "pip install requests pillow openpyxl"
  else
    printf "    installing %s…\n" "$m"
    pip install -q --break-system-packages requests pillow openpyxl 2>/dev/null || pip install -q requests pillow openpyxl 2>/dev/null
    python3 -c "import $m" 2>/dev/null && ok "python: $m" || miss "python: $m" "pip install requests pillow openpyxl"
  fi
done

head "3 · Node packages"
if node -e "require('playwright')" 2>/dev/null; then ok "playwright"
elif [ $DOCTOR -eq 1 ]; then miss "playwright (QA gate cannot run)" "npm i -g playwright && npx playwright install chromium"
else
  printf "    installing playwright…\n"
  npm i -g playwright >/dev/null 2>&1
  node -e "require('playwright')" 2>/dev/null && ok "playwright" || miss "playwright" "npm i -g playwright"
fi
command -v wrangler >/dev/null && ok "wrangler (Cloudflare deploy)" \
  || miss "wrangler — cannot publish demos" "npm i -g wrangler && wrangler login && wrangler pages project create aruba-demos --production-branch main"

head "4 · Project files"
for f in CLAUDE.md ORG.md brand/brand.md memory/playbook.md qa/check.mjs factory.sh \
         prospector/find_prospects.py prospector/fetch_assets.py office/build_office.py; do
  [ -f "$ROOT/$f" ] && ok "$f" || miss "$f MISSING"
done
AG=$(ls "$ROOT/.claude/agents"/*.md 2>/dev/null | wc -l)
[ "$AG" -ge 10 ] && ok "$AG agent briefs" || miss "only $AG agent briefs (expect 10)"

head "5 · Secrets"
if [ -f "$ROOT/.env" ]; then
  ok ".env exists"
  set -a; . "$ROOT/.env" 2>/dev/null; set +a
else
  if [ $DOCTOR -eq 0 ]; then cp "$ROOT/.env.example" "$ROOT/.env"; warn ".env created from the example — fill it in"; 
  else miss ".env not created" "cp .env.example .env"; fi
fi
[ -n "${GOOGLE_PLACES_KEY:-}" ] && ok "GOOGLE_PLACES_KEY set" \
  || miss "GOOGLE_PLACES_KEY empty — prospector cannot run" "console.cloud.google.com → enable Places API (New) → create a key → put it in .env"
[ -n "${FORMSPREE_FORM_ID:-}" ] && ok "FORMSPREE_FORM_ID set" \
  || miss "FORMSPREE_FORM_ID empty — demo forms will not deliver" "formspree.io → new form → put the id in .env"
git -C "$ROOT" check-ignore .env >/dev/null 2>&1 && ok ".env is gitignored" || warn ".env may not be gitignored"

head "6 · Self-test"
python3 "$ROOT/office/build_office.py" >/dev/null 2>&1 && ok "office renders" || miss "office/build_office.py failed"
python3 "$ROOT/memory/distill.py" >/dev/null 2>&1 && ok "ledger reads" || miss "memory/distill.py failed"
python3 "$ROOT/memory/action.py" list >/dev/null 2>&1 && ok "actions read" || miss "memory/action.py failed"
if node -e "require('playwright')" 2>/dev/null && [ -f "$ROOT/sites/sunrise-snorkel/index.html" ]; then
  node "$ROOT/qa/check.mjs" sunrise-snorkel >/dev/null 2>&1 && ok "QA gate passes on the reference build" \
    || miss "QA gate failed on the reference build"
fi
python3 "$ROOT/prospector/find_prospects.py" --dry-run >/dev/null 2>&1 && ok "prospector plan builds" || warn "prospector dry-run failed"

head "7 · Pipeline readiness"
P=$(ls "$ROOT/intake"/*.json 2>/dev/null | grep -v _TEMPLATE | wc -l)
S=$(ls -d "$ROOT/sites"/*/ 2>/dev/null | wc -l)
L=$(wc -l < "$ROOT/memory/ledger/outcomes.jsonl" 2>/dev/null || echo 0)
printf "  %s prospect brief(s) · %s site(s) built · %s outcome(s) recorded\n" "$P" "$S" "$L"
[ "$L" -eq 0 ] && warn "ledger empty — the studio cannot learn anything until real emails go out"

TOTAL=$(( ${#READY[@]} + ${#MISSING[@]} ))
printf "\n${B}%s${X}\n" "════════════════════════════════════════════════════════"
printf "  ${B}%d of %d ready${X}\n" "${#READY[@]}" "$TOTAL"
if [ ${#MISSING[@]} -gt 0 ]; then
  printf "\n  ${R}Blocking:${X}\n"
  for m in "${MISSING[@]}"; do printf "    · %s\n" "$m"; done
fi
if [ ${#NEXT[@]} -gt 0 ]; then
  printf "\n  ${Y}Do these, in order:${X}\n"
  i=1; for n in "${NEXT[@]}"; do printf "    %d. %s\n" "$i" "$n"; i=$((i+1)); done
fi
if [ ${#MISSING[@]} -eq 0 ]; then
  printf "\n  ${G}Everything is wired. Start the line:${X}\n"
  printf "    python3 prospector/find_prospects.py --category Tours\n"
  printf "    /analyst <slug>   then   ./factory.sh <slug> --place-id <id>\n"
fi
printf "${B}%s${X}\n\n" "════════════════════════════════════════════════════════"
