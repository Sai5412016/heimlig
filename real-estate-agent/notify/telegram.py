"""Telegram notifications - the agent's primary notification channel.

Credentials (bot token, chat ID) are read from environment variables
rather than ``config.yaml`` so they never end up committed to git; see the
README for how to set them as GitHub Actions secrets.
"""

from __future__ import annotations

import os

import requests

from utils.logger import get_logger
from utils.models import Property

logger = get_logger(__name__)

TELEGRAM_API_URL = "https://api.telegram.org/bot{token}/sendMessage"

_TYPE_EMOJI = {
    "house": "🏡",
    "apartment": "🏢",
}


class TelegramNotifier:
    """Sends one formatted message per new listing to a Telegram chat."""

    def __init__(self, bot_token: str | None = None, chat_id: str | None = None) -> None:
        self.bot_token = bot_token or os.environ.get("TELEGRAM_BOT_TOKEN")
        self.chat_id = chat_id or os.environ.get("TELEGRAM_CHAT_ID")

    @property
    def is_configured(self) -> bool:
        return bool(self.bot_token and self.chat_id)

    def notify(self, prop: Property) -> bool:
        """Send a single listing notification. Returns True on success."""
        if not self.is_configured:
            logger.warning("Telegram notifier not configured (missing bot token/chat id); skipping")
            return False

        message = format_message(prop)
        url = TELEGRAM_API_URL.format(token=self.bot_token)
        try:
            response = requests.post(
                url,
                data={
                    "chat_id": self.chat_id,
                    "text": message,
                    "disable_web_page_preview": False,
                },
                timeout=10,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            logger.error("Telegram notification failed for %s: %s", prop.url, exc)
            return False
        return True


def format_message(prop: Property) -> str:
    emoji = _TYPE_EMOJI.get(_guess_type(prop), "🏠")
    lines = [f"{emoji} Neues Objekt gefunden", "", prop.title, ""]

    if prop.price is not None:
        lines += [f"Preis: {prop.price:,.0f} €".replace(",", "."), ""]
    if prop.city:
        lines += [f"Ort: {prop.city}", ""]
    if prop.living_area is not None:
        lines += [f"Wohnfläche: {prop.living_area:.0f} m²", ""]
    if prop.plot is not None:
        lines += [f"Grundstück: {prop.plot:.0f} m²", ""]
    if prop.rooms is not None:
        lines += [f"Zimmer: {prop.rooms:g}", ""]
    if prop.distance_km is not None:
        lines += [f"Entfernung: {prop.distance_km:.0f} km", ""]

    lines += [f"Link: {prop.url}", "", f"Quelle: {prop.provider}"]
    return "\n".join(lines)


def _guess_type(prop: Property) -> str:
    title = prop.title.lower()
    if "wohnung" in title:
        return "apartment"
    return "house"
