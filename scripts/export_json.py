"""
Export des courses scrapées en JSON pour le seed.

Usage :
    python scripts/export_json.py                          # toutes les sources
    python scripts/export_json.py --sources fftri ironman   # sources spécifiques

Génère : scripts/data/races.json
"""

import argparse
import json
import os
import sys
from datetime import date

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

sys.path.insert(0, os.path.dirname(__file__))
from scrapers import fftri, ironman, opentri, les_chronos, finishers, milesrepublic

ALL_SOURCES = {
    "fftri": fftri,
    "opentri": opentri,
    "ironman": ironman,
    "les_chronos": les_chronos,
    "finishers": finishers,
    "milesrepublic": milesrepublic,
}

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "races.json")


def main():
    parser = argparse.ArgumentParser(description="Export courses en JSON")
    parser.add_argument(
        "--sources",
        nargs="+",
        choices=list(ALL_SOURCES.keys()),
        default=list(ALL_SOURCES.keys()),
    )
    parser.add_argument("--year", type=int, default=date.today().year)
    args = parser.parse_args()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Charger les données existantes si le fichier existe
    existing = {}
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            for race in json.load(f):
                existing[race["slug"]] = race
        print(f"📦 {len(existing)} courses existantes chargées depuis races.json")

    all_races = dict(existing)  # Copie

    for source_name in args.sources:
        scraper = ALL_SOURCES[source_name]
        print(f"\n▶ {source_name.upper()}")
        print("-" * 40)

        try:
            races = scraper.scrape(year=args.year)
            count = 0
            for race in races:
                slug = race.get("slug")
                if slug:
                    # Merge : les nouvelles données complètent les existantes
                    if slug in all_races:
                        merged = all_races[slug]
                        for k, v in race.items():
                            if v is not None:
                                merged[k] = v
                        all_races[slug] = merged
                    else:
                        # Ajouter status published et total_distance calculé
                        if not race.get("total_distance"):
                            swim = race.get("swim_distance") or 0
                            bike = race.get("bike_distance") or 0
                            run = race.get("run_distance") or 0
                            total = swim + bike + run
                            if total > 0:
                                race["total_distance"] = total
                        race["status"] = "published"
                        all_races[slug] = race
                        count += 1

            print(f"  ✓ {count} nouvelles courses, {len(races)} traitées au total")

        except Exception as e:
            print(f"  ✗ Erreur : {e}")
            print(f"  → Les courses déjà collectées sont conservées")

    # Écrire le JSON
    races_list = sorted(all_races.values(), key=lambda r: r.get("date") or "9999")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(races_list, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*50}")
    print(f"  ✓ {len(races_list)} courses exportées dans scripts/data/races.json")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
