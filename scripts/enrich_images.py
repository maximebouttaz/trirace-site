"""
Ajoute des photos aux courses qui n'en ont pas, en allant chercher l'OG image
depuis le finishers_url en priorité, puis le website_url en fallback.

Les images génériques (logo, default, placeholder, fftri) sont rejetées.

Usage :
    python scripts/enrich_images.py               # traite jusqu'à 300 courses
    python scripts/enrich_images.py --limit 50    # test sur 50 courses
    python scripts/enrich_images.py --dry-run     # affiche sans écrire en base

Requis : NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY dans .env.local (racine du projet)
"""

import argparse
import os
import pathlib
import re
import sys
import time
from typing import Optional

import requests
from bs4 import BeautifulSoup
from supabase import create_client

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

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_KEY requis dans .env.local")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

sys.path.insert(0, os.path.dirname(__file__))
from utils import DEFAULT_HEADERS

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

_GENERIC_PATTERNS = re.compile(
    r"logo|default|placeholder|fftri",
    re.I,
)


# ---------------------------------------------------------------------------
# Extraction OG image
# ---------------------------------------------------------------------------

def _fetch_og_image(url: str) -> Optional[str]:
    """
    Télécharge l'URL et cherche <meta property="og:image">.
    Retourne l'URL de l'image si elle est valide, sinon None.
    """
    try:
        resp = requests.get(url, headers=DEFAULT_HEADERS, timeout=10)
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, "lxml")
        og = soup.find("meta", property="og:image")
        if not og:
            return None
        content = (og.get("content") or "").strip()
        if not content.startswith("http"):
            return None
        if _GENERIC_PATTERNS.search(content):
            return None
        return content
    except Exception:
        return None


def find_image(race: dict) -> Optional[str]:
    """
    Cherche une image pour la course.
    Priorite : finishers_url > website_url.
    """
    finishers_url = race.get("finishers_url")
    website_url = race.get("website_url")

    # Priorite 1 : Finishers
    if finishers_url:
        img = _fetch_og_image(finishers_url)
        if img:
            return img
        time.sleep(0.3)

    # Priorite 2 : site officiel
    if website_url:
        img = _fetch_og_image(website_url)
        if img:
            return img
        time.sleep(0.3)

    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Enrichit image_url depuis l'OG image des pages finishers/website"
    )
    parser.add_argument(
        "--limit", type=int, default=300,
        help="Nombre max de courses a traiter (defaut: 300)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Affiche les resultats sans ecrire en base"
    )
    args = parser.parse_args()

    # 1. Courses sans image_url mais avec finishers_url ou website_url
    result = (
        sb.table("races")
        .select("id, name, website_url, finishers_url")
        .is_("image_url", "null")
        .or_("finishers_url.not.is.null,website_url.not.is.null")
        .limit(args.limit)
        .execute()
    )
    races = result.data or []

    if not races:
        print("Aucune course sans image_url a traiter.")
        return

    print(f"  {len(races)} courses sans image_url a traiter")
    if args.dry_run:
        print("  Mode dry-run : aucune ecriture en base\n")

    found = 0
    not_found = 0
    errors = 0

    for i, race in enumerate(races):
        img_url = find_image(race)

        if img_url:
            if args.dry_run:
                print(f"\n  [DRY] {race.get('name', '?')} -> {img_url[:80]}...")
                found += 1
            else:
                try:
                    sb.table("races").update({"image_url": img_url}).eq("id", race["id"]).execute()
                    found += 1
                except Exception as e:
                    errors += 1
                    print(f"\n  Erreur DB pour {race.get('name', '?')} : {e}")
        else:
            not_found += 1

        print(
            f"\r  + {found} images trouvees  [{i+1}/{len(races)}]   ",
            end="", flush=True,
        )
        # Le sleep est deja applique dans find_image() apres chaque requete.
        # On ajoute un petit delai supplementaire entre chaque course.
        time.sleep(0.1)

    print(f"\n\nTermine : {found} images ajoutees, {not_found} sans image, {errors} erreurs")


if __name__ == "__main__":
    main()
