"""Unified data models shared by all search providers, filters and storage."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class Property:
    """A single real estate listing, normalized across all providers.

    Every search module (see ``search/``) must translate the raw response
    of its source into this shape so that filtering, deduplication and
    notification can stay provider-agnostic.
    """

    id: str
    provider: str
    title: str
    price: float | None
    city: str | None
    address: str | None
    living_area: float | None
    plot: float | None
    rooms: float | None
    url: str
    images: list[str] = field(default_factory=list)
    published: datetime | None = None
    latitude: float | None = None
    longitude: float | None = None

    # Populated later by the filter/distance step, not by the provider.
    distance_km: float | None = None

    def dedup_key(self) -> str:
        """Stable fingerprint used for duplicate detection.

        Combines the provider-specific ID with a hash of title/price/address
        so that a listing re-posted under a new ID by the same provider (or
        mirrored across providers) is still recognized as a duplicate.
        """
        fingerprint_source = f"{self.title.strip().lower()}|{self.price}|{(self.address or '').strip().lower()}"
        fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()[:16]
        return f"{self.provider}:{self.id}:{fingerprint}"

    @property
    def price_per_sqm(self) -> float | None:
        """Price per square meter of living area, if both values are known.

        Kept here (rather than in filters) so future features such as a
        price-analysis view can reuse it without recomputation.
        """
        if self.price is None or not self.living_area:
            return None
        return round(self.price / self.living_area, 2)


@dataclass
class SearchCriteria:
    """Typed view over the ``config.yaml`` search parameters."""

    types: list[str]
    buy: bool
    rent: bool
    center: str
    radius_km: float
    price_min: float
    price_max: float
    living_area_min: float
    rooms_min: float
    plot_min: float
    keywords: list[str]
    exclude: list[str]

    @classmethod
    def from_config(cls, config: dict) -> "SearchCriteria":
        search = config.get("search", {})
        location = config.get("location", {})
        price = config.get("price", {})
        living_area = config.get("living_area", {})
        rooms = config.get("rooms", {})
        plot = config.get("plot", {})
        return cls(
            types=list(search.get("type", [])),
            buy=bool(search.get("buy", True)),
            rent=bool(search.get("rent", False)),
            center=str(location.get("center", "")),
            radius_km=float(location.get("radius", 25)),
            price_min=float(price.get("min", 0)),
            price_max=float(price.get("max", float("inf"))),
            living_area_min=float(living_area.get("min", 0)),
            rooms_min=float(rooms.get("min", 0)),
            plot_min=float(plot.get("min", 0)),
            keywords=[k.lower() for k in config.get("keywords", [])],
            exclude=[k.lower() for k in config.get("exclude", [])],
        )


def utcnow() -> datetime:
    """Timezone-aware "now", used consistently for timestamps across the agent."""
    return datetime.now(timezone.utc)
