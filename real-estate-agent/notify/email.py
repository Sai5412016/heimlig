"""Optional email notifications via plain SMTP.

Disabled unless ``notify.email.enabled`` is set in config.yaml *and*
credentials are present in the environment (see README). Uses the
standard library only, no extra dependency for a rarely-needed channel.
"""

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage

from utils.logger import get_logger
from utils.models import Property

logger = get_logger(__name__)


class EmailNotifier:
    """Sends one plain-text email per new listing via SMTP."""

    def __init__(
        self,
        smtp_host: str | None = None,
        smtp_port: int | None = None,
        username: str | None = None,
        password: str | None = None,
        recipient: str | None = None,
        use_tls: bool = True,
    ) -> None:
        self.smtp_host = smtp_host or os.environ.get("SMTP_HOST")
        self.smtp_port = smtp_port or int(os.environ.get("SMTP_PORT", "587"))
        self.username = username or os.environ.get("SMTP_USER")
        self.password = password or os.environ.get("SMTP_PASSWORD")
        self.recipient = recipient or os.environ.get("EMAIL_TO")
        self.use_tls = use_tls

    @property
    def is_configured(self) -> bool:
        return bool(self.smtp_host and self.username and self.password and self.recipient)

    def notify(self, prop: Property) -> bool:
        if not self.is_configured:
            logger.warning("Email notifier not configured; skipping")
            return False

        message = EmailMessage()
        message["Subject"] = f"Neues Objekt: {prop.title}"
        message["From"] = self.username
        message["To"] = self.recipient
        message.set_content(
            f"{prop.title}\n\n"
            f"Preis: {prop.price}\n"
            f"Ort: {prop.city}\n"
            f"Wohnfläche: {prop.living_area} m²\n"
            f"Zimmer: {prop.rooms}\n"
            f"Link: {prop.url}\n"
            f"Quelle: {prop.provider}\n"
        )

        try:
            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10) as smtp:
                if self.use_tls:
                    smtp.starttls()
                smtp.login(self.username, self.password)
                smtp.send_message(message)
        except (smtplib.SMTPException, OSError) as exc:
            logger.error("Email notification failed for %s: %s", prop.url, exc)
            return False
        return True
