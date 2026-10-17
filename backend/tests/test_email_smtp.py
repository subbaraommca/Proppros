"""SMTP provider (e.g. Gmail app password), with smtplib mocked."""
import smtplib

from app.core import email as mail
from app.core.config import settings


class FakeSMTP:
    instances: list["FakeSMTP"] = []
    fail_login = False

    def __init__(self, host, port, timeout=None):
        self.host, self.port, self.sent, self.tls = host, port, [], False
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self, context=None):
        self.tls = True

    def login(self, user, password):
        if FakeSMTP.fail_login:
            raise smtplib.SMTPAuthenticationError(535, b"bad credentials")
        self.login_args = (user, password)

    def send_message(self, msg):
        self.sent.append(msg)


def _gmail(monkeypatch):
    FakeSMTP.instances, FakeSMTP.fail_login = [], False
    monkeypatch.setattr(mail.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(settings, "smtp_host", "smtp.gmail.com")
    monkeypatch.setattr(settings, "smtp_user", "owner@gmail.com")
    monkeypatch.setattr(settings, "smtp_password", "abcd efgh ijkl mnop")
    monkeypatch.setattr(settings, "email_from", "Proppros <owner@gmail.com>")


def test_smtp_sends_html_with_attachment(monkeypatch):
    _gmail(monkeypatch)
    assert settings.email_provider == "smtp"
    ok, err = mail.send_email(
        "tenant@example.com",
        "Payment received",
        mail.layout("Payment received", "<p>Thanks!</p>", "View", "https://proppros.vercel.app/portal"),
        attachments=[mail.Attachment("receipt.pdf", b"%PDF-1.4")],
    )
    assert ok and err is None
    smtp = FakeSMTP.instances[0]
    assert (smtp.host, smtp.port, smtp.tls) == ("smtp.gmail.com", 587, True)
    assert smtp.login_args == ("owner@gmail.com", "abcdefghijklmnop")  # spaces stripped
    msg = smtp.sent[0]
    assert msg["From"] == "Proppros <owner@gmail.com>" and msg["To"] == "tenant@example.com"
    parts = [p.get_content_type() for p in msg.walk()]
    assert "text/plain" in parts and "text/html" in parts and "application/pdf" in parts
    plain = next(p for p in msg.walk() if p.get_content_type() == "text/plain").get_content()
    assert "https://proppros.vercel.app/portal" in plain  # links survive in the text version


def test_smtp_auth_failure_is_reported_not_raised(monkeypatch):
    _gmail(monkeypatch)
    FakeSMTP.fail_login = True
    assert mail.send_email("t@example.com", "Hi", "<p>x</p>") == (False, "smtp auth failed")


def test_smtp_takes_precedence_and_health_shows_it(client, monkeypatch):
    _gmail(monkeypatch)
    monkeypatch.setattr(settings, "resend_api_key", "re_x")
    email = client.get("/api/health").json()["email"]
    assert email["provider"] == "smtp" and email["from_domain"] == "gmail.com"
    assert all(email["smtp_settings_present"].values())
