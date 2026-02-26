"""
Monitor Finishers.com pour de nouvelles courses de triathlon en France.

Fetche https://www.finishers.com/en/activities/triathlon/triathlons-in-france,
extrait les événements depuis __NEXT_DATA__ (SSR Next.js) ou les liens <a>,
compare avec scripts/data/finishers-triathlon-known.json et signale les nouveautés.

Usage :
    python scripts/monitor_finishers.py              # affiche les nouveaux slugs
    python scripts/monitor_finishers.py --update     # met à jour le fichier de référence
    python scripts/monitor_finishers.py --output json  # sortie JSON (pour CI/GitHub Actions)

Exit codes :
    0 — aucune nouveauté (ou --update réussi)
    1 — nouvelles courses détectées
    2 — erreur (réseau, parsing)
"""

import argparse
import json
import os
import pathlib
import re
import sys
import time
from typing import Optional

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(__file__))
from utils import DEFAULT_HEADERS

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

# Page triathlon France — seule URL valide côté SSR.
# Finishers utilise un infinite scroll côté client : le HTML SSR ne rend
# que les ~4-10 premiers événements à venir (triés par date croissante).
# Les nouvelles courses pour les prochaines semaines apparaissent donc
# en tête de liste et seront bien détectées chaque lundi.
ACTIVITIES_URLS = [
    "https://www.finishers.com/en/activities/triathlon/triathlons-in-france",
]

KNOWN_FILE = pathlib.Path(__file__).parent / "data" / "finishers-triathlon-known.json"

# Disciplines à garder (on exclut cross_triathlon, duathlon, running, trail...)
TRIATHLON_DISCIPLINES = {"triathlon", "triathlon_xxl", ""}


# ---------------------------------------------------------------------------
# Chargement / sauvegarde du fichier de référence
# ---------------------------------------------------------------------------

def load_known() -> set[str]:
    """Charge le set de slugs connus depuis le fichier JSON."""
    if not KNOWN_FILE.exists():
        return set()
    try:
        data = json.loads(KNOWN_FILE.read_text(encoding="utf-8"))
        return set(data.get("slugs", []))
    except (json.JSONDecodeError, OSError):
        return set()


def save_known(slugs: set[str], new_count: int = 0) -> None:
    """Sauvegarde le set de slugs dans le fichier JSON."""
    KNOWN_FILE.parent.mkdir(parents=True, exist_ok=True)
    from datetime import date
    payload = {
        "last_update": date.today().isoformat(),
        "count": len(slugs),
        "slugs": sorted(slugs),
    }
    KNOWN_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    if new_count:
        print(f"  Fichier de référence mis à jour : {len(slugs)} slugs (+{new_count} nouveaux)")
    else:
        print(f"  Fichier de référence initialisé : {len(slugs)} slugs")


# ---------------------------------------------------------------------------
# Extraction des événements depuis __NEXT_DATA__
# ---------------------------------------------------------------------------

def _events_from_dehydrated(page_props: dict) -> list[dict]:
    """
    TanStack Query stocke les données dans dehydratedState.queries[].state.data.
    Format paginated : { pages: [{ events: [...] }] }
    Format direct    : { events: [...] }
    """
    state = page_props.get("dehydratedState") or {}
    queries = state.get("queries") or []

    for query in queries:
        data = (query.get("state") or {}).get("data") or {}

        # Format paginé
        pages = data.get("pages") or []
        for page in pages:
            for key in ("events", "activities", "items", "results"):
                events = page.get(key) or []
                if events:
                    return [e for e in events if isinstance(e, dict)]

        # Format direct
        for key in ("events", "activities", "items", "results"):
            events = data.get(key) or []
            if events:
                return [e for e in events if isinstance(e, dict)]

    return []


def _events_from_page_props(page_props: dict) -> list[dict]:
    """Tente d'extraire les événements directement depuis pageProps."""
    for key in ("events", "activities", "races", "items", "results"):
        events = page_props.get(key) or []
        if events and isinstance(events, list):
            return [e for e in events if isinstance(e, dict)]
    return []


def extract_events_from_html(html: str) -> list[dict]:
    """
    Extrait les événements triathlon depuis le HTML d'une page Finishers.

    Ordre de tentative :
    1. __NEXT_DATA__ → dehydratedState (TanStack Query)
    2. __NEXT_DATA__ → pageProps direct
    3. Fallback : liens <a href="/course/..."> ou </en/event/...>
    """
    soup = BeautifulSoup(html, "lxml")
    script = soup.find("script", id="__NEXT_DATA__")

    events: list[dict] = []

    if script and script.string:
        try:
            next_data = json.loads(script.string)
            page_props = next_data.get("props", {}).get("pageProps", {})

            events = _events_from_dehydrated(page_props)
            if not events:
                events = _events_from_page_props(page_props)

        except (json.JSONDecodeError, AttributeError):
            pass

    # Fallback HTML si __NEXT_DATA__ ne donne rien
    if not events:
        seen: set[str] = set()
        for a in soup.find_all("a", href=re.compile(r"/(?:course|en/event)/[^/?#]+")):
            href = a.get("href", "")
            m = re.search(r"/(?:course|en/event)/([^/?#]+)", href)
            if m:
                slug = m.group(1)
                if slug not in seen:
                    seen.add(slug)
                    events.append({"slug": slug, "name": a.get_text(strip=True)})

    return events


def normalize_event(raw: dict) -> Optional[dict]:
    """
    Normalise un événement brut en extrayant slug, name, discipline, country, date.
    Retourne None si l'événement est inutilisable.
    """
    # Slug : peut s'appeler "slug", "id", ou être dans l'URL "href"
    slug = (
        raw.get("slug")
        or raw.get("id")
        or ""
    )
    # Certaines API renvoient l'URL complète en guise de slug
    if "/" in str(slug):
        m = re.search(r"/(?:course|en/event)/([^/?#]+)", str(slug))
        slug = m.group(1) if m else ""

    if not slug:
        return None

    discipline = (raw.get("discipline") or raw.get("sport") or "").lower().strip()
    country = (
        raw.get("country")
        or raw.get("countryCode")
        or (raw.get("location") or {}).get("country")
        or ""
    ).upper()

    return {
        "slug": slug,
        "name": raw.get("name") or raw.get("title") or slug,
        "discipline": discipline,
        "country": country,
        "date": raw.get("nextDate") or raw.get("date") or raw.get("nextEditionDate") or "",
    }


# ---------------------------------------------------------------------------
# Filtrage : garder uniquement les triathlons France
# ---------------------------------------------------------------------------

def is_triathlon_france(event: dict) -> bool:
    """
    Retourne True si l'événement est un triathlon en France.
    On exclut cross-triathlon, duathlon, aquathlon, trail, running…
    Note : si discipline est vide (fallback HTML), on garde l'événement
    car la page est déjà filtrée par activité/pays.
    """
    discipline = event.get("discipline", "")
    if discipline and discipline not in TRIATHLON_DISCIPLINES:
        return False

    country = event.get("country", "")
    if country and country not in ("FR", "FRA", "FRANCE", ""):
        return False

    return True


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

def fetch_page(url: str) -> Optional[str]:
    """Fetch une page Finishers et retourne le HTML."""
    try:
        resp = requests.get(url, headers=DEFAULT_HEADERS, timeout=20)
        if resp.status_code == 200:
            return resp.text
        print(f"  HTTP {resp.status_code} pour {url}", file=sys.stderr)
        return None
    except requests.RequestException as e:
        print(f"  Erreur réseau : {e}", file=sys.stderr)
        return None


def fetch_all_events() -> list[dict]:
    """
    Fetche plusieurs pages de catégorie sur Finishers pour maximiser la couverture.
    Finishers utilise un infinite scroll côté client → seule la première page est
    disponible dans le HTML SSR (__NEXT_DATA__). On compense en fetchant chaque
    sous-catégorie (sprint, olympic, half, ironman…) séparément.
    """
    seen_slugs: set[str] = set()
    all_events: list[dict] = []

    for url in ACTIVITIES_URLS:
        html = fetch_page(url)
        if not html:
            time.sleep(1)
            continue

        raw_events = extract_events_from_html(html)
        for raw in raw_events:
            normalized = normalize_event(raw)
            if normalized and is_triathlon_france(normalized):
                slug = normalized["slug"]
                if slug not in seen_slugs:
                    seen_slugs.add(slug)
                    all_events.append(normalized)

        time.sleep(0.5)  # politesse réseau

    return all_events


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Détecte les nouvelles courses triathlon France sur Finishers.com"
    )
    parser.add_argument(
        "--update",
        action="store_true",
        help="Met à jour le fichier de référence avec les slugs détectés",
    )
    parser.add_argument(
        "--output",
        choices=["text", "json"],
        default="text",
        help="Format de sortie (défaut: text)",
    )
    args = parser.parse_args()

    # 1. Charger les slugs connus
    known_slugs = load_known()
    is_first_run = len(known_slugs) == 0

    # 2. Fetcher les événements actuels
    print("  Fetch Finishers.com…", file=sys.stderr)
    events = fetch_all_events()

    if not events:
        print("  Aucun événement récupéré (vérifier la connexion ou la structure de la page).", file=sys.stderr)
        return 2

    print(f"  {len(events)} événements triathlon France détectés.", file=sys.stderr)

    current_slugs = {e["slug"] for e in events}
    new_slugs = current_slugs - known_slugs
    new_events = [e for e in events if e["slug"] in new_slugs]

    # 3. Afficher les résultats
    if args.output == "json":
        print(json.dumps({
            "new_count": len(new_events),
            "total_detected": len(events),
            "known_count": len(known_slugs),
            "new_events": new_events,
        }, ensure_ascii=False, indent=2))
    else:
        if is_first_run:
            print(f"\n  Premier lancement — {len(events)} courses détectées.")
            print("  Lancez avec --update pour initialiser le fichier de référence.\n")
            for e in sorted(events, key=lambda x: x.get("date", "")):
                print(f"  {e['slug']:50s}  {e.get('name', '')}")
        elif new_events:
            print(f"\n  {len(new_events)} nouvelle(s) course(s) détectée(s) :\n")
            for e in sorted(new_events, key=lambda x: x.get("date", "")):
                print(f"  + {e['slug']:50s}  {e.get('name', '')}")
            print()
        else:
            print("\n  Aucune nouvelle course détectée.\n")

    # 4. Mettre à jour le fichier de référence si demandé
    if args.update:
        updated_slugs = known_slugs | current_slugs
        save_known(updated_slugs, new_count=len(new_slugs))
        return 0

    # Exit code 1 si nouvelles courses (utile pour CI)
    return 1 if new_events and not is_first_run else 0


if __name__ == "__main__":
    sys.exit(main())
