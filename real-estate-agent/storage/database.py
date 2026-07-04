"""SQLite-backed storage of every listing the agent has ever seen.

Used both for deduplication (a listing must only ever be notified once)
and as the foundation for future features like a map view or favorites,
which can simply add columns/tables without touching this module's core
contract: ``is_known`` / ``save`` / ``mark_notified``.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from pathlib import Path

from utils.logger import get_logger
from utils.models import Property, utcnow

logger = get_logger(__name__)

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "database.sqlite"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS properties (
    dedup_key      TEXT PRIMARY KEY,
    provider       TEXT NOT NULL,
    provider_id    TEXT NOT NULL,
    title          TEXT NOT NULL,
    price          REAL,
    city           TEXT,
    address        TEXT,
    living_area    REAL,
    plot           REAL,
    rooms          REAL,
    url            TEXT NOT NULL,
    images         TEXT,
    latitude       REAL,
    longitude      REAL,
    distance_km    REAL,
    first_seen_at  TEXT NOT NULL,
    notified_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_properties_url ON properties(url);
"""


class PropertyDatabase:
    """Thin wrapper around a single SQLite file storing seen listings."""

    def __init__(self, db_path: Path | str = DEFAULT_DB_PATH) -> None:
        self.db_path = Path(db_path)
        with closing(self._connect()) as conn:
            conn.executescript(_SCHEMA)
            conn.commit()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def is_known(self, prop: Property) -> bool:
        """A listing counts as known if its dedup key, URL, or ID was seen before."""
        with closing(self._connect()) as conn:
            row = conn.execute(
                "SELECT 1 FROM properties WHERE dedup_key = ? OR url = ? "
                "OR (provider = ? AND provider_id = ?) LIMIT 1",
                (prop.dedup_key(), prop.url, prop.provider, prop.id),
            ).fetchone()
        return row is not None

    def save(self, prop: Property, notified: bool = False) -> None:
        """Persist a newly-seen listing. No-op if it already exists."""
        with closing(self._connect()) as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO properties (
                    dedup_key, provider, provider_id, title, price, city, address,
                    living_area, plot, rooms, url, images, latitude, longitude,
                    distance_km, first_seen_at, notified_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    prop.dedup_key(),
                    prop.provider,
                    prop.id,
                    prop.title,
                    prop.price,
                    prop.city,
                    prop.address,
                    prop.living_area,
                    prop.plot,
                    prop.rooms,
                    prop.url,
                    json.dumps(prop.images),
                    prop.latitude,
                    prop.longitude,
                    prop.distance_km,
                    utcnow().isoformat(),
                    utcnow().isoformat() if notified else None,
                ),
            )
            conn.commit()

    def mark_notified(self, prop: Property) -> None:
        with closing(self._connect()) as conn:
            conn.execute(
                "UPDATE properties SET notified_at = ? WHERE dedup_key = ?",
                (utcnow().isoformat(), prop.dedup_key()),
            )
            conn.commit()

    def count(self) -> int:
        with closing(self._connect()) as conn:
            (total,) = conn.execute("SELECT COUNT(*) FROM properties").fetchone()
        return total
