"""
Enrichit les courses ayant déjà un finishers_url avec :
  - total_elevation  (max elevationGain parmi les formats principaux)
  - finishers_count  (max lastEditionFinisherCount parmi les formats principaux)
  - description      (longDescription nettoyé, tronqué à 800 chars) — seulement si NULL en base
  - tags             (liste de noms de tags) — seulement si NULL en base

Ne remplace jamais une valeur déjà présente en base (UPDATE uniquement les colonnes NULL).

Usage :
    python scripts/enrich_finishers_stats.py              # traite jusqu'à 500 courses
    python scripts/enrich_finishers_stats.py --limit 50   # test sur 50 courses
    python scripts/enrich_finishers_stats.py --dry-run    # affiche sans écrire en base

Requis : NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY dans .env.local (racine du projet)
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
# Constantes de filtrage
# ---------------------------------------------------------------------------

_SECONDARY = re.compile(
    r"\b(jeune|relais|kids|junior|cadet|enfant|poussins?|benjamins?|minimes?)\b",
    re.I,
)

_MAIN_DISCIPLINES = {"triathlon", "cross_triathlon"}

ELEV_MIN = 0
ELEV_MAX = 5000


# ---------------------------------------------------------------------------
# Parsing __NEXT_DATA__
# ---------------------------------------------------------------------------

def _is_main_race(r: dict) -> bool:
    """Renvoie True si le format est un triathlon principal (pas relais/jeunes)."""
    disc = r.get("discipline", "")
    if disc and disc not in _MAIN_DISCIPLINES:
        return False
    name = r.get("name") or r.get("formattedTitle") or ""
    if _SECONDARY.search(name):
        return False
    return True


def _clean_html(html: str) -> str:
    """Retire les balises HTML et normalise les espaces."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def fetch_finishers_stats(slug: str) -> dict:
    """
    Scrape https://www.finishers.com/course/[slug] et retourne un dict avec :
      total_elevation, finishers_count, description, tags
    Les valeurs absentes/invalides sont omises du dict retourné.
    """
    url = f"https://www.finishers.com/course/{slug}"
    try:
        resp = requests.get(url, headers=DEFAULT_HEADERS, timeout=15)
        if resp.status_code != 200:
            return {}

        soup = BeautifulSoup(resp.text, "lxml")
        script = soup.find("script", id="__NEXT_DATA__")
        if not script or not script.string:
            return {}

        try:
            next_data = json.loads(script.string)
        except json.JSONDecodeError:
            return {}

        page_props = next_data.get("props", {}).get("pageProps", {})
        page_races = page_props.get("races") or []

        # --- Filtrer les formats principaux ---
        main_races = [r for r in page_races if isinstance(r, dict) and _is_main_race(r)]
        if not main_races:
            main_races = [r for r in page_races if isinstance(r, dict)]

        result = {}

        # --- Dénivelé : max(elevationGain) sur les formats principaux ---
        elevations = []
        for r in main_races:
            elev = r.get("elevationGain")
            if elev is None:
                continue
            try:
                val = int(float(str(elev)))
                if ELEV_MIN <= val <= ELEV_MAX:
                    elevations.append(val)
            except (ValueError, TypeError):
                continue
        if elevations:
            result["total_elevation"] = max(elevations)

        # --- Finishers count : max(lastEditionFinisherCount) ---
        counts = []
        for r in main_races:
            cnt = r.get("lastEditionFinisherCount")
            if cnt is None:
                continue
            try:
                counts.append(int(cnt))
            except (ValueError, TypeError):
                continue
        if counts:
            result["finishers_count"] = max(counts)

        # --- Description : longDescription de l'event ---
        event = page_props.get("event") or {}
        raw_desc = event.get("longDescription") or ""
        if raw_desc:
            desc = _clean_html(raw_desc)
            if desc:
                result["description"] = desc[:800]

        # --- Tags ---
        raw_tags = page_props.get("tags") or []
        tags = []
        for t in raw_tags:
            if isinstance(t, dict):
                name = (t.get("name") or "").strip()
                if name:
                    tags.append(name)
            elif isinstance(t, str) and t.strip():
                tags.append(t.strip())
        if tags:
            result["tags"] = tags

        return result

    except Exception:
        return {}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Enrichit les stats Finishers (elevation, finishers_count, description, tags)"
    )
    parser.add_argument(
        "--limit", type=int, default=500,
        help="Nombre max de courses à traiter (défaut: 500)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Affiche les résultats sans écrire en base"
    )
    args = parser.parse_args()

    # 1. Récupérer les courses avec finishers_url
    result = (
        sb.table("races")
        .select("id, name, finishers_url, total_elevation, finishers_count, description, tags")
        .not_.is_("finishers_url", "null")
        .limit(args.limit)
        .execute()
    )
    races = result.data or []

    if not races:
        print("Aucune course avec finishers_url trouvée.")
        return

    print(f"  {len(races)} courses avec finishers_url a traiter")
    if args.dry_run:
        print("  Mode dry-run : aucune ecriture en base\n")

    enriched = 0
    skipped = 0
    errors = 0

    for i, race in enumerate(races):
        finishers_url = race.get("finishers_url", "")
        # Extraire le slug depuis l'URL
        m = re.search(r"/course/([^/?#]+)", finishers_url)
        if not m:
            errors += 1
            print(
                f"\r  + {enriched} enrichies  [{i+1}/{len(races)}]   ",
                end="", flush=True,
            )
            time.sleep(0.35)
            continue

        slug = m.group(1)
        stats = fetch_finishers_stats(slug)

        if not stats:
            skipped += 1
            print(
                f"\r  + {enriched} enrichies  [{i+1}/{len(races)}]   ",
                end="", flush=True,
            )
            time.sleep(0.35)
            continue

        # Ne mettre à jour que les colonnes NULL en base
        update_data = {}

        if stats.get("total_elevation") is not None and race.get("total_elevation") is None:
            update_data["total_elevation"] = stats["total_elevation"]

        if stats.get("finishers_count") is not None and race.get("finishers_count") is None:
            update_data["finishers_count"] = stats["finishers_count"]

        if stats.get("description") and not race.get("description"):
            update_data["description"] = stats["description"]

        if stats.get("tags") and not race.get("tags"):
            update_data["tags"] = stats["tags"]

        if update_data:
            if args.dry_run:
                name = race.get("name", "?")
                print(f"\n  [DRY] {name} ({slug}) -> {list(update_data.keys())}")
                enriched += 1
            else:
                try:
                    sb.table("races").update(update_data).eq("id", race["id"]).execute()
                    enriched += 1
                except Exception as e:
                    errors += 1
                    print(f"\n  Erreur DB pour {race.get('name', '?')} : {e}")
        else:
            skipped += 1

        print(
            f"\r  + {enriched} enrichies  [{i+1}/{len(races)}]   ",
            end="", flush=True,
        )
        time.sleep(0.35)

    print(f"\n\nTermine : {enriched} enrichies, {skipped} sans nouvelles donnees, {errors} erreurs")


if __name__ == "__main__":
    main()
