"""Central logging configuration for the agent.

All modules should call ``get_logger(__name__)`` instead of configuring
``logging`` themselves, so that GitHub Actions logs and the local log file
stay consistent.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

LOG_FILE = Path(__file__).resolve().parent.parent / "agent.log"
_CONFIGURED = False


def setup_logging(level: int = logging.INFO) -> None:
    """Configure the root logger once (console + rotating-by-run file)."""
    global _CONFIGURED
    if _CONFIGURED:
        return

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)

    file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
    file_handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(level)
    root.addHandler(console_handler)
    root.addHandler(file_handler)

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Return a module-level logger, configuring logging on first use."""
    setup_logging()
    return logging.getLogger(name)
