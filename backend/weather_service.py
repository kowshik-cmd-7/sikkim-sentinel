import os
import time
import logging
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import httpx
from dotenv import load_dotenv

_backend_env = Path(__file__).resolve().parent / ".env"
if _backend_env.exists():
    load_dotenv(dotenv_path=_backend_env)
else:
    load_dotenv()

logger = logging.getLogger("landslide_weather_service")

GOOGLE_WEATHER_API_KEY = os.getenv("GOOGLE_WEATHER_API_KEY")
BASE_URL = "https://weather.googleapis.com/v1"

# Shared connection-pooled HTTP client
_SHARED_CLIENT: Optional[httpx.AsyncClient] = None


def get_shared_http_client() -> httpx.AsyncClient:
    global _SHARED_CLIENT
    if _SHARED_CLIENT is None or _SHARED_CLIENT.is_closed:
        limits = httpx.Limits(max_keepalive_connections=20, max_connections=40)
        timeout = httpx.Timeout(15.0, connect=5.0)
        _SHARED_CLIENT = httpx.AsyncClient(limits=limits, timeout=timeout)
    return _SHARED_CLIENT


# In-memory TTL caches (1200 seconds = 20 minutes)
CACHE_TTL_SECONDS = 1200
RAINFALL_CACHE: Dict[str, Dict[str, Any]] = {}
FORECAST_CACHE: Dict[str, Dict[str, Any]] = {}


def coord_cache_key(latitude: float, longitude: float) -> str:
    return f"{round(latitude, 4):.4f}_{round(longitude, 4):.4f}"


def get_effective_archive_dates() -> Tuple[date, date]:
    """
    Returns (start_date, end_date) for Open-Meteo Archive API.
    If system year is > 2024 (e.g. 2026), clamps to 2024 to avoid HTTP 400 Bad Request
    since Open-Meteo ERA5 archive has data up to recent calendar records.
    """
    today = date.today()
    if today > date(2024, 12, 31):
        try:
            end_date = date(2024, today.month, today.day)
        except ValueError:
            end_date = date(2024, today.month, 28)
    else:
        end_date = today
    start_date = end_date - timedelta(days=30)
    return start_date, end_date


async def get_current_weather(latitude: float, longitude: float):
    if not GOOGLE_WEATHER_API_KEY:
        raise RuntimeError("GOOGLE_WEATHER_API_KEY is not configured")

    url = f"{BASE_URL}/currentConditions:lookup"
    params = {
        "key": GOOGLE_WEATHER_API_KEY,
        "location.latitude": latitude,
        "location.longitude": longitude,
        "unitsSystem": "METRIC",
    }

    client = get_shared_http_client()
    response = await client.get(url, params=params)
    response.raise_for_status()
    return response.json()


async def get_hourly_history(latitude: float, longitude: float, hours: int = 24):
    if not GOOGLE_WEATHER_API_KEY:
        raise RuntimeError("GOOGLE_WEATHER_API_KEY is not configured")

    hours = min(max(hours, 1), 24)
    url = f"{BASE_URL}/history/hours:lookup"
    params = {
        "key": GOOGLE_WEATHER_API_KEY,
        "location.latitude": latitude,
        "location.longitude": longitude,
        "hours": hours,
        "unitsSystem": "METRIC",
    }

    client = get_shared_http_client()
    response = await client.get(url, params=params)
    response.raise_for_status()
    return response.json()


def parse_daily_rain_array(rainfall_raw: list) -> Dict[str, Any]:
    rainfall = [float(x or 0) for x in rainfall_raw]
    return {
        "rainfall_1d": round(sum(rainfall[-1:]), 2),
        "rainfall_3d": round(sum(rainfall[-3:]), 2),
        "rainfall_7d": round(sum(rainfall[-7:]), 2),
        "rainfall_14d": round(sum(rainfall[-14:]), 2),
        "rainfall_30d": round(sum(rainfall[-30:]), 2),
        "data_source": "Open-Meteo ERA5/ERA5-Land historical weather",
    }


async def get_rainfall_features(latitude: float, longitude: float) -> Dict[str, Any]:
    """
    Get historical daily rainfall and calculate the 1, 3, 7, 14, and 30-day rainfall totals.
    Features in-memory TTL caching (20 min) and connection-pooled requests.
    """
    ckey = coord_cache_key(latitude, longitude)
    now = time.time()
    cached = RAINFALL_CACHE.get(ckey)
    if cached and (now - cached["ts"] < CACHE_TTL_SECONDS):
        return cached["data"]

    start_date, end_date = get_effective_archive_dates()
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily": "rain_sum",
        "timezone": "auto",
    }

    client = get_shared_http_client()
    response = await client.get(url, params=params)
    response.raise_for_status()
    data = response.json()

    rainfall = data.get("daily", {}).get("rain_sum", [])
    result = parse_daily_rain_array(rainfall)

    RAINFALL_CACHE[ckey] = {"data": result, "ts": now}
    return result


async def get_rainfall_features_batch(
    coords: List[Tuple[float, float]],
) -> List[Optional[Dict[str, Any]]]:
    """
    Batches rainfall retrieval across multiple coordinates using Open-Meteo's
    native multi-coordinate querying capability in a single HTTP request.
    Checks in-memory cache first for each point.
    """
    if not coords:
        return []

    now = time.time()
    results: List[Optional[Dict[str, Any]]] = [None] * len(coords)
    uncached_indices: List[int] = []
    uncached_coords: List[Tuple[float, float]] = []

    for idx, (lat, lng) in enumerate(coords):
        ckey = coord_cache_key(lat, lng)
        entry = RAINFALL_CACHE.get(ckey)
        if entry and (now - entry["ts"] < CACHE_TTL_SECONDS):
            results[idx] = entry["data"]
        else:
            uncached_indices.append(idx)
            uncached_coords.append((lat, lng))

    if not uncached_coords:
        return results

    start_date, end_date = get_effective_archive_dates()
    url = "https://archive-api.open-meteo.com/v1/archive"
    lats_str = ",".join(f"{c[0]:.4f}" for c in uncached_coords)
    lngs_str = ",".join(f"{c[1]:.4f}" for c in uncached_coords)

    params = {
        "latitude": lats_str,
        "longitude": lngs_str,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily": "rain_sum",
        "timezone": "auto",
    }

    try:
        client = get_shared_http_client()
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        # If multiple coordinates, Open-Meteo returns a list of dictionaries; if 1 coordinate, a dict
        items = data if isinstance(data, list) else [data]

        for i, item in enumerate(items):
            if i < len(uncached_indices):
                target_idx = uncached_indices[i]
                orig_lat, orig_lng = uncached_coords[i]
                rain_array = item.get("daily", {}).get("rain_sum", [])
                parsed = parse_daily_rain_array(rain_array)

                results[target_idx] = parsed
                ckey = coord_cache_key(orig_lat, orig_lng)
                RAINFALL_CACHE[ckey] = {"data": parsed, "ts": now}
    except Exception as exc:
        logger.error(f"Batch rainfall fetch error: {exc}. Falling back to individual requests.")
        # Fallback to individual calls
        for i, (lat, lng) in enumerate(uncached_coords):
            orig_idx = uncached_indices[i]
            try:
                indiv = await get_rainfall_features(lat, lng)
                results[orig_idx] = indiv
            except Exception as e:
                logger.warning(f"Failed individual rainfall fetch for ({lat}, {lng}): {e}")
                results[orig_idx] = None

    return results


WMO_WEATHER_CODE_MAP = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    62: "Moderate rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


async def get_rainfall_forecast(
    latitude: float,
    longitude: float,
    hours: int = 72,
) -> Dict[str, Any]:
    """
    Retrieves hourly precipitation forecast for approximately the next 6-72 hours
    using the Open-Meteo weather forecast API with in-memory caching.
    """
    fkey = f"{coord_cache_key(latitude, longitude)}_{hours}"
    now = time.time()
    cached = FORECAST_CACHE.get(fkey)
    if cached and (now - cached["ts"] < CACHE_TTL_SECONDS):
        return cached["data"]

    hours = min(max(hours, 6), 168)
    forecast_days = min(max((hours + 24) // 24 + 1, 2), 16)

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,precipitation,weather_code",
        "hourly": "precipitation,precipitation_probability,temperature_2m,weather_code",
        "forecast_days": forecast_days,
        "timezone": "auto",
    }

    client = get_shared_http_client()
    response = await client.get(url, params=params)
    response.raise_for_status()
    data = response.json()

    hourly = data.get("hourly", {})
    times = hourly.get("time", [])
    precipitations = hourly.get("precipitation", [])
    probabilities = hourly.get("precipitation_probability", [])
    temperatures = hourly.get("temperature_2m", [])
    weather_codes = hourly.get("weather_code", [])

    cur_time_str = data.get("current", {}).get("time", "")
    cur_hour_str = cur_time_str[:13] + ":00" if len(cur_time_str) >= 13 else ""

    start_idx = 0
    if cur_hour_str and times:
        for idx, t in enumerate(times):
            if t >= cur_hour_str:
                start_idx = idx
                break

    end_idx = min(start_idx + hours, len(times))

    forecast_items = []
    total_rainfall = 0.0
    max_hourly_rainfall = 0.0

    for i in range(start_idx, end_idx):
        t = times[i]
        p = float(precipitations[i] or 0) if i < len(precipitations) else 0.0
        prob = int(probabilities[i]) if i < len(probabilities) and probabilities[i] is not None else None
        temp = float(temperatures[i]) if i < len(temperatures) and temperatures[i] is not None else None
        w_code = int(weather_codes[i]) if i < len(weather_codes) and weather_codes[i] is not None else 0
        cond = WMO_WEATHER_CODE_MAP.get(w_code, "Cloudy" if w_code > 0 else "Clear")

        total_rainfall += p
        if p > max_hourly_rainfall:
            max_hourly_rainfall = p

        forecast_items.append({
            "time": t,
            "rainfall_mm": round(p, 2),
            "precipitation_probability": prob,
            "temperature_c": round(temp, 1) if temp is not None else None,
            "condition": cond,
        })

    result = {
        "latitude": latitude,
        "longitude": longitude,
        "hours": len(forecast_items),
        "data_source": "Open-Meteo Seamless Weather Forecast",
        "total_rainfall_mm": round(total_rainfall, 2),
        "max_hourly_rainfall_mm": round(max_hourly_rainfall, 2),
        "forecast": forecast_items,
    }

    FORECAST_CACHE[fkey] = {"data": result, "ts": now}
    return result
