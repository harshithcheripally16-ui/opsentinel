"""
app/utils.py
------------
Shared, stateless helper functions used across routes and services.
No Flask imports here — pure Python so this stays easily testable.
"""

import os
import time
import requests
from functools import wraps
from flask import session, redirect, url_for, flash

# ------------------------------------------------------------------ #
# Telegram                                                             #
# ------------------------------------------------------------------ #
_TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
_TELEGRAM_CHAT_ID   = os.getenv("TELEGRAM_CHAT_ID")


def send_telegram_alert(message: str) -> None:
    """Send a message to the configured Telegram chat. Silently no-ops if
    credentials are not set."""
    if not _TELEGRAM_BOT_TOKEN or not _TELEGRAM_CHAT_ID:
        print("Telegram credentials missing, alert not sent.")
        return
    url = f"https://api.telegram.org/bot{_TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        requests.post(url, json={"chat_id": _TELEGRAM_CHAT_ID, "text": message}, timeout=10)
    except Exception as e:
        print(f"Failed to send Telegram alert: {e}")


# ------------------------------------------------------------------ #
# Metrics                                                              #
# ------------------------------------------------------------------ #
ALERT_THRESHOLD = 80  # percentage above which a metric is considered high


def format_metric(value: float) -> str:
    """Return a display-ready percentage string, e.g. 73.4 → '73.4%'."""
    return f"{value:.1f}%"


def get_high_usage_issues(cpu: float, memory: float, disk: float) -> list[str]:
    """Return a list of human-readable issue strings for any metric over
    ALERT_THRESHOLD. Empty list means everything is healthy.

    Example: [\"CPU at 92.0%\", \"Memory at 85.3%\"]
    """
    issues = []
    if cpu    > ALERT_THRESHOLD: issues.append(f"CPU at {format_metric(cpu)}")
    if memory > ALERT_THRESHOLD: issues.append(f"Memory at {format_metric(memory)}")
    if disk   > ALERT_THRESHOLD: issues.append(f"Disk at {format_metric(disk)}")
    return issues


# ------------------------------------------------------------------ #
# Alert throttling                                                     #
# ------------------------------------------------------------------ #
_last_alert_time: float = 0
ALERT_COOLDOWN_SECONDS = 60


def should_send_alert() -> bool:
    """Return True if enough time has passed since the last alert was sent,
    and update the internal timestamp if so."""
    global _last_alert_time
    now = time.time()
    if now - _last_alert_time >= ALERT_COOLDOWN_SECONDS:
        _last_alert_time = now
        return True
    return False


# ------------------------------------------------------------------ #
# API responses                                                        #
# ------------------------------------------------------------------ #
def ok_response(data: dict) -> dict:
    """Wrap a successful payload in a standard envelope.

    { \"status\": \"ok\", \"data\": { ... } }
    """
    return {"status": "ok", "data": data}


def error_response(message: str) -> tuple[dict, int]:
    """Return a standard error envelope with HTTP 400.

    ({ \"status\": \"error\", \"message\": \"...\" }, 400)
    """
    return {"status": "error", "message": message}, 400


# ------------------------------------------------------------------ #
# Auth Decorators                                                     #
# ------------------------------------------------------------------ #
def login_required(f):
    """Decorator to protect routes from unauthenticated access."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("user"):
            flash("Please sign in to access this page.", "error")
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return decorated_function
