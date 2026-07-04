"""Apply search criteria (price, area, rooms, radius, keywords, ...) to listings.

Each check is a small, independently testable function so new filters
(e.g. a future "minimum year built") can be added without touching the
others. ``apply_filters`` composes them and is what ``main.py`` calls.
"""

from __future__ import annotations

from utils.distance import geocode, haversine_km
from utils.logger import get_logger
from utils.models import Property, SearchCriteria

logger = get_logger(__name__)


def matches_price(prop: Property, criteria: SearchCriteria) -> bool:
    if prop.price is None:
        return True  # unknown price -> don't discard, let the user judge
    return criteria.price_min <= prop.price <= criteria.price_max


def matches_living_area(prop: Property, criteria: SearchCriteria) -> bool:
    if prop.living_area is None:
        return True
    return prop.living_area >= criteria.living_area_min


def matches_plot(prop: Property, criteria: SearchCriteria) -> bool:
    if criteria.plot_min <= 0 or prop.plot is None:
        return True
    return prop.plot >= criteria.plot_min


def matches_rooms(prop: Property, criteria: SearchCriteria) -> bool:
    if prop.rooms is None:
        return True
    return prop.rooms >= criteria.rooms_min


def matches_keywords(prop: Property, criteria: SearchCriteria) -> bool:
    if not criteria.keywords:
        return True
    haystack = prop.title.lower()
    return any(keyword in haystack for keyword in criteria.keywords)


def matches_exclusions(prop: Property, criteria: SearchCriteria) -> bool:
    if not criteria.exclude:
        return True
    haystack = prop.title.lower()
    return not any(term in haystack for term in criteria.exclude)


def within_radius(prop: Property, criteria: SearchCriteria) -> bool:
    """Annotate ``prop.distance_km`` and check it against ``criteria.radius_km``.

    If the property has no coordinates and the address can't be geocoded,
    the property is kept (fail open) so a listing is never silently lost
    just because geocoding is temporarily unavailable.
    """
    center = geocode(criteria.center)
    if center is None:
        return True

    if prop.latitude is None or prop.longitude is None:
        if not prop.city:
            return True
        location = geocode(prop.city)
        if location is None:
            return True
        prop.latitude, prop.longitude = location

    prop.distance_km = round(haversine_km(center[0], center[1], prop.latitude, prop.longitude), 1)
    return prop.distance_km <= criteria.radius_km


_ALL_CHECKS = (
    matches_price,
    matches_living_area,
    matches_plot,
    matches_rooms,
    matches_keywords,
    matches_exclusions,
    within_radius,
)


def apply_filters(properties: list[Property], criteria: SearchCriteria) -> list[Property]:
    """Return only the listings that satisfy every configured criterion."""
    accepted: list[Property] = []
    for prop in properties:
        if all(check(prop, criteria) for check in _ALL_CHECKS):
            accepted.append(prop)
    logger.info("Filters kept %d of %d listings", len(accepted), len(properties))
    return accepted
