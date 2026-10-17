"""Transactional email via SMTP (e.g. Gmail app password) or Resend's HTTP API.

Provider: SMTP when SMTP_HOST/USER/PASSWORD are set, else Resend when
RESEND_API_KEY is set, else emails are only logged (local dev).

Sent inline (not in BackgroundTasks): on Vercel the function may be frozen as
soon as the response is returned, so post-response work is not guaranteed.
"""
import base64
import html as _html
import logging
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import make_msgid
from dataclasses import dataclass

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_URL = "https://api.resend.com/emails"

# Tests and dev inspect this instead of a real inbox.
outbox: list[dict] = []


@dataclass
class Attachment:
    filename: str
    content: bytes


def esc(value: object) -> str:
    return _html.escape(str(value), quote=True)


def layout(title: str, body_html: str, cta_label: str | None = None, cta_url: str | None = None) -> str:
    button = ""
    if cta_label and cta_url:
        button = (
            f'<p style="margin:24px 0"><a href="{esc(cta_url)}" style="display:inline-block;padding:12px 22px;'
            f'background:#a4502a;color:#ffffff;border-radius:0;text-decoration:none;font-weight:600">'
            f"{esc(cta_label)}</a></p>"
        )
    return (
        '<div style="font-family:DM Sans,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">'
        '<p style="font-weight:800;font-size:18px;color:#14110f;letter-spacing:-0.01em;margin:0 0 16px">Proppros</p>'
        f'<h2 style="font-size:20px;margin:0 0 12px">{esc(title)}</h2>'
        f"{body_html}{button}"
        '<p style="color:#64748b;font-size:12px;margin-top:32px">You received this email from Proppros.</p>'
        "</div>"
    )


def send_email(
    to: list[str] | str,
    subject: str,
    html: str,
    text: str | None = None,
    attachments: list[Attachment] | None = None,
) -> tuple[bool, str | None]:
    """Send an email. Returns (ok, error)."""
    recipients = [to] if isinstance(to, str) else [r for r in to if r]
    if not recipients:
        return False, "no recipients"
    message = {"from": settings.email_from, "to": recipients, "subject": subject, "html": html}
    if text:
        message["text"] = text
    if attachments:
        message["attachments"] = [
            {"filename": a.filename, "content": base64.b64encode(a.content).decode()} for a in attachments
        ]

    provider = settings.email_provider
    if provider == "log-only":
        outbox.append(message)
        links = re.findall(r'href="([^"]+)"', html)
        logger.info("Email (not sent, no email provider configured) to=%s subject=%r links=%s", recipients, subject, links)
        return True, None
    if provider == "smtp":
        return _send_smtp(recipients, subject, html, text, attachments)

    try:
        resp = httpx.post(
            RESEND_URL,
            json=message,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            timeout=10,
        )
        if resp.status_code >= 400:
            logger.error("Resend error %s: %s", resp.status_code, resp.text[:300])
            return False, f"resend {resp.status_code}"
        return True, None
    except httpx.HTTPError as exc:
        logger.error("Resend request failed: %s", exc)
        return False, str(exc)


def _plain_text(html: str) -> str:
    text = re.sub(r"<(br|/p|/h2|/div)>", "\n", html)
    text = re.sub(r'<a [^>]*href="([^"]+)"[^>]*>([^<]*)</a>', lambda m: f"{m.group(2)}: {m.group(1)}", text)
    return _html.unescape(re.sub(r"<[^>]+>", "", text)).strip()


def _send_smtp(recipients, subject, html, text, attachments) -> tuple[bool, str | None]:
    msg = EmailMessage()
    msg["From"] = settings.email_from
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject
    msg["Message-ID"] = make_msgid(domain=settings.smtp_user.split("@")[-1] or None)
    msg.set_content(text or _plain_text(html))
    msg.add_alternative(html, subtype="html")
    for a in attachments or []:
        maintype, subtype = ("application", "pdf") if a.filename.lower().endswith(".pdf") else ("application", "octet-stream")
        msg.add_attachment(a.content, maintype=maintype, subtype=subtype, filename=a.filename)
    # Google shows app passwords in groups of four; spaces aren't part of it.
    password = settings.smtp_password.replace(" ", "")
    try:
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, 465, timeout=15, context=ssl.create_default_context()) as smtp:
                smtp.login(settings.smtp_user, password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                smtp.login(settings.smtp_user, password)
                smtp.send_message(msg)
        return True, None
    except smtplib.SMTPAuthenticationError as exc:
        logger.error("SMTP login failed for %s (check the app password): %s", settings.smtp_user, exc.smtp_code)
        return False, "smtp auth failed"
    except (smtplib.SMTPException, OSError) as exc:
        logger.error("SMTP send failed: %s", exc)
        return False, f"smtp error: {type(exc).__name__}"
