"""Immowelt search provider.

Same approach as ``search/immobilienscout.py``: Immowelt has no public API
for individuals, so this provider re-fetches a results-page URL that you
build yourself on immowelt.de (with your desired filters) and configure as
``search.sources.immowelt.search_url``. It never logs in or bypasses any
protection mechanism, and always honors ``robots.txt`` first.

Maintenance note: see the equivalent note in ``search/immobilienscout.py`` -
if this starts returning 0 results despite visible listings in a browser,
the selectors below likely need updating to match the current markup.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from search.base import SearchProvider
from utils.logger import get_logger
from utils.models import Property

logger = get_logger(__name__)

_NUMBER_RE = re.compile(r"[\d.,]+")


class ImmoweltProvider(SearchProvider):
    name = "immowelt"
    base_url = "https://www.immowelt.de"

    def __init__(self, criteria, search_url: str, session=None) -> None:
        super().__init__(criteria, session=session)
        self.search_url = search_url

    def search(self) -> list[Property]:
        if not self.search_url:
            logger.warning("%s: no search_url configured, skipping", self.name)
            return []

        response = self._get(self.search_url)
        if response is None:
            return []

        return self._parse_listings(response.text)

    def _parse_listings(self, html: str) -> list[Property]:
        soup = BeautifulSoup(html, "html.parser")
        properties: list[Property] = []

        cards = soup.select("[data-testid='serp-card']") or soup.select("article")
        for card in cards:
            link = card.select_one("a[href*='/expose/']") or card.select_one("a[href]")
            if not link or not link.get("href"):
                continue
            url = link["href"]
            if url.startswith("/"):
                url = self.base_url + url
            match = re.search(r"/expose/([A-Za-z0-9]+)", url)
            listing_id = match.group(1) if match else url

            title_el = card.select_one("h2") or card.select_one("[data-testid='card-title']")
            title = title_el.get_text(strip=True) if title_el else "Unbekanntes Objekt"

            price = self._extract_number(card, "[data-testid='card-price'], .hardfact")
            living_area = self._extract_number(card, "[data-testid='card-area']")
            rooms = self._extract_number(card, "[data-testid='card-rooms']")

            address_el = card.select_one("[data-testid='card-address']")
            address = address_el.get_text(strip=True) if address_el else None
            city = address.split(",")[-1].strip() if address else None

            images = [img["src"] for img in card.select("img[src]") if img.get("src", "").startswith("http")]

            properties.append(
                Property(
                    id=str(listing_id),
                    provider=self.name,
                    title=title,
                    price=price,
                    city=city,
                    address=address,
                    living_area=living_area,
                    plot=None,
                    rooms=rooms,
                    url=url,
                    images=images,
                )
            )

        if not properties:
            logger.info(
                "%s: parsed 0 listings from %s - check selectors if listings are visible in a browser",
                self.name,
                self.search_url,
            )
        return properties

    @staticmethod
    def _extract_number(card, selector: str) -> float | None:
        el = card.select_one(selector)
        if not el:
            return None
        match = _NUMBER_RE.search(el.get_text())
        if not match:
            return None
        raw = match.group(0).replace(".", "").replace(",", ".")
        try:
            return float(raw)
        except ValueError:
            return None
