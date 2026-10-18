"""Text messages through Twilio's REST API (no SDK). Without credentials, texts are logged, like emails."""
import base64
import hashlib
import hmac
import logging
import re
import uuid

import httpx
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.config import settings
from app.models import Notification

logger = logging.getLogger(__name__)
outbox: list[dict] = []  # texts "sent" while Twilio isn't configured (and in tests)
MAX_LEN = 600  # keep texts to a few segments


def normalize_phone(raw: str | None) -> str | None:
    """US-friendly E.164: '(602) 555-0110' → '+16025550110'. Returns None if it can't be a phone number."""
    if not raw:
        return None
    raw = raw.strip()
    digits = re.sub(r"\D", "", raw)
    if raw.startswith("+") and 8 <= len(digits) <= 15:
        return "+" + digits
    if len(digits) == 10:
        return "+1" + digits
    if len(digits) == 11 and digits.startswith("1"):
        return "+" + digits
    return None


def send_sms(to: str, body: str) -> tuple[bool, str | None]:
    number = normalize_phone(to)
    if not number:
        return False, "invalid phone number"
    body = body if len(body) <= MAX_LEN else body[: MAX_LEN - 1] + "…"
    if not settings.sms_enabled:
        outbox.append({"to": number, "body": body})
        logger.info("SMS (not sent, Twilio not configured) to=%s body=%r", number, body)
        return True, None
    sender = {"MessagingServiceSid": settings.twilio_from_number} if settings.twilio_from_number.startswith("MG") else {"From": settings.twilio_from_number}
    try:
        resp = httpx.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json",
            data={"To": number, "Body": body, **sender},
            auth=(settings.twilio_account_sid, settings.twilio_auth_token),
            timeout=10,
        )
        if resp.status_code >= 400:
            logger.error("Twilio error %s: %s", resp.status_code, resp.text[:300])
            return False, f"twilio {resp.status_code}"
        return True, None
    except httpx.HTTPError as exc:
        logger.error("Twilio request failed: %s", exc)
        return False, str(exc)


def text(session: Session, org_id: uuid.UUID, template: str, to: str, body: str, dedupe_key: str | None = None) -> bool:
    """Send a text and record it in `notifications` (to_email holds the phone number for SMS rows)."""
    number = normalize_phone(to)
    if not number:
        return False
    if dedupe_key and session.exec(select(Notification.id).where(Notification.dedupe_key == dedupe_key)).first():
        return False
    ok, error = send_sms(number, body)
    session.add(
        Notification(
            org_id=org_id,
            template=f"sms_{template}"[:40],
            to_email=number,
            subject=body[:200],
            dedupe_key=dedupe_key if ok else None,
            status="sent" if ok else "failed",
            error=(error or None) and error[:300],
        )
    )
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
    return ok


def valid_twilio_signature(url: str, params: dict[str, str], signature: str) -> bool:
    """X-Twilio-Signature: base64(HMAC-SHA1(auth_token, url + sorted key/value pairs))."""
    if not settings.twilio_auth_token or not signature:
        return False
    payload = url + "".join(f"{k}{params[k]}" for k in sorted(params))
    digest = hmac.new(settings.twilio_auth_token.encode(), payload.encode(), hashlib.sha1).digest()
    return hmac.compare_digest(base64.b64encode(digest).decode(), signature)
