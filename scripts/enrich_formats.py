"""
Enrichit la colonne `formats` des courses depuis Finishers.com.

Pour chaque course ayant un finishers_url, scrape la page et extrait
tous les formats disponibles (S, M, L, Relais, XS...) avec leurs distances et tarifs.

Usage :
    python scripts/enrich_formats.py             # toutes les courses avec finishers_url
    python scripts/enrich_formats.py --dry-run   # affiche sans écrire
    python scripts/enrich_formats.py --limit 10
"""

import argparse
import json
import os
import pathlib
import re
import sys
import time

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Charger .env.local
# ---------------------------------------------------------------------------
_env_path = pathlib.Path(__file__).parent.parent / ".env.local"
if _env_path.exists():
    for _line in _env_path.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#"):
            continue
        _eq = _line.find("=")
        if _eq == -1:
            continue
        _k, _v = _line[:_eq].strip(), _line[_eq + 1:].strip()
        if _k and _k not in os.environ:
            os.environ[_k] = _v

from supabase import create_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_KEY requis dans .env.local")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9",
}

# Mots-clés dans le nom indiquant un format secondaire
_SECONDARY = re.compile(
    r"\b(relais|relay|kids|junior|cadets?|enfant|poussins?|benjamins?|minimes?)\b", re.I
)

# Mapping discipline Finishers → catégorie lisible
_DISC_LABEL = {
    "triathlon": "Triathlon",
    "cross_triathlon": "Cross Triathlon",
    "swimrun": "SwimRun",
    "duathlon": "Duathlon",
    "aquathlon": "Aquathlon",
}

# Mapping nom/distance → catégorie S/M/L/XL/XS/70.3/Ironman
def _infer_category(name: str, total_m: int) -> str:
    n = name.lower()
    if "ironman" in n and "70.3" not in n:
        return "Ironman"
    if "70.3" in n or "half iron" in n:
        return "70.3"
    if total_m >= 170_000:
        return "Ironman"
    if total_m >= 80_000:
        return "70.3"
    if total_m >= 40_000:
        return "M"
    if total_m >= 15_000:
        return "S"
    if total_m > 0:
        return "XS"
    # Fallback textuel
    if "olympique" in n or " m " in n or n.endswith(" m"):
        return "M"
    if "sprint" in n or " s " in n or n.endswith(" s"):
        return "S"
    if "xs" in n or "découverte" in n or "jeune" in n:
        return "XS"
    return "M"


def scrape_formats(finishers_url: str) -> list[dict]:
    """Retourne la liste des formats depuis une page Finishers."""
    slug_m = re.search(r"/course/([^/?#]+)", finishers_url)
    if not slug_m:
        return []
    slug = slug_m.group(1)
    url = f"https://www.finishers.com/course/{slug}"

    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            return []
        soup = BeautifulSoup(resp.text, "lxml")
        script = soup.find("script", id="__NEXT_DATA__")
        if not script or not script.string:
            return []
        page_props = json.loads(script.string).get("props", {}).get("pageProps", {})
        page_races = page_props.get("races") or []
    except Exception:
        return []

    formats = []
    for r in page_races:
        if not isinstance(r, dict):
            continue

        discipline = r.get("discipline", "triathlon")
        race_name = r.get("name") or r.get("formattedTitle") or ""
        date = r.get("date")
        activities = r.get("activities") or []
        price = r.get("minPrice")
        elev = r.get("elevationGain")
        is_relay = bool(_SECONDARY.search(race_name))

        # Extraire swim/bike/run depuis activities
        swim = bike = run = None
        for act in activities:
            if not isinstance(act, dict):
                continue
            atype = act.get("activity", "")
            dist = act.get("distance")
            if dist is None:
                continue
            unit = act.get("distanceUnit", "meters")
            dist_m = int(dist) if unit == "meters" else int(float(dist) * 1000)
            if atype == "swimming":
                swim = dist_m
            elif atype in ("cycling", "mountain_biking"):
                bike = (bike or 0) + dist_m
            elif atype in ("road", "running", "trail"):
                run = (run or 0) + dist_m

        # Validation : swim > 10km → données aberrantes
        if swim and swim > 10_000:
            continue

        total = (swim or 0) + (bike or 0) + (run or 0)
        category = _infer_category(race_name, total)

        fmt = {
            "name": race_name or _DISC_LABEL.get(discipline, "Triathlon"),
            "discipline": _DISC_LABEL.get(discipline, discipline),
            "category": category,
            "swim": swim,
            "bike": bike,
            "run": run,
            "total": total or None,
            "price": int(float(str(price).replace(",", "."))) if price else None,
            "elevation": int(elev) if elev and 0 < int(elev) < 6000 else None,
            "date": date,
            "is_relay": is_relay,
        }
        formats.append(fmt)

    return formats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=5000)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    res = (
        sb.table("races")
        .select("id, name, finishers_url")
        .not_.is_("finishers_url", "null")
        .limit(args.limit)
        .execute()
    )
    races = res.data or []

    if not races:
        print("✓ Aucune course avec finishers_url.")
        return

    print(f"🏁 {len(races)} courses avec finishers_url à traiter\n")

    done = failed = 0

    for i, race in enumerate(races):
        formats = scrape_formats(race["finishers_url"])

        if formats:
            if args.dry_run:
                done += 1
                print(f"\n  [DRY] {race['name']} → {len(formats)} formats :")
                for f in formats:
                    swim = f"{f['swim']}m" if f['swim'] else "—"
                    bike = f"{f['bike']//1000}km" if f['bike'] else "—"
                    run = f"{f['run']//1000}km" if f['run'] else "—"
                    price = f"{f['price']}€" if f['price'] else "—"
                    print(f"      {f['category']:8} {f['name']:35} swim={swim:6} bike={bike:7} run={run:6} {price}")
            else:
                try:
                    sb.table("races").update({"formats": formats}).eq("id", race["id"]).execute()
                    done += 1
                except Exception as e:
                    print(f"\n  ✗ DB error {race['name']}: {e}")
                    failed += 1
        else:
            failed += 1

        print(
            f"\r  ✓ {done} enrichies  ✗ {failed} sans formats  [{i+1}/{len(races)}]   ",
            end="",
            flush=True,
        )
        time.sleep(0.35)

    print(f"\n\n✓ Terminé : {done} enrichies, {failed} sans formats")


if __name__ == "__main__":
    main()
