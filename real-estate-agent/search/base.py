"""Common interface and shared safeguards for all search providers."""

from __future__ import annotations

import abc
import urllib.robotparser
from urllib.parse import urlparse

import requests

from utils.logger import get_logger
from utils.models import Property, SearchCriteria

logger = get_logger(__name__)

#: Identifies the agent transparently. Never spoof a browser UA to bypass
#: bot detection - if a source blocks this UA, it must not be scraped.
USER_AGENT = "HeimligRealEstateAgent/1.0 (+personal, non-commercial use)"

REQUEST_TIMEOUT_SECONDS = 15


class SearchProvider(abc.ABC):
    """Base class every real estate source must implement.

    Design rules (do not weaken these in subclasses):

    1. Only fetch pages a normal browser could load without logging in.
    2. Never bypass CAPTCHAs, rate limiting, logins or other technical
       protection measures, and never spoof a browser fingerprint.
    3. Always check ``robots.txt`` via :meth:`_get` before fetching a URL.
       If it disallows the path, skip that source for this run (log a
       warning) instead of fetching anyway.
    4. A failure in one provider must never raise past ``search()`` calls
       in ``main.py`` - catch and log locally where sensible, but it is
       also fine to let exceptions propagate, since the orchestrator
       already isolates each provider in its own try/except.
    """

    #: Short key used in config.yaml's ``search.sources`` list.
    name: str = "base"
    #: Scheme+host used for robots.txt lookups, e.g. "https://example.com".
    base_url: str = ""

    def __init__(self, criteria: SearchCriteria, session: requests.Session | None = None) -> None:
        self.criteria = criteria
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self._robots_cache: dict[str, urllib.robotparser.RobotFileParser] = {}

    @abc.abstractmethod
    def search(self) -> list[Property]:
        """Run the search and return results in the unified ``Property`` shape."""
        raise NotImplementedError

    def _robots_allows(self, url: str) -> bool:
        """Check the target's robots.txt before ever requesting ``url``."""
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        parser = self._robots_cache.get(origin)
        if parser is None:
            parser = urllib.robotparser.RobotFileParser()
            parser.set_url(f"{origin}/robots.txt")
            try:
                parser.read()
            except Exception as exc:  # noqa: BLE001 - any fetch failure means "assume disallowed"
                logger.warning(
                    "%s: could not read robots.txt (%s); refusing to fetch %s", self.name, exc, url
                )
                parser = None
            self._robots_cache[origin] = parser
        if parser is None:
            return False
        allowed = parser.can_fetch(USER_AGENT, url)
        if not allowed:
            logger.warning("%s: robots.txt disallows %s - skipping this source this run", self.name, url)
        return allowed

    def _get(self, url: str, **kwargs) -> requests.Response | None:
        """GET ``url`` if (and only if) robots.txt allows it.

        Returns ``None`` when disallowed or on a request error, so callers
        can simply treat "no response" as "no results this run" rather
        than crashing the whole agent.
        """
        if not self._robots_allows(url):
            return None
        try:
            response = self.session.get(url, timeout=REQUEST_TIMEOUT_SECONDS, **kwargs)
            response.raise_for_status()
        except requests.RequestException as exc:
            logger.error("%s: request to %s failed: %s", self.name, url, exc)
            return None
        return response
