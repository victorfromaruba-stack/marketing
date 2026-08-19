#!/usr/bin/env python3
"""
Aruba Web Studio — Prospector
Pulls every business on Aruba from Google Places, flags the ones with no website.

Setup (once):
  1. console.cloud.google.com -> new project -> enable "Places API (New)"
  2. Create an API key, restrict it to Places API
  3. export GOOGLE_PLACES_KEY="your-key"
  4. pip install requests

Run:
  python3 find_prospects.py                # full sweep, all categories x districts
  python3 find_prospects.py --category restaurant
  python3 find_prospects.py --dry-run      # show the query plan + cost estimate, call nothing

Output: prospects.csv  (and raw_places.json cache so re-runs are free)
"""
import os, sys, json, time, csv, argparse, re
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("pip install requests")

KEY = os.environ.get("GOOGLE_PLACES_KEY", "")
HERE = Path(__file__).parent
CACHE = HERE / "raw_places.json"
OUT = HERE / "prospects.csv"

ENDPOINT = "https://places.googleapis.com/v1/places:searchText"
FIELDS = ",".join([
    "places.id", "places.displayName", "places.formattedAddress",
    "places.websiteUri", "places.nationalPhoneNumber",
    "places.internationalPhoneNumber", "places.rating",
    "places.userRatingCount", "places.googleMapsUri",
    "places.primaryTypeDisplayName", "places.businessStatus",
    "places.location", "nextPageToken",
])

# Aruba bounding box — covers the whole island
ARUBA_BIAS = {"rectangle": {
    "low":  {"latitude": 12.40, "longitude": -70.10},
    "high": {"latitude": 12.65, "longitude": -69.85},
}}

# Tier A first — best ROI story, easiest close (see Sectors tab of the tracker)
CATEGORIES = [
    ("Tours & Watersports", "A", [
        "snorkel tour", "diving shop", "boat tour", "sunset sail", "UTV tour",
        "jeep tour", "fishing charter", "kitesurfing school", "windsurfing",
        "kayak tour", "horseback riding", "parasailing", "tour operator"]),
    ("Guesthouse / Rental", "A", [
        "guesthouse", "bed and breakfast", "apartment rental", "vacation rental",
        "small hotel", "villa rental"]),
    ("Restaurant / Bar", "A", [
        "restaurant", "seafood restaurant", "local food", "beach bar", "bar",
        "cafe", "pizzeria", "chinese restaurant", "steakhouse", "sushi"]),
    ("Food Truck", "A", ["food truck", "snack bar", "truck di cuminda"]),
    ("Trades / Contractor", "B", [
        "air conditioning repair", "plumber", "electrician", "pool service",
        "roofing contractor", "solar installer", "landscaping", "general contractor",
        "handyman", "pest control"]),
    ("Auto / Car Rental", "B", [
        "car rental", "scooter rental", "auto repair", "mechanic", "tire shop",
        "car wash", "body shop"]),
    ("Professional Services", "B", [
        "accountant", "lawyer", "notary", "insurance agency", "real estate agency",
        "translator", "bookkeeping"]),
    ("Health / Clinic", "B", [
        "dentist", "physiotherapist", "veterinarian", "medical clinic", "optician",
        "chiropractor"]),
    ("Retail / Boutique", "C", [
        "boutique", "gift shop", "jewelry store", "mini market", "furniture store",
        "hardware store", "pharmacy", "bakery", "butcher"]),
    ("Salon / Barber", "C", ["hair salon", "barber shop", "nail salon", "spa", "beauty salon"]),
    ("Gym / Fitness", "C", ["gym", "fitness center", "yoga studio", "crossfit"]),
    ("Events / Wedding", "C", [
        "wedding planner", "photographer", "event rental", "catering", "florist", "dj"]),
]

DISTRICTS = ["Oranjestad", "Noord", "Palm Beach", "Eagle Beach", "San Nicolas",
             "Santa Cruz", "Savaneta", "Paradera", "Aruba"]


def slugify(name):
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:60] or "business"


def search(query, page_token=None):
    body = {"textQuery": query, "locationBias": ARUBA_BIAS, "pageSize": 20}
    if page_token:
        body["pageToken"] = page_token
    r = requests.post(ENDPOINT, json=body, timeout=30, headers={
        "Content-Type": "application/json",
        "X-Goog-Api-Key": KEY,
        "X-Goog-FieldMask": FIELDS,
    })
    if r.status_code != 200:
        print(f"    ! {r.status_code}: {r.text[:200]}")
        return {}
    return r.json()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--category", help="run one sector only (substring match)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--max-pages", type=int, default=3, help="pages per query (20 results each)")
    args = ap.parse_args()

    cats = CATEGORIES
    if args.category:
        cats = [c for c in CATEGORIES if args.category.lower() in c[0].lower()]
        if not cats:
            sys.exit(f"No category matching '{args.category}'")

    queries = [(cat, tier, f"{term} in {d}, Aruba")
               for cat, tier, terms in cats for term in terms for d in DISTRICTS]

    if args.dry_run:
        print(f"{len(queries)} queries x up to {args.max_pages} pages")
        print(f"~{len(queries) * args.max_pages} API calls")
        print("Places Text Search bills per call — check current rate and your free monthly")
        print("credit in the Cloud Console before a full sweep. Start with --category to test.")
        for q in queries[:10]:
            print("   ", q[2])
        print("    ...")
        return

    if not KEY:
        sys.exit("Set GOOGLE_PLACES_KEY first:  export GOOGLE_PLACES_KEY='...'")

    places = {}
    if CACHE.exists():
        places = json.loads(CACHE.read_text())
        print(f"Resuming — {len(places)} places already cached")

    try:
        for i, (cat, tier, q) in enumerate(queries, 1):
            print(f"[{i}/{len(queries)}] {q}")
            token, pages = None, 0
            while pages < args.max_pages:
                data = search(q, token)
                results = data.get("places", [])
                new = 0
                for p in results:
                    pid = p.get("id")
                    if not pid:
                        continue
                    if pid not in places:
                        new += 1
                    # keep the richest record; first sector wins for classification
                    p.setdefault("_category", cat)
                    p.setdefault("_tier", tier)
                    places[pid] = {**places.get(pid, {}), **p}
                print(f"    +{new} new ({len(results)} returned, {len(places)} total)")
                token = data.get("nextPageToken")
                pages += 1
                if not token:
                    break
                time.sleep(2)   # token needs a moment to become valid
            time.sleep(0.3)
            if i % 20 == 0:
                CACHE.write_text(json.dumps(places))
    except KeyboardInterrupt:
        print("\nInterrupted — saving what we have.")

    CACHE.write_text(json.dumps(places))
    write_csv(places)


def write_csv(places):
    rows = []
    for pid, p in places.items():
        name = (p.get("displayName") or {}).get("text", "")
        if not name:
            continue
        if p.get("businessStatus") not in (None, "OPERATIONAL"):
            continue
        site = (p.get("websiteUri") or "").strip()
        # a facebook/instagram link is NOT a website — those are our best prospects
        social_only = bool(re.search(r"(facebook|instagram|linktr\.ee|wa\.me)", site, re.I))
        has_site = bool(site) and not social_only
        rows.append({
            "id": pid,
            "slug": slugify(name),
            "business_name": name,
            "sector": p.get("_category", ""),
            "tier": p.get("_tier", ""),
            "google_type": (p.get("primaryTypeDisplayName") or {}).get("text", ""),
            "address": p.get("formattedAddress", ""),
            "phone": p.get("nationalPhoneNumber", ""),
            "phone_intl": p.get("internationalPhoneNumber", ""),
            "website": site,
            "has_website": "Yes" if has_site else "No",
            "social_only": "Yes" if social_only else "",
            "rating": p.get("rating", ""),
            "reviews": p.get("userRatingCount", ""),
            "maps_url": p.get("googleMapsUri", ""),
            "lat": (p.get("location") or {}).get("latitude", ""),
            "lng": (p.get("location") or {}).get("longitude", ""),
            "email": "", "owner_name": "", "facebook": "", "instagram": "",
            "demo_built": "", "demo_url": "", "status": "Not started", "notes": "",
        })

    # best prospects first: no website, then Tier A, then most-reviewed (= most established)
    rows.sort(key=lambda r: (
        r["has_website"] == "Yes",
        {"A": 0, "B": 1, "C": 2}.get(r["tier"], 3),
        -(r["reviews"] or 0),
    ))

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    total = len(rows)
    no_site = sum(1 for r in rows if r["has_website"] == "No")
    social = sum(1 for r in rows if r["social_only"] == "Yes")
    print(f"\n{'='*52}")
    print(f"  {total} businesses      -> {OUT.name}")
    print(f"  {no_site} with NO website  ({no_site/total*100:.1f}%)   <-- your prospects")
    print(f"  {social} link only to social media")
    print(f"{'='*52}")
    print("\nThat percentage is your Island Audit number. Quote it in every email.")


if __name__ == "__main__":
    main()
