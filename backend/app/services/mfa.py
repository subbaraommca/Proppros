"""Two-factor authentication with TOTP authenticator apps (Google Authenticator, 1Password, Authy…)."""
from __future__ import annotations

import hashlib
import secrets

import pyotp
import segno

from app.models import User

ISSUER = "Proppros"
RECOVERY_CODES = 10


def new_secret() -> str:
    return pyotp.random_base32()


def provisioning(user: User, secret: str) -> dict[str, str]:
    uri = pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name=ISSUER)
    qr = segno.make(uri, error="m").svg_data_uri(scale=5, border=2, dark="#111217", light="#ffffff")
    return {"secret": secret, "otpauth_uri": uri, "qr_svg_data_uri": qr}


def verify_totp(secret: str | None, code: str) -> bool:
    code = (code or "").replace(" ", "").strip()
    if not secret or not code.isdigit() or len(code) != 6:
        return False
    return pyotp.TOTP(secret).verify(code, valid_window=1)  # ±30 s clock drift


def _hash(code: str) -> str:
    return hashlib.sha256(code.replace("-", "").strip().lower().encode()).hexdigest()


def new_recovery_codes() -> tuple[list[str], list[str]]:
    """Returns (plain codes to show once, hashes to store)."""
    codes = [f"{secrets.token_hex(2)}-{secrets.token_hex(2)}-{secrets.token_hex(2)}" for _ in range(RECOVERY_CODES)]
    return codes, [_hash(c) for c in codes]


def use_recovery_code(user: User, code: str) -> bool:
    """Consumes a recovery code if it matches. Caller must persist `user`."""
    h = _hash(code or "")
    if h in (user.mfa_recovery_codes or []):
        user.mfa_recovery_codes = [x for x in user.mfa_recovery_codes if x != h]
        return True
    return False


def verify_second_factor(user: User, code: str) -> bool:
    return verify_totp(user.mfa_secret, code) or use_recovery_code(user, code)
