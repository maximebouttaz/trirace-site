"""
Enrichissement météo via Open-Meteo API (gratuit, pas de clé requise).
https://open-meteo.com/en/docs/historical-weather-api

Pour chaque course avec lat/lon et date, on récupère les moyennes historiques
(5 dernières années) : température haute, température basse, vent.
"""
import time
import requests
from datetime import date, timedelta
from typing import Optional


OPEN_METEO_URL = "https://archive-api.open-meteo.com/v1/archive"

# Nombre d'années d'historique à moyenner
HISTORY_YEARS = 5


def enrich_weather(supabase_client) -> int:
    """
    Enrichit toutes les courses sans météo qui ont lat/lon et une date.
    Retourne le nombre de courses enrichies.
    """
    print("[WEATHER] Enrichissement météo des courses...")

    # Récupérer les courses sans météo mais avec coordonnées
    result = (
        supabase_client.table("races")
        .select("id, slug, date, latitude, longitude, avg_temp_high_celsius")
        .is_("avg_temp_high_celsius", "null")
        .not_.is_("latitude", "null")
        .not_.is_("longitude", "null")
        .not_.is_("date", "null")
        .execute()
    )

    races = result.data or []
    print(f"[WEATHER] {len(races)} courses à enrichir")

    enriched = 0
    for race in races:
        try:
            weather = fetch_historical_weather(
                lat=race["latitude"],
                lon=race["longitude"],
                race_date=race["date"],
            )

            if weather:
                supabase_client.table("races").update(weather).eq("id", race["id"]).execute()
                enriched += 1
                print(
                    f"  ✓ {race['slug']} → "
                    f"high {weather.get('avg_temp_high_celsius')}°C / "
                    f"low {weather.get('avg_temp_low_celsius')}°C, "
                    f"vent {weather.get('avg_wind_kmh')} km/h"
                )

        except Exception as e:
            print(f"  ✗ {race['slug']} : {e}")

        time.sleep(0.3)  # Open-Meteo : max ~10 req/s, on est très conservateurs

    print(f"[WEATHER] {enriched}/{len(races)} courses enrichies")
    return enriched


def fetch_historical_weather(lat: float, lon: float, race_date: str) -> Optional[dict]:
    """
    Calcule la météo moyenne sur les 5 dernières années à la même date.
    Retourne un dict avec avg_temp_high_celsius, avg_temp_low_celsius, avg_wind_kmh.
    """
    try:
        race_dt = date.fromisoformat(race_date)
    except (ValueError, TypeError):
        return None

    today = date.today()
    temps_high = []
    temps_low = []
    winds = []

    for years_back in range(1, HISTORY_YEARS + 1):
        target_year = race_dt.year - years_back
        if target_year < 1940:
            break

        # Fenêtre de ±3 jours autour de la date de course
        window_start = date(target_year, race_dt.month, min(race_dt.day, 28)) - timedelta(days=3)
        window_end = window_start + timedelta(days=6)

        # Ne pas aller dans le futur
        if window_start > today:
            continue

        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": window_start.isoformat(),
            "end_date": min(window_end, today).isoformat(),
            "daily": "temperature_2m_max,temperature_2m_min,wind_speed_10m_max",
            "wind_speed_unit": "kmh",
            "timezone": "auto",
        }

        try:
            resp = requests.get(OPEN_METEO_URL, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()

            daily = data.get("daily", {})
            high_list = [t for t in (daily.get("temperature_2m_max") or []) if t is not None]
            low_list  = [t for t in (daily.get("temperature_2m_min") or []) if t is not None]
            wind_list = [w for w in (daily.get("wind_speed_10m_max") or []) if w is not None]

            if high_list:
                temps_high.append(sum(high_list) / len(high_list))
            if low_list:
                temps_low.append(sum(low_list) / len(low_list))
            if wind_list:
                winds.append(sum(wind_list) / len(wind_list))

        except Exception:
            continue

        time.sleep(0.2)

    if not temps_high:
        return None

    result = {
        "avg_temp_high_celsius": round(sum(temps_high) / len(temps_high), 1),
        "avg_temp_low_celsius":  round(sum(temps_low) / len(temps_low), 1) if temps_low else None,
        "avg_wind_kmh":          round(sum(winds) / len(winds), 1) if winds else None,
    }

    return result
