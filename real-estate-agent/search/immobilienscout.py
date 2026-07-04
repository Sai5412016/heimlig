"""ImmobilienScout24 search provider.

ImmobilienScout24 does not offer a public API for private/individual use.
Rather than guessing at undocumented search-query parameters (which break
constantly and would encourage poking at the site), this provider expects
*you* to build the search on immobilienscout24.de yourself - with exactly
the filters you want - and paste the resulting results-page URL into
``config.yaml`` under ``search.sources.immobilienscout.search_url``. The
provider then just periodically re-fetches that URL and parses the listed
results; it never logs in, solves CAPTCHAs, or otherwise circumvents any
protection the site puts up, and always checks ``robots.txt`` first (see
``search/base.py``).

Maintenance note: the CSS selectors in ``_parse_listings`` reflect the
public results page layout at the time of writing. Listing sites change
their markup periodically; if this provider starts returning zero results
even though the ``search_url`` clearly has hits in a browser, open the page
in your browser's dev tools and update the selectors below.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from search.base import SearchProvider
from utils.logger import get_logger
from utils.models import Property

logger = get_logger(__name__)

_PRICE_RE = re.compile(r"[\d.,]+")


class ImmobilienScoutProvider(SearchProvider):
    name = "immobilienscout"
    base_url = "https://www.immobilienscout24.de"

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

        cards = soup.select("[data-item='result-list-entry']") or soup.select("article")
        for card in cards:
            listing_id = card.get("data-obid") or card.get("id")
            link = card.select_one("a[href*='/expose/']")
            if not link or not link.get("href"):
                continue
            url = link["href"]
            if url.startswith("/"):
                url = self.base_url + url
            if not listing_id:
                match = re.search(r"/expose/(\d+)", url)
                listing_id = match.group(1) if match else url

            title_el = card.select_one("h2") or card.select_one("[data-item='title']")
            title = title_el.get_text(strip=True) if title_el else "Unbekanntes Objekt"

            price = self._extract_number(card, "[data-item='purchase-price'], .result-list-entry__criteria dd")
            living_area = self._extract_number(card, "[data-item='livingSpace']")
            rooms = self._extract_number(card, "[data-item='numberOfRooms']")
            plot = self._extract_number(card, "[data-item='plotArea']")

            address_el = card.select_one("[data-item='address'], .result-list-entry__address")
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
                    plot=plot,
                    rooms=rooms,
                    url=url,
                    images=images,
                )
            )

        if not properties:
            logger.info(
                "%s: parsed 0 listings from %s - either there are truly none, or the "
                "page markup changed and selectors need updating (see module docstring)",
                self.name,
                self.search_url,
            )
        return properties

    @staticmethod
    def _extract_number(card, selector: str) -> float | None:
        el = card.select_one(selector)
        if not el:
            return None
        match = _PRICE_RE.search(el.get_text())
        if not match:
            return None
        raw = match.group(0).replace(".", "").replace(",", ".")
        try:
            return float(raw)
        except ValueError:
            return None
