"""
Terrain service for elevation and slope analysis using Open-Meteo Elevation API (Copernicus DEM GLO-90)
with automatic Open-Elevation batch fallback and 20-minute in-memory caching.
Computes realistic slope by sampling a local 3x3 neighborhood around the target coordinates
and calculating gradients via Horn's method with geographic Haversine distances.
"""

import math
import time
import logging
from typing import Dict, Any, List, Optional, Tuple
import httpx

logger = logging.getLogger("landslide_terrain_service")

EARTH_RADIUS_METERS = 6371000.0

# In-memory TTL caches (1200s = 20 minutes)
CACHE_TTL_SECONDS = 1200
TERRAIN_FEATURE_CACHE: Dict[str, Dict[str, Any]] = {}
ELEVATION_SAMPLE_CACHE: Dict[str, float] = {}

# Shared connection-pooled client
_HTTP_CLIENT: Optional[httpx.AsyncClient] = None


def get_shared_http_client() -> httpx.AsyncClient:
    global _HTTP_CLIENT
    if _HTTP_CLIENT is None or _HTTP_CLIENT.is_closed:
        limits = httpx.Limits(max_keepalive_connections=20, max_connections=40)
        timeout = httpx.Timeout(12.0, connect=4.0)
        _HTTP_CLIENT = httpx.AsyncClient(limits=limits, timeout=timeout)
    return _HTTP_CLIENT


def coord_cache_key(latitude: float, longitude: float) -> str:
    return f"{round(latitude, 4):.4f}_{round(longitude, 4):.4f}"


def sample_cache_key(latitude: float, longitude: float) -> str:
    return f"{round(latitude, 5):.5f}_{round(longitude, 5):.5f}"


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two points on a sphere in meters."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_METERS * c


def classify_slope(slope_deg: float) -> Tuple[str, str]:
    """
    Classifies slope into standard geomorphological categories and terrain susceptibility:
      0 - 5°   : Flat       -> Low
      5 - 15°  : Moderate   -> Moderate
      15 - 30° : Steep      -> High
      >= 30°   : Very Steep -> Very High
    """
    if slope_deg < 5.0:
        return "Flat", "Low"
    elif slope_deg < 15.0:
        return "Moderate", "Moderate"
    elif slope_deg < 30.0:
        return "Steep", "High"
    else:
        return "Very Steep", "Very High"


def get_neighborhood_coords(
    latitude: float, longitude: float
) -> List[Tuple[str, float, float]]:
    """
    Neighborhood step size: 0.001 deg lat is ~111m, closely matching Copernicus GLO-90 DEM resolution (~90m)
    """
    delta_lat = 0.001
    cos_lat = max(math.cos(math.radians(latitude)), 0.01)
    delta_lon = delta_lat / cos_lat

    return [
        ("C", latitude, longitude),
        ("N", latitude + delta_lat, longitude),
        ("S", latitude - delta_lat, longitude),
        ("E", latitude, longitude + delta_lon),
        ("W", latitude, longitude - delta_lon),
        ("NE", latitude + delta_lat, longitude + delta_lon),
        ("NW", latitude + delta_lat, longitude - delta_lon),
        ("SE", latitude - delta_lat, longitude + delta_lon),
        ("SW", latitude - delta_lat, longitude - delta_lon),
    ]


def compute_slope_from_neighborhood(
    latitude: float,
    longitude: float,
    elev_map: Dict[str, float],
    data_source: str = "Copernicus 90m DEM (Open-Meteo)",
) -> Dict[str, Any]:
    delta_lat = 0.001
    cos_lat = max(math.cos(math.radians(latitude)), 0.01)
    delta_lon = delta_lat / cos_lat

    dist_ns = haversine_distance(
        latitude + delta_lat, longitude, latitude - delta_lat, longitude
    )
    dist_ew = haversine_distance(
        latitude, longitude + delta_lon, latitude, longitude - delta_lon
    )

    if dist_ns <= 0.0 or dist_ew <= 0.0:
        dz_dx = 0.0
        dz_dy = 0.0
    else:
        # Horn's 3x3 weighted finite difference algorithm
        dz_dx = (
            (elev_map["NE"] + 2.0 * elev_map["E"] + elev_map["SE"])
            - (elev_map["NW"] + 2.0 * elev_map["W"] + elev_map["SW"])
        ) / (4.0 * (dist_ew / 2.0))

        dz_dy = (
            (elev_map["NW"] + 2.0 * elev_map["N"] + elev_map["NE"])
            - (elev_map["SW"] + 2.0 * elev_map["S"] + elev_map["SE"])
        ) / (4.0 * (dist_ns / 2.0))

    slope_pct = math.sqrt(dz_dx**2 + dz_dy**2) * 100.0
    slope_deg = math.degrees(math.atan(math.sqrt(dz_dx**2 + dz_dy**2)))
    slope_category, terrain_susceptibility = classify_slope(slope_deg)

    return {
        "latitude": latitude,
        "longitude": longitude,
        "elevation_m": round(elev_map["C"], 1),
        "slope_degrees": round(slope_deg, 2),
        "slope_percentage": round(slope_pct, 2),
        "slope_category": slope_category,
        "terrain_susceptibility": terrain_susceptibility,
        "data_source": data_source,
    }


async def fetch_elevations_open_meteo(
    points: List[Tuple[float, float]],
) -> Optional[List[float]]:
    """Queries Open-Meteo elevation API for a batch of coordinates."""
    lats_str = ",".join(f"{p[0]:.6f}" for p in points)
    lngs_str = ",".join(f"{p[1]:.6f}" for p in points)
    url = f"https://api.open-meteo.com/v1/elevation?latitude={lats_str}&longitude={lngs_str}"

    client = get_shared_http_client()
    try:
        resp = await client.get(url)
        if resp.status_code == 200:
            data = resp.json()
            elevations = data.get("elevation", [])
            if elevations and len(elevations) >= len(points):
                return [float(e) for e in elevations[: len(points)]]
        elif resp.status_code == 429:
            logger.warning("Open-Meteo Elevation API returned 429 (rate-limited).")
    except Exception as exc:
        logger.warning(f"Open-Meteo elevation query failed: {exc}")
    return None


async def fetch_elevations_open_elevation(
    points: List[Tuple[float, float]],
) -> Optional[List[float]]:
    """Fallback: Queries Open-Elevation API for a batch of coordinates."""
    url = "https://api.open-elevation.com/api/v1/lookup"
    payload = {"locations": [{"latitude": p[0], "longitude": p[1]} for p in points]}

    client = get_shared_http_client()
    try:
        resp = await client.post(url, json=payload, timeout=8.0)
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("results", [])
            if results and len(results) >= len(points):
                return [float(r["elevation"]) for r in results[: len(points)]]
    except Exception as exc:
        logger.warning(f"Open-Elevation fallback query failed: {exc}")
    return None


async def get_terrain_features(latitude: float, longitude: float) -> Dict[str, Any]:
    """
    Retrieves real elevation and derives slope for the specified coordinates.
    Samples a 3x3 local neighborhood (~90m Copernicus DEM resolution).
    Features 20-minute in-memory caching and automatic fallback.
    """
    if not (-90.0 <= latitude <= 90.0):
        raise ValueError(f"Latitude must be between -90 and 90, got {latitude}")
    if not (-180.0 <= longitude <= 180.0):
        raise ValueError(f"Longitude must be between -180 and 180, got {longitude}")

    ckey = coord_cache_key(latitude, longitude)
    now = time.time()
    cached = TERRAIN_FEATURE_CACHE.get(ckey)
    if cached and (now - cached["ts"] < CACHE_TTL_SECONDS):
        return cached["data"]

    points = get_neighborhood_coords(latitude, longitude)
    sample_coords = [(p[1], p[2]) for p in points]

    elevations = await fetch_elevations_open_meteo(sample_coords)
    source_name = "Copernicus 90m DEM (Open-Meteo)"

    if elevations is None:
        elevations = await fetch_elevations_open_elevation(sample_coords)
        source_name = "SRTM 90m DEM (Open-Elevation Fallback)"

    if elevations is None or len(elevations) < len(points):
        # Fallback to local default elevation based on Sikkim terrain average if external networks fail
        raise RuntimeError("Unable to retrieve elevation data from elevation services")

    elev_map = {points[i][0]: float(elevations[i]) for i in range(len(points))}
    result = compute_slope_from_neighborhood(latitude, longitude, elev_map, source_name)

    TERRAIN_FEATURE_CACHE[ckey] = {"data": result, "ts": now}
    return result


async def get_terrain_features_batch(
    coords: List[Tuple[float, float]],
) -> List[Optional[Dict[str, Any]]]:
    """
    Batches terrain elevation and Horn's slope derivation across multiple coordinates.
    Gathers all 3x3 neighborhood sample points and queries elevation service in a single batch.
    """
    if not coords:
        return []

    now = time.time()
    results: List[Optional[Dict[str, Any]]] = [None] * len(coords)
    uncached_indices: List[int] = []
    uncached_coords: List[Tuple[float, float]] = []

    for idx, (lat, lng) in enumerate(coords):
        ckey = coord_cache_key(lat, lng)
        entry = TERRAIN_FEATURE_CACHE.get(ckey)
        if entry and (now - entry["ts"] < CACHE_TTL_SECONDS):
            results[idx] = entry["data"]
        else:
            uncached_indices.append(idx)
            uncached_coords.append((lat, lng))

    if not uncached_coords:
        return results

    # Collect all 9 neighborhood points for each uncached coordinate
    all_sample_points: List[Tuple[float, float]] = []
    coord_sample_slices: List[Tuple[int, int]] = []

    for lat, lng in uncached_coords:
        nb = get_neighborhood_coords(lat, lng)
        start_pos = len(all_sample_points)
        for _, p_lat, p_lng in nb:
            all_sample_points.append((p_lat, p_lng))
        end_pos = len(all_sample_points)
        coord_sample_slices.append((start_pos, end_pos))

    # Fetch elevations for all sample points in batch
    elevations: Optional[List[float]] = None
    source_name = "Copernicus 90m DEM (Open-Meteo)"

    # Try Open-Meteo batch first
    elevations = await fetch_elevations_open_meteo(all_sample_points)

    # If Open-Meteo is rate-limited (429) or failed, fall back to Open-Elevation batch POST
    if elevations is None:
        logger.info("Falling back to Open-Elevation batch lookup.")
        elevations = await fetch_elevations_open_elevation(all_sample_points)
        source_name = "SRTM 90m DEM (Open-Elevation Fallback)"

    if elevations and len(elevations) >= len(all_sample_points):
        point_labels = ["C", "N", "S", "E", "W", "NE", "NW", "SE", "SW"]
        for i, (lat, lng) in enumerate(uncached_coords):
            target_idx = uncached_indices[i]
            s_start, s_end = coord_sample_slices[i]
            sample_elevs = elevations[s_start:s_end]
            elev_map = {point_labels[j]: sample_elevs[j] for j in range(len(point_labels))}

            res = compute_slope_from_neighborhood(lat, lng, elev_map, source_name)
            results[target_idx] = res

            ckey = coord_cache_key(lat, lng)
            TERRAIN_FEATURE_CACHE[ckey] = {"data": res, "ts": now}
    else:
        # If batch completely failed, fallback to single calls with individual handling
        for i, (lat, lng) in enumerate(uncached_coords):
            target_idx = uncached_indices[i]
            try:
                res = await get_terrain_features(lat, lng)
                results[target_idx] = res
            except Exception as e:
                logger.warning(f"Terrain calculation failed for ({lat}, {lng}): {e}")
                results[target_idx] = None

    return results
