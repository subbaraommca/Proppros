"""Mobile push notifications through Expo's push service (works for iOS and Android builds made with EAS).

Expo push tokens are not secret credentials, but they're tied to a user, so a device is registered only by a
signed-in user and removed on sign-out or when Expo reports it unregistered.
"""
import logging
import uuid
from typing import Any

import httpx
from sqlmodel import Session, select

from app.core.config import settings
from app.models import Membership, PushDevice, utcnow

logger = logging.getLogger(__name__)
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
outbox: list[dict] = []  # pushes "sent" in tests / when disabled


def register(session: Session, user_id: uuid.UUID, token: str, platform: str) -> PushDevice:
    device = session.exec(select(PushDevice).where(PushDevice.token == token)).first()
    if device:
        device.user_id = user_id  # a phone handed to another user re-registers under them
        device.platform = platform
        device.last_seen_at = utcnow()
    else:
        device = PushDevice(user_id=user_id, token=token, platform=platform)
    session.add(device)
    session.commit()
    return device


def unregister(session: Session, user_id: uuid.UUID, token: str) -> None:
    device = session.exec(select(PushDevice).where(PushDevice.token == token, PushDevice.user_id == user_id)).first()
    if device:
        session.delete(device)
        session.commit()


def staff_user_ids(session: Session, org_id: uuid.UUID, roles=("owner", "manager")) -> list[uuid.UUID]:
    return list(session.exec(select(Membership.user_id).where(Membership.org_id == org_id, Membership.role.in_(roles))).all())


def send(session: Session, user_ids: list[uuid.UUID | None], title: str, body: str, data: dict[str, Any] | None = None) -> int:
    """Send to every device of these users. Returns the number of messages handed to Expo. Never raises."""
    ids = [u for u in dict.fromkeys(user_ids) if u]
    if not ids:
        return 0
    devices = session.exec(select(PushDevice).where(PushDevice.user_id.in_(ids))).all()
    if not devices:
        return 0
    messages = [{"to": d.token, "title": title[:100], "body": body[:240], "data": data or {}, "sound": "default", "channelId": "default"} for d in devices]
    if not settings.push_enabled:
        outbox.extend(messages)
        return len(messages)
    sent = 0
    try:
        for i in range(0, len(messages), 100):
            chunk = messages[i : i + 100]
            headers = {"Accept": "application/json", "Content-Type": "application/json"}
            if settings.expo_access_token:
                headers["Authorization"] = f"Bearer {settings.expo_access_token}"
            resp = httpx.post(EXPO_PUSH_URL, json=chunk, headers=headers, timeout=10)
            if resp.status_code >= 400:
                logger.error("Expo push error %s: %s", resp.status_code, resp.text[:300])
                continue
            tickets = resp.json().get("data", [])
            for msg, ticket in zip(chunk, tickets):
                if ticket.get("status") == "ok":
                    sent += 1
                elif (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                    stale = session.exec(select(PushDevice).where(PushDevice.token == msg["to"])).first()
                    if stale:
                        session.delete(stale)
        session.commit()
    except Exception:  # noqa: BLE001 — notifications must never break the request that triggered them
        logger.exception("Expo push failed")
        session.rollback()
    return sent
