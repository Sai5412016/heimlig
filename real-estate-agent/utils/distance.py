"""Distance calculation and geocoding helpers.

Geocoding uses the public OpenStreetMap Nominatim API. Its usage policy
(https://operations.osmfoundation.org/policies/nominatim/) requires a
descriptive ``User-Agent`` and at most one request per second - both are
respected here. Results are cached in-process and in the database so a
given ``center`` string is only ever geocoded once.
"""

from __future__ import annotations

import math
import time

import requests

from utils.logger import get_logger

logger = get_logger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_USER_AGENT = "HeimligRealEstateAgent/1.0 (personal use, contact: set via config)"
_MIN_REQUEST_INTERVAL_SECONDS = 1.0

_last_request_at: float = 0.0
_geocode_cache: dict[str, tuple[float, float]] = {}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two coordinates in kilometers."""
    earth_radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return earth_radius_km * c


def geocode(place: str) -> tuple[float, float] | None:
    """Resolve a place name (e.g. "Augsburg") to (latitude, longitude).

    Returns ``None`` if the place could not be resolved, so callers can
    decide whether to skip distance filtering rather than crash the agent.
    """
    global _last_request_at

    if place in _geocode_cache:
        return _geocode_cache[place]

    elapsed = time.monotonic() - _last_request_at
    if elapsed < _MIN_REQUEST_INTERVAL_SECONDS:
        time.sleep(_MIN_REQUEST_INTERVAL_SECONDS - elapsed)

    try:
        response = requests.get(
            NOMINATIM_URL,
            params={"q": place, "format": "json", "limit": 1, "countrycodes": "de"},
            headers={"User-Agent": NOMINATIM_USER_AGENT},
            timeout=10,
        )
        _last_request_at = time.monotonic()
        response.raise_for_status()
        results = response.json()
    except requests.RequestException as exc:
        logger.error("Geocoding failed for %r: %s", place, exc)
        return None

    if not results:
        logger.warning("Geocoding returned no results for %r", place)
        return None

    coords = (float(results[0]["lat"]), float(results[0]["lon"]))
    _geocode_cache[place] = coords
    return coords
