"""
Infere swim_type depuis la description et les tags existants.

Valeurs possibles : "lac", "etang", "mer", "riviere", "piscine", "open water"

Usage :
    python scripts/enrich_swim_type.py --dry-run          # test sans ecriture
    python scripts/enrich_swim_type.py --dry-run --limit 50
    python scripts/enrich_swim_type.py                     # mise a jour reelle
    python scripts/enrich_swim_type.py --limit 100

Requis : NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY dans .env.local (racine)
"""

import argparse
import os
import pathlib
import re
import sys

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
# Regles de detection par description (priorite decroissante)
# La description prime toujours sur les tags.
# L'ordre dans cette liste est significant : on prend la PREMIERE regle qui match.
#
# Valeurs acceptees par la contrainte CHECK en base :
#   "lac", "mer", "piscine", "open water"
# Les etangs, rivieres, fleuves, canaux sont regroupes dans "lac" (plan d'eau douce)
# ---------------------------------------------------------------------------

DESCRIPTION_RULES: list[tuple[str, re.Pattern]] = [
    # open water doit etre teste avant mer/lac pour eviter les faux positifs
    ("open water",  re.compile(r"open\s+water", re.I)),
    ("piscine",     re.compile(r"\bpiscine\b|bassin|indoor|couvert", re.I)),
    ("mer",         re.compile(
        r"\bmer\b|oc[eé]an|marin|maritime|plage|littoral|c[oô]te|atlantique|m[eé]diterran[eé]e|manche",
        re.I,
    )),
    # etangs, lacs, rivieres, fleuves, canaux → tous mappés "lac" (eau douce plan d'eau)
    ("lac",         re.compile(
        r"\blac\b|plan\s+d.eau|retenue|barrage|r[eé]servoir"
        r"|\b[eé]tang\b|[eé]tangs"
        r"|\brivi[eè]re\b|fleuve|canal|cours\s+d.eau",
        re.I,
    )),
]

# ---------------------------------------------------------------------------
# Regles de detection par tags Finishers
# ---------------------------------------------------------------------------

TAG_RULES: list[tuple[str, re.Pattern]] = [
    ("open water",  re.compile(r"open.?water", re.I)),
    ("piscine",     re.compile(r"pool|piscine", re.I)),
    ("mer",         re.compile(r"\bsea\b|ocean|mer\b|seaside|maritime|beach", re.I)),
    # etangs, ponds, lacs, rivieres → mappés "lac"
    ("lac",         re.compile(r"\blake\b|pond|lac\b|river|[eé]tang", re.I)),
]


def detect_from_description(description: Optional[str]) -> Optional[str]:
    """Retourne le swim_type infere depuis la description, ou None."""
    if not description:
        return None
    for swim_type, pattern in DESCRIPTION_RULES:
        if pattern.search(description):
            return swim_type
    return None


def detect_from_tags(tags: Optional[list]) -> Optional[str]:
    """Retourne le swim_type infere depuis les tags, ou None."""
    if not tags:
        return None
    # Concatener tous les tags pour une recherche globale
    tags_text = " ".join(str(t) for t in tags)
    for swim_type, pattern in TAG_RULES:
        if pattern.search(tags_text):
            return swim_type
    return None


def main():
    parser = argparse.ArgumentParser(
        description="Infere swim_type depuis la description et les tags"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Affiche les resultats sans ecrire en base",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10_000,
        help="Nombre maximum de courses a traiter (defaut: toutes)",
    )
    args = parser.parse_args()

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # --- Recuperer les courses sans swim_type mais avec swim_distance ---
    print("Chargement des courses sans swim_type...", flush=True)
    result = (
        sb.table("races")
        .select("id, name, description, tags")
        .not_.is_("swim_distance", "null")
        .is_("swim_type", "null")
        .limit(args.limit)
        .execute()
    )
    races = result.data or []

    if not races:
        print("Toutes les courses avec swim_distance ont deja un swim_type.")
        return

    total = len(races)
    print(f"{total} courses a traiter\n")

    if args.dry_run:
        print("[DRY-RUN] Aucune ecriture en base\n")

    updated = 0
    skipped = 0
    errors = 0

    # Compteur par type detecte
    type_counts: dict[str, int] = {}

    for i, race in enumerate(races):
        race_id = race["id"]
        name = race.get("name", "?")
        description = race.get("description")
        tags = race.get("tags")

        # La description prime sur les tags
        swim_type = detect_from_description(description)
        source = "description"

        if not swim_type:
            swim_type = detect_from_tags(tags)
            source = "tags"

        if swim_type:
            type_counts[swim_type] = type_counts.get(swim_type, 0) + 1

            if args.dry_run:
                print(
                    f"\r  [DRY] {name[:50]:<50} -> {swim_type} (via {source})      ",
                    flush=True,
                )
            else:
                try:
                    sb.table("races").update({"swim_type": swim_type}).eq("id", race_id).execute()
                except Exception as exc:
                    errors += 1
                    print(f"\r  DB error pour {name[:40]} : {exc}     ", flush=True)
                    print(
                        f"\r  OK {updated} mis a jour  - {skipped} sans type  ! {errors} erreurs  [{i+1}/{total}]   ",
                        end="",
                        flush=True,
                    )
                    continue
            updated += 1
        else:
            skipped += 1

        print(
            f"\r  OK {updated} mis a jour  - {skipped} sans type  ! {errors} erreurs  [{i+1}/{total}]   ",
            end="",
            flush=True,
        )

    print(f"\n\nTermine :")
    print(f"  swim_type detecte  : {updated}")
    print(f"  Aucun type trouve  : {skipped}")
    print(f"  Erreurs DB         : {errors}")
    print(f"  Total traite       : {total}")

    if type_counts:
        print("\nRepartition par type detecte :")
        for swim_type, count in sorted(type_counts.items(), key=lambda x: -x[1]):
            print(f"  {swim_type:<12} : {count}")


if __name__ == "__main__":
    main()
