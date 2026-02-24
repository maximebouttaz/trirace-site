"""
Corrige les website_url pointant vers fftri.t2area.com en scrapant
le vrai lien "Site internet Organisateur" sur chaque page FFTRI.

Usage :
    python scripts/fix_website_urls.py --dry-run          # test sans écriture
    python scripts/fix_website_urls.py --dry-run --limit 50
    python scripts/fix_website_urls.py                     # mise à jour réelle
    python scripts/fix_website_urls.py --limit 100

Requis : NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY dans .env.local (racine)
"""

import argparse
import os
import pathlib
import re
import sys
import time

import requests
from bs4 import BeautifulSoup
from supabase import create_client
from typing import Optional

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

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept-Language": "fr-FR,fr;q=0.9",
}

# Domaines à ignorer même si trouvés comme "site officiel"
BLOCKED_DOMAINS = {"fftri", "t2area", "facebook", "instagram", "google"}

# Textes d'ancrage possibles sur les pages FFTRI pour le site organisateur
ANCHOR_PATTERNS = [
    re.compile(r"site\s+internet\s+organisateur", re.I),
    re.compile(r"site\s+officiel", re.I),
    re.compile(r"site\s+web", re.I),
    re.compile(r"site\s+de\s+l.organisateur", re.I),
]


def _is_blocked(url: str) -> bool:
    """Retourne True si l'URL appartient à un domaine interdit."""
    url_lower = url.lower()
    return any(domain in url_lower for domain in BLOCKED_DOMAINS)


def extract_official_url(html: str) -> Optional[str]:
    """
    Parse le HTML d'une page fftri.t2area.com et retourne l'URL du site
    officiel de l'organisateur, ou None si introuvable / inacceptable.
    """
    soup = BeautifulSoup(html, "lxml")

    # Stratégie 1 : chercher un <a> dont le texte correspond aux patterns
    for pattern in ANCHOR_PATTERNS:
        for tag in soup.find_all("a", href=True):
            text = tag.get_text(separator=" ").strip()
            if pattern.search(text):
                href = tag["href"].strip()
                if href.startswith("http") and not _is_blocked(href):
                    return href

    # Stratégie 2 : chercher un <a> avec classe ou id contenant "website"/"site"
    for tag in soup.find_all("a", href=True):
        classes = tag.get("class") or []
        class_str = " ".join(classes) if isinstance(classes, list) else str(classes)
        css = class_str + " " + (tag.get("id") or "")
        if re.search(r"website|site.internet|site.web|site.org", css, re.I):
            href = tag["href"].strip()
            if href.startswith("http") and not _is_blocked(href):
                return href

    return None


def main():
    parser = argparse.ArgumentParser(
        description="Corrige les website_url fftri.t2area.com en URLs organisateurs réelles"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Affiche les résultats sans écrire en base",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10_000,
        help="Nombre maximum de courses à traiter (défaut: toutes)",
    )
    args = parser.parse_args()

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # --- Récupérer les courses concernées ---
    print("Chargement des courses avec URL fftri/t2area...", flush=True)
    result = (
        sb.table("races")
        .select("id, slug, name, website_url")
        .or_("website_url.ilike.%fftri%,website_url.ilike.%t2area%")
        .limit(args.limit)
        .execute()
    )
    races = result.data or []

    if not races:
        print("Aucune course avec une URL fftri/t2area trouvee.")
        return

    total = len(races)
    print(f"{total} courses a traiter\n")

    if args.dry_run:
        print("[DRY-RUN] Aucune ecriture en base\n")

    updated = 0
    no_site = 0
    errors = 0

    for i, race in enumerate(races):
        race_id = race["id"]
        slug = race.get("slug", "?")
        name = race.get("name", "?")
        current_url = race.get("website_url", "")

        new_url = None

        if current_url:
            try:
                resp = requests.get(current_url, headers=HEADERS, timeout=15)
                resp.raise_for_status()
                new_url = extract_official_url(resp.text)
            except requests.RequestException as exc:
                errors += 1
                print(
                    f"\r  Erreur HTTP pour {slug} : {exc}                    ",
                    flush=True,
                )
                time.sleep(0.3)
                print(
                    f"\r  OK {updated} mis a jour  X {no_site} sans site  ! {errors} erreurs  [{i+1}/{total}]   ",
                    end="",
                    flush=True,
                )
                continue

        if new_url:
            if args.dry_run:
                print(
                    f"\r  [DRY] {name[:50]} -> {new_url[:60]}                    ",
                    flush=True,
                )
            else:
                try:
                    sb.table("races").update({"website_url": new_url}).eq("id", race_id).execute()
                except Exception as exc:
                    errors += 1
                    print(f"\r  DB error pour {slug} : {exc}     ", flush=True)
                    time.sleep(0.3)
                    print(
                        f"\r  OK {updated} mis a jour  X {no_site} sans site  ! {errors} erreurs  [{i+1}/{total}]   ",
                        end="",
                        flush=True,
                    )
                    continue
            updated += 1
        else:
            no_site += 1

        print(
            f"\r  OK {updated} mis a jour  X {no_site} sans site  ! {errors} erreurs  [{i+1}/{total}]   ",
            end="",
            flush=True,
        )
        time.sleep(0.3)

    print(f"\n\nTermine :")
    print(f"  Mis a jour  : {updated}")
    print(f"  Sans site   : {no_site}")
    print(f"  Erreurs     : {errors}")
    print(f"  Total traite: {total}")


if __name__ == "__main__":
    main()
