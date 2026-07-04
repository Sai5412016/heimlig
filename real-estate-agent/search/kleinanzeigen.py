"""Kleinanzeigen (formerly eBay Kleinanzeigen) search provider.

Same approach as the other providers: no public API for individuals, so
this fetches a results-page URL you build yourself on kleinanzeigen.de and
configure as ``search.sources.kleinanzeigen.search_url``. It never logs in
or bypasses any protection mechanism, and always honors ``robots.txt``
first (see ``search/base.py``).

Maintenance note: see the equivalent note in ``search/immobilienscout.py``.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from search.base import SearchProvider
from utils.logger import get_logger
from utils.models import Property

logger = get_logger(__name__)

_NUMBER_RE = re.compile(r"[\d.,]+")


class KleinanzeigenProvider(SearchProvider):
    name = "kleinanzeigen"
    base_url = "https://www.kleinanzeigen.de"

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

        cards = soup.select("article.aditem") or soup.select("li.ad-listitem")
        for card in cards:
            listing_id = card.get("data-adid")
            link = card.select_one("a.ellipsis") or card.select_one("a[href*='/s-anzeige/']")
            if not link or not link.get("href"):
                continue
            url = link["href"]
            if url.startswith("/"):
                url = self.base_url + url
            if not listing_id:
                match = re.search(r"/(\d+)-", url)
                listing_id = match.group(1) if match else url

            title = link.get_text(strip=True) or "Unbekanntes Objekt"

            price_el = card.select_one(".aditem-main--middle--price-shipping--price, .aditem-main--middle--price")
            price = self._extract_number(price_el)

            address_el = card.select_one(".aditem-main--top--left")
            address = address_el.get_text(strip=True) if address_el else None
            city = address.split(",")[-1].strip() if address else None

            description_el = card.select_one(".aditem-main--middle--description")
            description = description_el.get_text(" ", strip=True) if description_el else ""
            living_area, rooms, plot = self._extract_facts_from_text(description)

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
                    plot=plot,
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
    def _extract_number(el) -> float | None:
        if el is None:
            return None
        match = _NUMBER_RE.search(el.get_text())
        if not match:
            return None
        raw = match.group(0).replace(".", "").replace(",", ".")
        try:
            return float(raw)
        except ValueError:
            return None

    @staticmethod
    def _extract_facts_from_text(text: str) -> tuple[float | None, float | None, float | None]:
        """Kleinanzeigen listing cards embed facts in free text, not fields.

        Best-effort regex extraction of living area / rooms / plot size from
        the description snippet; returns ``None`` for anything not found.
        """
        living_area = None
        rooms = None
        plot = None

        area_match = re.search(r"(\d+[\d.,]*)\s?m²\s?(Wohnfläche)?", text)
        if area_match:
            living_area = float(area_match.group(1).replace(".", "").replace(",", "."))

        rooms_match = re.search(r"(\d+([.,]\d)?)\s?Zimmer", text)
        if rooms_match:
            rooms = float(rooms_match.group(1).replace(",", "."))

        plot_match = re.search(r"Grundstück\D{0,10}(\d+[\d.,]*)\s?m²", text)
        if plot_match:
            plot = float(plot_match.group(1).replace(".", "").replace(",", "."))

        return living_area, rooms, plot
