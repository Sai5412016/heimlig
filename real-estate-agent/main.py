#!/usr/bin/env python3
"""Entry point: run one search-filter-notify cycle.

Invoked directly (``python main.py``) or on a schedule via
``.github/workflows/search.yml`` (every 15 minutes). Designed to be
idempotent and safe to re-run: already-known listings are never
re-notified, and a failure in any single search source never prevents the
others from running.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import yaml

from filter.filters import apply_filters
from notify.email import EmailNotifier
from notify.telegram import TelegramNotifier
from search import PROVIDERS
from search.base import SearchProvider
from storage.database import PropertyDatabase
from utils.logger import get_logger
from utils.models import Property, SearchCriteria

logger = get_logger(__name__)

CONFIG_PATH = Path(__file__).resolve().parent / "config.yaml"


def load_config(path: Path = CONFIG_PATH) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def build_providers(config: dict, criteria: SearchCriteria) -> list[SearchProvider]:
    """Instantiate every source enabled in config.yaml's search.sources."""
    providers: list[SearchProvider] = []
    sources_config = config.get("search", {}).get("sources", {})

    for source_name, source_config in sources_config.items():
        if not source_config or not source_config.get("enabled", False):
            continue
        provider_cls = PROVIDERS.get(source_name)
        if provider_cls is None:
            logger.warning("Unknown search source %r in config.yaml, skipping", source_name)
            continue
        search_url = source_config.get("search_url", "")
        providers.append(provider_cls(criteria, search_url=search_url))

    return providers


def collect_listings(providers: list[SearchProvider], request_delay_seconds: float) -> list[Property]:
    """Run every provider, isolating failures so one bad source never stops the rest."""
    all_properties: list[Property] = []
    for provider in providers:
        try:
            results = provider.search()
        except Exception:
            logger.exception("Search source %r raised an unhandled error; continuing with other sources", provider.name)
            continue
        logger.info("%s: found %d listings", provider.name, len(results))
        all_properties.extend(results)
        time.sleep(request_delay_seconds)
    return all_properties


def notify_new_property(prop: Property, config: dict) -> None:
    notify_config = config.get("notify", {})

    if notify_config.get("telegram", {}).get("enabled", True):
        telegram = TelegramNotifier()
        if telegram.notify(prop):
            logger.info("Telegram notification sent for %s", prop.url)

    if notify_config.get("email", {}).get("enabled", False):
        email = EmailNotifier()
        if email.notify(prop):
            logger.info("Email notification sent for %s", prop.url)


def run(config_path: Path = CONFIG_PATH) -> int:
    start_time = time.monotonic()
    logger.info("Starting real estate agent run")

    try:
        config = load_config(config_path)
    except (OSError, yaml.YAMLError):
        logger.exception("Failed to load config.yaml")
        return 1

    criteria = SearchCriteria.from_config(config)
    providers = build_providers(config, criteria)
    if not providers:
        logger.warning("No search sources are enabled/configured - nothing to do")

    request_delay = float(config.get("request_delay_seconds", 2))
    found = collect_listings(providers, request_delay)
    logger.info("Found %d listings across %d source(s)", len(found), len(providers))

    accepted = apply_filters(found, criteria)

    db = PropertyDatabase()
    new_count = 0
    for prop in accepted:
        if db.is_known(prop):
            continue
        new_count += 1
        notify_new_property(prop, config)
        db.save(prop, notified=True)

    duration = time.monotonic() - start_time
    logger.info(
        "Run finished: %d found, %d passed filters, %d new, %d known in database (%.1fs)",
        len(found),
        len(accepted),
        new_count,
        db.count(),
        duration,
    )
    return 0


if __name__ == "__main__":
    sys.exit(run())
