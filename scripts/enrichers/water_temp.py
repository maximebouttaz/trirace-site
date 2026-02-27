"""
Enrichissement température eau via Copernicus Marine (CMEMS).

Dataset : cmems_mod_glo_phy_my_0.083deg_P1D-m
Variable : thetao (°C) à la surface (depth 0-1m)
Résolution : ~9km (1/12°), historique depuis 1993

Credentials : CMEMS_USERNAME / CMEMS_PASSWORD (env vars)
Supabase    : SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (env vars)
"""
import os
import sys
import argparse
import time
from datetime import date, timedelta
from typing import Optional

import numpy as np
import copernicusmarine
from supabase import create_client

DATASET_ID    = "cmems_mod_glo_phy_my_0.083deg_P1D-m"
HISTORY_YEARS = 5
RADIUS_DEG    = 0.5   # ~55km autour du lieu

# Traduit les noms d'env vars métier vers les noms attendus par la lib
# (copernicusmarine >= 2.x utilise COPERNICUSMARINE_SERVICE_USERNAME/PASSWORD)
_user = os.environ.get("CMEMS_USERNAME", "")
_pass = os.environ.get("CMEMS_PASSWORD", "")
if _user:
    os.environ.setdefault("COPERNICUSMARINE_SERVICE_USERNAME", _user)
if _pass:
    os.environ.setdefault("COPERNICUSMARINE_SERVICE_PASSWORD", _pass)


def fetch_water_temp(lat: float, lon: float, race_date: str) -> Optional[float]:
    """
    Retourne la température moyenne de l'eau sur HISTORY_YEARS années précédentes
    autour de la date de course (fenêtre ±3 jours, rayon ±RADIUS_DEG autour du lieu).
    Retourne None si aucune donnée disponible.
    """
    try:
        race_dt = date.fromisoformat(race_date)
    except (ValueError, TypeError):
        return None

    today = date.today()
    temps = []

    for years_back in range(1, HISTORY_YEARS + 1):
        target_year = race_dt.year - years_back
        if target_year < 1993:
            break

        target_date = date(target_year, race_dt.month, min(race_dt.day, 28))
        start = target_date - timedelta(days=3)
        end   = min(target_date + timedelta(days=3), today)

        if start > today:
            continue

        print(f"  → Tentative {target_year} ({start} → {end})")
        try:
            ds = copernicusmarine.open_dataset(
                dataset_id        = DATASET_ID,
                variables         = ["thetao"],
                minimum_latitude  = lat - RADIUS_DEG,
                maximum_latitude  = lat + RADIUS_DEG,
                minimum_longitude = lon - RADIUS_DEG,
                maximum_longitude = lon + RADIUS_DEG,
                start_datetime    = start.isoformat() + "T00:00:00",
                end_datetime      = end.isoformat()   + "T23:59:59",
            )

            # Sélectionner la couche la plus superficielle et forcer le chargement
            surface = ds["thetao"].isel(depth=0).load()
            values  = surface.values.flatten()
            valid   = values[~np.isnan(values)]
            if len(valid) > 0:
                mean_t = float(np.mean(valid))
                temps.append(mean_t)
                print(f"    ✓ {mean_t:.2f}°C ({len(valid)} points)")
            else:
                print(f"    ⚠ Aucune valeur valide")

            ds.close()

        except Exception as e:
            print(f"  ⚠ Année {target_year} : {e}", file=sys.stderr)

        time.sleep(2)  # respecter les limites CMEMS

    if not temps:
        return None
    return round(sum(temps) / len(temps), 1)


def enrich_water_temp(supabase_client, race_id: Optional[int] = None) -> int:
    """
    Enrichit les courses sans température eau.
    Si race_id est fourni, enrichit uniquement cette course (même si déjà renseignée).
    Retourne le nombre de courses enrichies.
    """
    print("[WATER_TEMP] Démarrage enrichissement...")

    query = (
        supabase_client.table("races")
        .select("id, slug, date, latitude, longitude")
        .not_.is_("latitude", "null")
        .not_.is_("longitude", "null")
        .not_.is_("date", "null")
    )

    if race_id is not None:
        query = query.eq("id", race_id)
    else:
        query = query.is_("avg_water_temp_celsius", "null")

    races = query.execute().data or []
    print(f"[WATER_TEMP] {len(races)} course(s) à enrichir")

    enriched = 0
    for race in races:
        try:
            temp = fetch_water_temp(
                lat       = race["latitude"],
                lon       = race["longitude"],
                race_date = race["date"],
            )

            if temp is not None:
                supabase_client.table("races").update(
                    {"avg_water_temp_celsius": temp}
                ).eq("id", race["id"]).execute()
                enriched += 1
                print(f"  ✓ {race['slug']} → {temp}°C")
            else:
                print(f"  ⚠ {race['slug']} → aucune donnée disponible")

        except Exception as e:
            print(f"  ✗ {race['slug']} : {e}", file=sys.stderr)

    print(f"[WATER_TEMP] {enriched}/{len(races)} enrichies")
    return enriched


def main():
    parser = argparse.ArgumentParser(description="Enrichit avg_water_temp_celsius via CMEMS")
    parser.add_argument("--race-id", type=int, default=None, help="ID d'une course spécifique")
    args = parser.parse_args()

    # Diagnostic credentials
    svc_user = os.environ.get("COPERNICUSMARINE_SERVICE_USERNAME", "")
    svc_pass = os.environ.get("COPERNICUSMARINE_SERVICE_PASSWORD", "")
    if not svc_user or not svc_pass:
        print("[WATER_TEMP] ✗ Credentials CMEMS manquants — vérifie CMEMS_USERNAME / CMEMS_PASSWORD", file=sys.stderr)
        sys.exit(1)
    print(f"[WATER_TEMP] Credentials CMEMS : utilisateur={svc_user[:4]}*** OK")

    # Login explicite — crée ~/.copernicusmarine/.copernicusmarine-credentials
    # Nécessaire en environnement non-interactif (CI/GitHub Actions)
    print("[WATER_TEMP] Login Copernicus Marine…")
    try:
        copernicusmarine.login(
            username=svc_user,
            password=svc_pass,
            overwrite=True,
            check_credentials_valid=False,
        )
        print("[WATER_TEMP] Login OK")
    except Exception as e:
        print(f"[WATER_TEMP] ✗ Login CMEMS échoué : {e}", file=sys.stderr)
        sys.exit(1)

    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    enriched = enrich_water_temp(supabase, race_id=args.race_id)

    # Fail explicitement si aucune course enrichie (mode ciblé)
    if args.race_id is not None and enriched == 0:
        print("[WATER_TEMP] ✗ Aucune donnée trouvée pour cette course", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
