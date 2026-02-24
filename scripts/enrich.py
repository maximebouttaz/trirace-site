"""
Lance les enrichissements (géocodage + météo) sur les courses en base.

Usage :
    python scripts/enrich.py              # géocodage + météo
    python scripts/enrich.py --geo-only   # géocodage seulement
    python scripts/enrich.py --weather-only  # météo seulement
"""

import argparse
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

sys.path.insert(0, os.path.dirname(__file__))
from enrichers import geocoding, weather


def main():
    parser = argparse.ArgumentParser(description="Enrichissement des courses")
    parser.add_argument("--geo-only", action="store_true")
    parser.add_argument("--weather-only", action="store_true")
    args = parser.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        print("❌ SUPABASE_URL et SUPABASE_SERVICE_KEY requis dans scripts/.env")
        sys.exit(1)

    sb = create_client(supabase_url, supabase_key)
    print(f"✓ Connecté à Supabase")

    if not args.weather_only:
        print(f"\n{'='*50}")
        print("  GÉOCODAGE")
        print(f"{'='*50}\n")
        geocoding.enrich_geocoding(sb)

    if not args.geo_only:
        print(f"\n{'='*50}")
        print("  MÉTÉO")
        print(f"{'='*50}\n")
        weather.enrich_weather(sb)

    print(f"\n✓ Enrichissement terminé")


if __name__ == "__main__":
    main()
