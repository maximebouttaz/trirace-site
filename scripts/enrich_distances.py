"""
Enrichit les distances manquantes depuis Finishers.com puis MilesRepublic.

Stratégie par ordre de priorité :
  1. Finishers.com  — télécharge le sitemap, match par nom+ville (fuzzy), scrape __NEXT_DATA__
  2. MilesRepublic  — liste paginée /triathlon, match par nom+ville dans les JSON-LD

Usage :
    python scripts/enrich_distances.py             # toutes les courses sans swim_distance
    python scripts/enrich_distances.py --limit 100 # test sur 100 courses
    python scripts/enrich_distances.py --dry-run   # affiche sans écrire en base

Requis : NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY dans .env.local (racine du projet)
"""

import argparse
import json
import os
import pathlib
import re
import sys
import time
import unicodedata
from difflib import SequenceMatcher
from typing import Optional

import requests
from bs4 import BeautifulSoup
from supabase import create_client

# ---------------------------------------------------------------------------
# Charger .env.local (comme geocode.ts et weather.ts)
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
    print("❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_KEY requis dans .env.local")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

sys.path.insert(0, os.path.dirname(__file__))
from scrapers.milesrepublic import _find_distance
from utils import DEFAULT_HEADERS

# ---------------------------------------------------------------------------
# Normalisation
# ---------------------------------------------------------------------------

def _slug(text: str) -> str:
    """Normalise un texte en slug comparable : retire accents, année, ponctuation."""
    t = unicodedata.normalize("NFD", text.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"\b20\d\d\b", "", t)          # retire les années
    t = re.sub(r"[^a-z0-9]+", " ", t)         # garde seulement alphanum
    return t.strip()


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, _slug(a), _slug(b)).ratio()


def _city_in_slug(city: str, finishers_slug: str) -> bool:
    """Vérifie que la ville est présente dans le slug Finishers (matching mot entier)."""
    city_norm = _slug(city)
    slug_words = set(_slug(finishers_slug.replace("-", " ")).split())
    if len(city_norm) < 3:
        return True  # ville trop courte pour être discriminante
    # Vérifie que l'un des mots significatifs de la ville (≥4 chars) est un mot du slug
    for word in city_norm.split():
        if len(word) >= 4 and word in slug_words:
            return True
    # Fallback : au moins 6 chars du premier mot en commun (partial prefix)
    first_word = city_norm.split()[0] if city_norm.split() else ""
    if len(first_word) >= 6:
        return any(w.startswith(first_word[:6]) for w in slug_words)
    return False


# ---------------------------------------------------------------------------
# Finishers.com
# ---------------------------------------------------------------------------

_TRI_KEYWORDS = re.compile(
    r"triathlon|ironman|tri\b|70\.3|half.iron|aquathlon|swimrun", re.I
)

def build_finishers_index() -> list[dict]:
    """Télécharge le sitemap Finishers et retourne uniquement les slugs triathlon."""
    print("📡 Téléchargement du sitemap Finishers.com...", end=" ", flush=True)
    try:
        resp = requests.get(
            "https://www.finishers.com/sitemap/events.xml",
            headers=DEFAULT_HEADERS,
            timeout=60,
        )
        resp.raise_for_status()
        all_slugs = re.findall(
            r"<loc>https://www\.finishers\.com/course/([^<]+)</loc>", resp.text
        )
        # Garde uniquement les slugs liés au triathlon
        slugs = [s for s in all_slugs if _TRI_KEYWORDS.search(s)]
        print(f"{len(slugs)} slugs triathlon (/{len(all_slugs)} total)")
        return [{"slug": s, "name_slug": _slug(s.replace("-", " "))} for s in slugs]
    except Exception as e:
        print(f"erreur : {e}")
        return []


def find_finishers_match(
    race_name: str, race_city: str, index: list[dict], threshold: float = 0.65
) -> Optional[dict]:
    """
    Trouve le meilleur slug Finishers pour une course.

    Stratégie en 2 passes :
      1. Avec filtre ville (threshold bas) — rapide et précis
      2. Sans filtre ville (threshold plus haut) — pour les courses dont la ville
         dans le slug est la grande ville éponyme, pas la commune réelle
    """
    name_norm = _slug(race_name)

    def _best_in(items: list[dict], thresh: float) -> Optional[dict]:
        best_score = 0.0
        best = None
        for item in items:
            score = SequenceMatcher(None, name_norm, item["name_slug"]).ratio()
            if score > best_score:
                best_score = score
                best = item
        if best and best_score >= thresh:
            return {**best, "score": best_score}
        return None

    # Passe 1 : avec filtre ville
    city_filtered = [item for item in index if _city_in_slug(race_city, item["slug"])]
    match = _best_in(city_filtered, threshold)
    if match:
        return match

    # Passe 2 : sans filtre ville — seuil plus élevé pour éviter les faux positifs
    return _best_in(index, threshold + 0.10)


def scrape_finishers(slug: str, year: int) -> dict:
    """
    Scrape une page Finishers (nouveau format 2024+) et retourne les distances.

    Nouveau format : les distances sont dans page_props['races'][n]['activities']
    avec activity types : 'swimming' | 'cycling' | 'road'
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
        page_props = json.loads(script.string).get("props", {}).get("pageProps", {})

        # Cherche la course du bon format pour l'année cible
        page_races = page_props.get("races") or []

        # Mots-clés dans le nom qui indiquent une course secondaire à exclure
        _SECONDARY = re.compile(
            r"\b(jeune|relais|kids|junior|cadets?|enfant|poussins?|benjamins?|minimes?)\b", re.I
        )

        def _is_main_race(r: dict) -> bool:
            disc = r.get("discipline", "")
            # Garde triathlon (road et cross), exclut duathlon, swimrun, etc.
            if disc and disc not in ("triathlon", "cross_triathlon", ""):
                return False
            # Exclut les courses jeunes/relais
            name = r.get("name") or r.get("formattedTitle") or ""
            if _SECONDARY.search(name):
                return False
            # Exclut les distances nettement aberrantes (swim > 10km impossible)
            acts = r.get("activities") or []
            for act in acts:
                if act.get("activity") == "swimming":
                    dist = act.get("distance") or 0
                    if dist > 10000:
                        return False
            return True

        # Filtre par année si possible
        year_races = [
            r for r in page_races
            if isinstance(r, dict)
            and _is_main_race(r)
            and (not r.get("date") or str(year) in str(r.get("date", "")))
        ]
        if not year_races:
            year_races = [r for r in page_races if isinstance(r, dict) and _is_main_race(r)]
        if not year_races:
            return {}

        # Garde la course avec la plus grande distance totale (format principal)
        def _race_total(r: dict) -> int:
            return r.get("distance") or 0

        main_race = max(year_races, key=_race_total)
        activities = main_race.get("activities") or []

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
                bike = (bike or 0) + dist_m if bike else dist_m
            elif atype in ("road", "running", "trail"):
                # Pour le run: en triathlon, la dernière activité road est le run
                # Additionne si plusieurs segments
                run = (run or 0) + dist_m if run else dist_m

        if not swim:
            return {}

        result: dict = {"swim_distance": swim, "finishers_url": url}
        if bike:
            result["bike_distance"] = bike
        if run:
            result["run_distance"] = run
        total = (swim or 0) + (bike or 0) + (run or 0)
        if total:
            result["total_distance"] = total

        # Dénivelé
        elev = main_race.get("elevationGain")
        if elev:
            try:
                result["total_elevation"] = int(elev)
            except (ValueError, TypeError):
                pass

        # Prix (min sur toutes les courses du même événement)
        prices = [r.get("minPrice") for r in page_races if isinstance(r, dict) and r.get("minPrice")]
        if prices:
            try:
                result["price_euros"] = int(min(float(p) for p in prices))
            except (ValueError, TypeError):
                pass

        # Description depuis l'event overview
        event = page_props.get("event") or {}
        description = event.get("longDescription") or ""
        if description:
            # Retire les balises HTML basiques
            description = re.sub(r"<[^>]+>", " ", description)
            description = re.sub(r"\s+", " ", description).strip()
            if description:
                result["description"] = description[:500]

        # Image OG
        og = soup.find("meta", property="og:image")
        if og and og.get("content", "").startswith("http"):
            result["image_url"] = og["content"]

        return result
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# MilesRepublic
# ---------------------------------------------------------------------------

MR_BASE = "https://fr.milesrepublic.com"


def search_milesrepublic(race_name: str, race_city: str, year: int) -> dict:
    """
    Cherche la course sur MilesRepublic en paginant le listing triathlon.
    Retourne les distances si une correspondance est trouvée (score > 0.65).
    """
    name_norm = _slug(race_name)
    best_score = 0.0
    best_url = None

    for page in range(1, 8):  # max 7 pages (environ 350 courses)
        url = f"{MR_BASE}/triathlon" + (f"?page={page}" if page > 1 else "")
        try:
            resp = requests.get(url, headers=DEFAULT_HEADERS, timeout=20)
            if resp.status_code != 200:
                break
            soup = BeautifulSoup(resp.text, "lxml")

            # Cherche dans les JSON-LD Event
            for script in soup.find_all("script", type="application/ld+json"):
                try:
                    items = json.loads(script.string or "")
                    if not isinstance(items, list):
                        items = [items]
                    for item in items:
                        if item.get("@type") != "Event":
                            continue
                        item_name = item.get("name", "")
                        item_date = str(item.get("startDate", ""))
                        if str(year) not in item_date:
                            continue
                        # City match
                        addr = item.get("location", {}).get("address", {})
                        item_city = addr.get("addressLocality", "")
                        if not _city_in_slug(race_city, item_city):
                            continue
                        score = _similarity(race_name, item_name)
                        if score > best_score:
                            best_score = score
                            best_url = item.get("url") or item.get("@id")
                except Exception:
                    continue

            # Si bonne correspondance trouvée, inutile de paginer plus
            if best_score >= 0.80:
                break

            # Vérifie s'il y a une page suivante
            if not soup.find("a", href=re.compile(r"page=\d+")):
                break
        except Exception:
            break
        time.sleep(0.4)

    if best_score < 0.65 or not best_url:
        return {}

    # Scrape la page de détail MilesRepublic
    try:
        resp = requests.get(best_url, headers=DEFAULT_HEADERS, timeout=15)
        if resp.status_code != 200:
            return {}
        soup = BeautifulSoup(resp.text, "lxml")
        text = soup.get_text()

        swim = _find_distance(text, ["natation", "nage", "swim"])
        bike = _find_distance(text, ["vélo", "velo", "bike", "cyclisme"])
        run = _find_distance(text, ["course à pied", "course a pied", "cap", "run"])

        result: dict = {}
        if swim:
            result["swim_distance"] = swim
        if bike:
            result["bike_distance"] = bike
        if run:
            result["run_distance"] = run
        if result:
            result["total_distance"] = (swim or 0) + (bike or 0) + (run or 0) or None

        # Dénivelé
        elev_m = re.search(r"(\d{3,5})\s*m?\s*(?:D\+|d\+|dénivelé|denivele)", text, re.I)
        if elev_m:
            try:
                result["total_elevation"] = int(elev_m.group(1))
            except ValueError:
                pass

        # Image OG
        og = soup.find("meta", property="og:image")
        if og and og.get("content", "").startswith("http"):
            result["image_url"] = og["content"]

        return result
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=5000, help="Nombre max de courses à traiter")
    parser.add_argument("--dry-run", action="store_true", help="Affiche sans écrire en base")
    args = parser.parse_args()

    # 1. Récupérer les courses triathlon sans distances
    # On filtre par nom car le champ discipline est parfois incorrect dans la DB
    result = (
        sb.table("races")
        .select("id, name, city, country, date, website_url")
        .is_("swim_distance", "null")
        .ilike("name", "%triathlon%")
        .limit(args.limit)
        .execute()
    )
    races = result.data or []

    if not races:
        print("✓ Toutes les courses ont déjà des distances.")
        return

    print(f"\n📏 {len(races)} courses sans distances")
    year_default = 2026

    # 2. Construire l'index Finishers
    finishers_index = build_finishers_index()
    print()

    done = 0
    failed = 0
    sources: dict[str, int] = {"finishers": 0, "milesrepublic": 0}

    for i, race in enumerate(races):
        name = race.get("name", "")
        city = race.get("city", "")
        year = int(race["date"][:4]) if race.get("date") else year_default

        distances: dict = {}
        source_used = None

        # --- Finishers ---
        if finishers_index:
            match = find_finishers_match(name, city, finishers_index)
            if match:
                distances = scrape_finishers(match["slug"], year)
                if distances.get("swim_distance"):
                    source_used = f"Finishers ({match['score']:.2f})"
                    sources["finishers"] += 1
                time.sleep(0.35)

        # --- MilesRepublic (fallback) ---
        if not distances.get("swim_distance"):
            mr = search_milesrepublic(name, city, year)
            if mr.get("swim_distance"):
                distances.update(mr)
                source_used = "MilesRepublic"
                sources["milesrepublic"] += 1

        # --- Mise à jour Supabase ---
        if distances and not args.dry_run:
            try:
                sb.table("races").update(distances).eq("id", race["id"]).execute()
                done += 1
            except Exception as e:
                print(f"\n  ✗ DB error pour {name}: {e}")
                failed += 1
        elif distances and args.dry_run:
            done += 1
            print(f"\n  [DRY] {name} ({city}) → {source_used} : swim={distances.get('swim_distance')}m bike={distances.get('bike_distance')}m run={distances.get('run_distance')}m")
        else:
            failed += 1

        print(
            f"\r  ✓ {done} enrichies  ✗ {failed} sans résultat"
            f"  (Finishers:{sources['finishers']} MR:{sources['milesrepublic']})"
            f"  [{i+1}/{len(races)}]   ",
            end="",
            flush=True,
        )

    print(f"\n\n✓ Terminé : {done} enrichies, {failed} sans résultat")
    print(f"   Finishers : {sources['finishers']} | MilesRepublic : {sources['milesrepublic']}")


if __name__ == "__main__":
    main()
