"""
Enrichit la base Supabase en croisant les courses avec MilesRepublic.

Pour chaque course dans notre DB, cherche la correspondance sur MilesRepublic
via fuzzy matching (difflib), puis scrape la page detail pour enrichir :
  - image_url         (si null en DB)
  - latitude/longitude (si null en DB)
  - finishers_count   (si null en DB, depuis previousEditionAttendeesCount)
  - description       (si null en DB, depuis localizedContents)
  - formats           (si null en DB, depuis currentEdition.races)
  - price_euros       (si null en DB, depuis products[].price)

Structure __NEXT_DATA__ sur /event/[slug]-[id] :
  pageProps.event = {
    id, name, city, latitude, longitude, coverImage, images,
    localizedContents: [{review}],  -- description globale event
    currentEdition: {
      races: [{
        id, name, swimDistance (m), bikeDistance (km), runDistance (km),
        runPositiveElevation (m), bikePositiveElevation (m),
        products: [{price, openingDate, closingDate}],
        startDate
      }],
      localizedContents: [{usefulInformation, schedule}],
      mainRace: {...}
    }
  }
  pageProps.previousEditionAttendeesCount = {attendeesCount, editionYear}
  pageProps.attendeesFromEditionIdCount = <int>

Sources listing scrapees :
  /triathlon, /triathlon-xs, /triathlon-s, /triathlon-m, /triathlon-l,
  /triathlon-xxl, /cross-triathlon, /aquathlon, /duathlon, /swimrun

  Chaque page listing contient 42 JSON-LD Event + 42 liens /event/[slug]-[id]
  Jointure JSON-LD <-> lien par position dans la page (meme ordre garanti)
  Pagination : ?page=N (on incremente jusqu'a ce que les liens soient vides)

Usage :
    python scripts/enrich_milesrepublic.py             # toutes les courses
    python scripts/enrich_milesrepublic.py --dry-run   # affiche sans ecrire
    python scripts/enrich_milesrepublic.py --limit 50
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

# ---------------------------------------------------------------------------
# Charger .env.local (pattern exact depuis enrich_formats.py lignes 27-48)
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
    print("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_KEY requis dans .env.local")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}

MR_BASE = "https://fr.milesrepublic.com"

# Listing paths a scraper
MR_LISTING_PATHS = [
    "/triathlon",
    "/triathlon-xs",
    "/triathlon-s",
    "/triathlon-m",
    "/triathlon-l",
    "/triathlon-xxl",
    "/cross-triathlon",
    "/aquathlon",
    "/duathlon",
    "/swimrun",
]

# Mots-cles dans le nom indiquant un format secondaire (relais, jeunes)
_SECONDARY = re.compile(
    r"\b(relais|relay|equipe|x[23]|kids|junior|cadets?|enfant|poussins?|benjamins?|minimes?)\b",
    re.I,
)

# Mapping discipline -> label lisible
_DISC_LABEL = {
    "triathlon": "Triathlon",
    "cross_triathlon": "Cross Triathlon",
    "swimrun": "SwimRun",
    "duathlon": "Duathlon",
    "aquathlon": "Aquathlon",
}


# ---------------------------------------------------------------------------
# Normalisation (copie exacte depuis enrich_distances.py)
# ---------------------------------------------------------------------------

def _slug(text: str) -> str:
    """Normalise un texte en slug comparable : retire accents, annee, ponctuation."""
    t = unicodedata.normalize("NFD", text.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"\b20\d\d\b", "", t)          # retire les annees
    t = re.sub(r"[^a-z0-9]+", " ", t)         # garde seulement alphanum
    return t.strip()


def _city_in_slug(city: str, candidate: str) -> bool:
    """
    Verifie que la ville est presente dans la chaine candidate
    (matching mot entier — copie exacte depuis enrich_distances.py).
    """
    city_norm = _slug(city)
    slug_words = set(_slug(candidate.replace("-", " ")).split())
    if len(city_norm) < 3:
        return True  # ville trop courte pour etre discriminante
    for word in city_norm.split():
        if len(word) >= 4 and word in slug_words:
            return True
    # Fallback : au moins 6 chars du premier mot en commun (partial prefix)
    first_word = city_norm.split()[0] if city_norm.split() else ""
    if len(first_word) >= 6:
        return any(w.startswith(first_word[:6]) for w in slug_words)
    return False


def _best_in(items: list[dict], name_norm: str, thresh: float) -> Optional[dict]:
    """Retourne le meilleur match dans la liste ou None si sous le seuil."""
    best_score = 0.0
    best = None
    for item in items:
        score = SequenceMatcher(None, name_norm, item["name_norm"]).ratio()
        if score > best_score:
            best_score = score
            best = item
    if best and best_score >= thresh:
        return {**best, "score": best_score}
    return None


def find_milesrepublic_match(
    race_name: str, race_city: str, index: list[dict], threshold: float = 0.65
) -> Optional[dict]:
    """
    Trouve le meilleur evenement MilesRepublic pour une course.

    Strategie en 2 passes (copie depuis enrich_distances.py find_finishers_match) :
      1. Avec filtre ville (threshold bas) — rapide et precis
      2. Sans filtre ville (threshold + 0.10) — pour les cours dont la ville differe
    """
    name_norm = _slug(race_name)

    # Passe 1 : avec filtre ville (cherche dans slug MR et dans le nom de ville)
    city_filtered = [
        item for item in index
        if _city_in_slug(race_city, item.get("slug_mr", "") + " " + item.get("city", ""))
    ]
    match = _best_in(city_filtered, name_norm, threshold)
    if match:
        return match

    # Passe 2 : sans filtre ville — seuil plus eleve pour eviter les faux positifs
    return _best_in(index, name_norm, threshold + 0.10)


# ---------------------------------------------------------------------------
# Infer category depuis nom + distance totale (copie depuis enrich_formats.py)
# ---------------------------------------------------------------------------

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
    if "xs" in n or "decouverte" in n or "jeune" in n:
        return "XS"
    return "M"


# ---------------------------------------------------------------------------
# Construction de l'index MilesRepublic
# ---------------------------------------------------------------------------

def _extract_events_from_page(soup: BeautifulSoup) -> list[dict]:
    """
    Extrait les evenements depuis une page listing MilesRepublic.

    Strategie :
    1. Collecter tous les liens /event/[slug]-[id] (avec extraction de l'ID)
    2. Collecter tous les JSON-LD @type=Event dans le meme ordre
    3. Joindre par position (ordre identique garanti par le rendu SSR)

    Retourne une liste de {id, slug_mr, name, name_norm, city, detail_url}.
    """
    # --- Liens /event/ ---
    event_links: list[dict] = []
    seen_link_ids: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/event/" not in href:
            continue
        # Exclure les href d'ancre ou de parametres
        slug_m = re.search(r"/event/([^/?#]+)", href)
        if not slug_m:
            continue
        ev_slug = slug_m.group(1)
        # Extraire l'ID numerique en fin de slug
        id_m = re.search(r"-(\d+)$", ev_slug)
        if not id_m:
            continue
        ev_id = id_m.group(1)
        if ev_id in seen_link_ids:
            continue
        seen_link_ids.add(ev_id)
        full_url = href if href.startswith("http") else MR_BASE + href
        event_links.append({"id": ev_id, "slug_mr": ev_slug, "detail_url": full_url})

    # --- JSON-LD Event ---
    jsonld_events: list[dict] = []
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            items = data if isinstance(data, list) else [data]
            for item in items:
                if item.get("@type") == "Event":
                    jsonld_events.append(item)
        except (json.JSONDecodeError, AttributeError):
            continue

    # --- Jointure par position ---
    entries: list[dict] = []
    for i, lnk in enumerate(event_links):
        ev_name = ""
        ev_city = ""
        if i < len(jsonld_events):
            jld = jsonld_events[i]
            ev_name = jld.get("name") or ""
            addr = {}
            loc = jld.get("location", {})
            if isinstance(loc, dict):
                addr = loc.get("address", {}) or {}
            if isinstance(addr, dict):
                ev_city = addr.get("addressLocality") or ""
        entries.append({
            "id": lnk["id"],
            "slug_mr": lnk["slug_mr"],
            "name": ev_name,
            "name_norm": _slug(ev_name),
            "city": ev_city,
            "detail_url": lnk["detail_url"],
        })

    return entries


def build_milesrepublic_index() -> list[dict]:
    """
    Scrape tous les listings MilesRepublic et retourne un index plat.

    Chaque entree : {id, slug_mr, name, name_norm, city, detail_url}
    Deduplique par ID numerique MilesRepublic.
    """
    index: list[dict] = []
    seen_ids: set[str] = set()

    for path in MR_LISTING_PATHS:
        print(f"  Listing {path}...", end=" ", flush=True)
        path_count = 0
        page_num = 1
        max_pages = 30

        while page_num <= max_pages:
            url = MR_BASE + path + (f"?page={page_num}" if page_num > 1 else "")
            try:
                resp = requests.get(url, headers=HEADERS, timeout=15)
                if resp.status_code != 200:
                    break
                soup = BeautifulSoup(resp.text, "lxml")
                entries = _extract_events_from_page(soup)

                new_this_page = 0
                for entry in entries:
                    if entry["id"] not in seen_ids:
                        seen_ids.add(entry["id"])
                        index.append(entry)
                        new_this_page += 1

                path_count += new_this_page

                # Pagination : chercher des liens ?page=N dans la page
                has_next = bool(soup.find("a", href=re.compile(r"[?&]page=\d+")))
                if not has_next or new_this_page == 0:
                    break
                page_num += 1
                time.sleep(0.4)

            except Exception as e:
                print(f"erreur page {page_num}: {e}")
                break

        print(f"{path_count} evenements ({page_num} page(s))")

    print(f"  => Index total : {len(index)} evenements MilesRepublic\n")
    return index


# ---------------------------------------------------------------------------
# Scrape page detail MilesRepublic
# ---------------------------------------------------------------------------

def _parse_description(event: dict) -> Optional[str]:
    """
    Extrait la meilleure description depuis l'objet event MilesRepublic.

    Cherche dans :
    - event.currentEdition.localizedContents[].usefulInformation
    - event.localizedContents[].review
    """
    # Edition : usefulInformation
    ce = event.get("currentEdition") or {}
    lc_edition = ce.get("localizedContents") or []
    for item in (lc_edition if isinstance(lc_edition, list) else []):
        if isinstance(item, dict):
            text = item.get("usefulInformation") or item.get("schedule") or ""
            if text and len(text) > 30:
                clean = re.sub(r"<[^>]+>", " ", text)
                clean = re.sub(r"\s+", " ", clean).strip()
                if clean:
                    return clean[:1000]

    # Event global : review
    lc_event = event.get("localizedContents") or []
    for item in (lc_event if isinstance(lc_event, list) else []):
        if isinstance(item, dict):
            text = item.get("review") or ""
            if text and len(text) > 30:
                clean = re.sub(r"<[^>]+>", " ", text)
                clean = re.sub(r"\s+", " ", clean).strip()
                if clean:
                    return clean[:1000]

    return None


def _build_formats_from_edition(ce: dict) -> list[dict]:
    """
    Construit la liste de formats depuis currentEdition.races de MilesRepublic.

    Distances MilesRepublic :
    - swimDistance : en metres
    - bikeDistance : en kilometres
    - runDistance  : en kilometres
    - runPositiveElevation / bikePositiveElevation : en metres D+

    Prix : dans products[].price (EUR)
    """
    races_raw = ce.get("races") or []
    formats: list[dict] = []
    seen_combos: set[tuple] = set()

    for r in races_raw:
        if not isinstance(r, dict):
            continue

        race_name = r.get("name") or ""
        is_relay = bool(_SECONDARY.search(race_name))

        # Distances — conversion en metres
        swim_raw = r.get("swimDistance")  # metres
        bike_raw = r.get("bikeDistance")  # km
        run_raw = r.get("runDistance")    # km

        try:
            swim = int(swim_raw) if swim_raw else None
        except (ValueError, TypeError):
            swim = None
        try:
            bike = int(float(bike_raw) * 1000) if bike_raw else None
        except (ValueError, TypeError):
            bike = None
        try:
            run = int(float(run_raw) * 1000) if run_raw else None
        except (ValueError, TypeError):
            run = None

        # Validation basique
        if swim and swim > 10_000:
            continue  # aberrant

        total = (swim or 0) + (bike or 0) + (run or 0)

        # Deduplique par combo (swim, bike, run, is_relay)
        combo = (swim, bike, run, is_relay)
        if combo in seen_combos:
            continue
        seen_combos.add(combo)

        # Deduire la categorie
        category = _infer_category(race_name, total)

        # Elevation
        run_elev = r.get("runPositiveElevation") or 0
        bike_elev = r.get("bikePositiveElevation") or 0
        try:
            total_elev = int(run_elev) + int(bike_elev)
            elev_int = total_elev if 0 < total_elev < 6000 else None
        except (ValueError, TypeError):
            elev_int = None

        # Prix depuis products
        products = r.get("products") or []
        prices_raw = [p.get("price") for p in products if isinstance(p, dict) and p.get("price")]
        price_int = None
        if prices_raw:
            try:
                price_int = int(float(min(prices_raw)))
            except (ValueError, TypeError):
                pass

        # Date
        date_raw = r.get("startDate") or ce.get("startDate")
        race_date = None
        if date_raw:
            date_m = re.search(r"(\d{4}-\d{2}-\d{2})", str(date_raw))
            if date_m:
                race_date = date_m.group(1)

        # Discipline depuis le nom
        disc_key = "triathlon"
        name_lower = race_name.lower()
        if "duathlon" in name_lower:
            disc_key = "duathlon"
        elif "swimrun" in name_lower or "swim run" in name_lower:
            disc_key = "swimrun"
        elif "aquathlon" in name_lower:
            disc_key = "aquathlon"
        elif "cross" in name_lower:
            disc_key = "cross_triathlon"

        formats.append({
            "name": race_name or _DISC_LABEL.get(disc_key, "Triathlon"),
            "discipline": _DISC_LABEL.get(disc_key, "Triathlon"),
            "category": category,
            "swim": swim,
            "bike": bike,
            "run": run,
            "total": total or None,
            "price": price_int,
            "elevation": elev_int,
            "date": race_date,
            "is_relay": is_relay,
        })

    return formats


def scrape_detail(detail_url: str) -> dict:
    """
    Scrape une page detail MilesRepublic (/event/[slug]-[id]).

    Utilise __NEXT_DATA__ -> pageProps.event + pageProps.previousEditionAttendeesCount.
    Fallback sur og:image / JSON-LD si __NEXT_DATA__ absent ou incomplet.

    Retourne un dict avec les cles presentes seulement si elles ont une valeur.
    Ne pas appeler si toutes les donnees sont deja en DB.
    """
    try:
        resp = requests.get(detail_url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            return {}
        soup = BeautifulSoup(resp.text, "lxml")
    except Exception:
        return {}

    result: dict = {}

    # --- __NEXT_DATA__ ---
    nd_tag = soup.find("script", id="__NEXT_DATA__")
    if nd_tag and nd_tag.string:
        try:
            nd = json.loads(nd_tag.string)
            props = nd.get("props", {}).get("pageProps", {})
            event = props.get("event") or {}

            # image_url : coverImage ou premier element de images
            cover = event.get("coverImage")
            if isinstance(cover, str) and cover.startswith("http"):
                result["image_url"] = cover
            elif not cover:
                imgs = event.get("images") or []
                if imgs and isinstance(imgs[0], str) and imgs[0].startswith("http"):
                    result["image_url"] = imgs[0]

            # latitude / longitude
            lat = event.get("latitude")
            lon = event.get("longitude")
            if lat is not None and lon is not None:
                try:
                    result["latitude"] = float(lat)
                    result["longitude"] = float(lon)
                except (ValueError, TypeError):
                    pass

            # finishers_count depuis previousEditionAttendeesCount
            prev = props.get("previousEditionAttendeesCount") or {}
            if isinstance(prev, dict):
                count = prev.get("attendeesCount")
                if count:
                    try:
                        result["finishers_count"] = int(count)
                    except (ValueError, TypeError):
                        pass
            # Fallback : attendeesFromEditionIdCount
            if "finishers_count" not in result:
                acount = props.get("attendeesFromEditionIdCount")
                if acount:
                    try:
                        result["finishers_count"] = int(acount)
                    except (ValueError, TypeError):
                        pass

            # description depuis localizedContents (edition + event)
            desc = _parse_description(event)
            if desc:
                result["description"] = desc

            # formats depuis currentEdition.races
            ce = event.get("currentEdition") or {}
            formats = _build_formats_from_edition(ce)
            if formats:
                result["formats"] = formats

            # price_euros : minimum sur toutes les races de l'edition
            races_raw = ce.get("races") or []
            all_prices: list[float] = []
            for r in races_raw:
                if not isinstance(r, dict):
                    continue
                for p in (r.get("products") or []):
                    if isinstance(p, dict) and p.get("price"):
                        try:
                            all_prices.append(float(p["price"]))
                        except (ValueError, TypeError):
                            pass
            if all_prices:
                result["price_euros"] = int(min(all_prices))

        except (json.JSONDecodeError, AttributeError, KeyError):
            pass

    # --- Fallback og:image ---
    if "image_url" not in result:
        og = soup.find("meta", property="og:image")
        if og and isinstance(og.get("content"), str) and og["content"].startswith("http"):
            result["image_url"] = og["content"]

    # --- Fallback JSON-LD pour lat/lon ---
    if "latitude" not in result:
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string or "")
                items = data if isinstance(data, list) else [data]
                for item in items:
                    if item.get("@type") not in ("Event", "SportsEvent"):
                        continue
                    loc = item.get("location", {})
                    geo = loc.get("geo", {}) if isinstance(loc, dict) else {}
                    if isinstance(geo, dict) and geo.get("latitude"):
                        try:
                            result["latitude"] = float(geo["latitude"])
                            result["longitude"] = float(geo["longitude"])
                        except (ValueError, TypeError):
                            pass
                        break
            except (json.JSONDecodeError, AttributeError):
                continue
            if "latitude" in result:
                break

    return result


# ---------------------------------------------------------------------------
# Helpers d'affichage
# ---------------------------------------------------------------------------

def _fmt_dist(val: Optional[int], unit: str = "m") -> str:
    if val is None:
        return "--"
    if unit == "km":
        return f"{val // 1000}km"
    return f"{val}m"


def _fmt_val(v: object) -> str:
    if v is None:
        return "--"
    return str(v)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Enrichit la DB Supabase depuis MilesRepublic"
    )
    parser.add_argument(
        "--limit", type=int, default=5000,
        help="Nombre max de courses a traiter (defaut: 5000)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Affiche les enrichissements sans ecrire en base"
    )
    args = parser.parse_args()

    # 1. Construire l'index MilesRepublic
    print("Construction de l'index MilesRepublic...")
    mr_index = build_milesrepublic_index()

    if not mr_index:
        print("Index MilesRepublic vide — verifier la connexion ou la structure HTML.")
        sys.exit(1)

    # 2. Recuperer les courses depuis Supabase
    print("Recuperation des courses depuis Supabase...")
    res = (
        sb.table("races")
        .select(
            "id, name, city, country, date, "
            "image_url, latitude, longitude, "
            "finishers_count, description, formats, price_euros"
        )
        .limit(args.limit)
        .execute()
    )
    all_races = res.data or []

    # Garder seulement les courses avec au moins un champ enrichissable null
    races = [
        r for r in all_races
        if (
            r.get("image_url") is None
            or r.get("latitude") is None
            or r.get("finishers_count") is None
            or r.get("description") is None
            or r.get("formats") is None
            or r.get("price_euros") is None
        )
    ]

    if not races:
        print("Toutes les courses sont deja completement enrichies.")
        return

    print(f"{len(races)} courses avec au moins un champ null a enrichir\n")

    done = 0
    skipped = 0
    no_match = 0

    for i, race in enumerate(races):
        name = race.get("name", "")
        city = race.get("city", "") or ""

        # 3. Trouver la correspondance dans l'index MilesRepublic
        match = find_milesrepublic_match(name, city, mr_index)

        if not match:
            no_match += 1
            print(
                f"\r  {done} enrichies  {no_match} sans match  {skipped} sautees"
                f"  [{i+1}/{len(races)}]   ",
                end="",
                flush=True,
            )
            continue

        detail_url = match.get("detail_url")
        if not detail_url:
            no_match += 1
            continue

        # 4. Scraper la page detail
        detail = scrape_detail(detail_url)
        time.sleep(0.4)

        if not detail:
            no_match += 1
            print(
                f"\r  {done} enrichies  {no_match} sans match  {skipped} sautees"
                f"  [{i+1}/{len(races)}]   ",
                end="",
                flush=True,
            )
            continue

        # 5. Filtrer : ne garder que les champs NULL en DB (pas d'ecrasement)
        update: dict = {}
        if race.get("image_url") is None and "image_url" in detail:
            update["image_url"] = detail["image_url"]
        if race.get("latitude") is None and "latitude" in detail:
            update["latitude"] = detail["latitude"]
            if "longitude" in detail:
                update["longitude"] = detail["longitude"]
        if race.get("finishers_count") is None and "finishers_count" in detail:
            update["finishers_count"] = detail["finishers_count"]
        if race.get("description") is None and "description" in detail:
            update["description"] = detail["description"]
        if race.get("formats") is None and detail.get("formats"):
            update["formats"] = detail["formats"]
        if race.get("price_euros") is None and "price_euros" in detail:
            update["price_euros"] = detail["price_euros"]

        if not update:
            # Correspondance trouvee mais rien de nouveau a ecrire
            skipped += 1
            print(
                f"\r  {done} enrichies  {no_match} sans match  {skipped} sautees"
                f"  [{i+1}/{len(races)}]   ",
                end="",
                flush=True,
            )
            continue

        # 6. Afficher (dry-run) ou ecrire en DB
        if args.dry_run:
            done += 1
            print(f"\n  [DRY] {name} ({city})")
            print(
                f"        match : {match.get('name', '?')} ({match.get('city', '')})"
                f"  score={match['score']:.2f}"
            )
            print(f"        url   : {detail_url}")
            if "image_url" in update:
                print(f"        image : {update['image_url'][:80]}")
            if "latitude" in update:
                print(
                    f"        geo   : lat={update['latitude']:.5f}"
                    f"  lon={update.get('longitude', 0):.5f}"
                )
            if "finishers_count" in update:
                print(f"        finishers_count : {update['finishers_count']}")
            if "description" in update:
                print(f"        description : {update['description'][:80]}...")
            if "price_euros" in update:
                print(f"        price : {update['price_euros']} EUR")
            if "formats" in update:
                fmts = update["formats"]
                print(f"        formats : {len(fmts)} formats")
                for f in fmts:
                    swim = _fmt_dist(f.get("swim"))
                    bike = _fmt_dist(f.get("bike"), "km")
                    run = _fmt_dist(f.get("run"), "km")
                    price_s = f"{f['price']}EUR" if f.get("price") else "--"
                    relay_s = " [RELAIS]" if f.get("is_relay") else ""
                    print(
                        f"          {f['category']:8} {f['name'][:35]:35} "
                        f"swim={swim:6} bike={bike:7} run={run:6} {price_s}{relay_s}"
                    )
        else:
            try:
                sb.table("races").update(update).eq("id", race["id"]).execute()
                done += 1
            except Exception as e:
                print(f"\n  Erreur DB pour {name}: {e}")
                skipped += 1

        print(
            f"\r  {done} enrichies  {no_match} sans match  {skipped} sautees"
            f"  [{i+1}/{len(races)}]   ",
            end="",
            flush=True,
        )

    mode_label = "[DRY-RUN] " if args.dry_run else ""
    print(
        f"\n\n{mode_label}Termine : {done} enrichies,"
        f" {no_match} sans match, {skipped} sautees"
    )


if __name__ == "__main__":
    main()
