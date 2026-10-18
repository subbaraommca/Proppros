import secrets
import uuid
from datetime import timedelta
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select

from app.core.config import settings
from app.core.database import get_session
from app.core.deps import COOKIE_NAME, get_current_user, is_superadmin, token_claims
from app.core.email import esc, layout, send_email
from app.core.limiter import rate_limit
from app.core.security import (
    create_access_token,
    decode_token,
    hash_password,
    hash_token,
    new_url_token,
    validate_password_strength,
    verify_password,
)
from app.models import AuthToken, Invitation, Membership, Organization, Tenant, User, utcnow
from app.services import mfa
from app.schemas import (
    PushDeviceIn,
    AcceptInviteIn,
    ChangePasswordIn,
    EmailIn,
    LoginIn,
    MfaCodeIn,
    MfaDisableIn,
    MfaLoginIn,
    ProfileUpdate,
    RegisterIn,
    ResetPasswordIn,
    TokenIn,
)

router = APIRouter(prefix="/auth", tags=["auth"])

VERIFY_HOURS = 48
RESET_HOURS = 2


def _set_cookie(response: Response, user: User) -> str:
    token = create_access_token(str(user.id), {"ver": user.token_version})
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )
    return token


def _issue_token(session: Session, user: User, purpose: str, hours: int) -> str:
    raw, hashed = new_url_token()
    session.add(AuthToken(user_id=user.id, purpose=purpose, token_hash=hashed, expires_at=utcnow() + timedelta(hours=hours)))
    return raw


def _consume_token(session: Session, raw: str, purpose: str) -> User:
    tok = session.exec(select(AuthToken).where(AuthToken.token_hash == hash_token(raw), AuthToken.purpose == purpose)).first()
    if not tok or tok.used_at or tok.expires_at < utcnow():
        raise HTTPException(status_code=400, detail="This link is invalid or has expired.")
    tok.used_at = utcnow()
    session.add(tok)
    user = session.get(User, tok.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="This link is invalid or has expired.")
    return user


def _send_verification(session: Session, user: User) -> None:
    raw = _issue_token(session, user, "verify_email", VERIFY_HOURS)
    link = f"{settings.frontend_url}/verify-email?token={raw}"
    send_email(
        user.email,
        "Verify your Proppros email",
        layout("Confirm your email", f"<p>Hi {esc(user.name)}, please confirm your email address.</p>", "Verify email", link),
    )


MFA_TOKEN_MINUTES = 5


def finish_login(response: Response, session: Session, user: User) -> dict:
    """Password (or Google) checked. With 2FA on, hand back a short-lived second-step token instead of a session."""
    if user.mfa_enabled_at:
        token = create_access_token(str(user.id), {"ver": user.token_version, "purpose": "mfa"}, expires_minutes=MFA_TOKEN_MINUTES)
        return {"mfa_required": True, "mfa_token": token}
    _set_cookie(response, user)
    return me_payload(session, user)


def me_payload(session: Session, user: User, claims: dict | None = None) -> dict:
    memberships = session.exec(select(Membership).where(Membership.user_id == user.id).order_by(Membership.created_at)).all()
    orgs = []
    for m in memberships:
        org = session.get(Organization, m.org_id)
        orgs.append(
            {
                "id": str(org.id),
                "name": org.name,
                "role": m.role,
                "timezone": org.timezone,
                "currency": org.currency,
                "scoped": m.role != "owner" and m.property_ids is not None,
            }
        )
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "phone": user.phone,
        "email_verified": user.email_verified_at is not None,
        "is_superadmin": is_superadmin(user),
        "mfa_enabled": user.mfa_enabled_at is not None,
        "google_linked": bool(user.google_sub),
        "impersonated_by": (claims or {}).get("imp_email"),
        "organizations": orgs,
    }


@router.post("/register", dependencies=[Depends(rate_limit("register", 5, 60))])
def register(payload: RegisterIn, response: Response, session: Session = Depends(get_session)):
    email = payload.email.lower()
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(status_code=409, detail="Email already registered. Try signing in.")
    if err := validate_password_strength(payload.password):
        raise HTTPException(status_code=422, detail=err)

    user = User(email=email, name=payload.name, password_hash=hash_password(payload.password))
    if not settings.email_enabled:
        user.email_verified_at = utcnow()  # dev: no inbox to verify against
    session.add(user)
    session.flush()

    org = Organization(name=payload.organization_name or f"{payload.name}'s Properties")
    session.add(org)
    session.flush()
    session.add(Membership(org_id=org.id, user_id=user.id, role="owner"))
    if settings.email_enabled:
        _send_verification(session, user)
    session.commit()
    _set_cookie(response, user)
    return me_payload(session, user)


@router.post("/login", dependencies=[Depends(rate_limit("login", 10, 60))])
def login(payload: LoginIn, response: Response, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == payload.email.lower())).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return finish_login(response, session, user)


@router.post("/login/mfa", dependencies=[Depends(rate_limit("login_mfa", 10, 60))])
def login_mfa(payload: MfaLoginIn, response: Response, session: Session = Depends(get_session)):
    claims = decode_token(payload.mfa_token) or {}
    user = session.get(User, uuid.UUID(claims["sub"])) if claims.get("purpose") == "mfa" and claims.get("sub") else None
    if not user or claims.get("ver") != user.token_version or not user.mfa_enabled_at:
        raise HTTPException(status_code=401, detail="Your sign-in expired. Please sign in again.")
    if not mfa.verify_second_factor(user, payload.code):
        raise HTTPException(status_code=401, detail="That code isn't right. Try the current code from your authenticator app.")
    session.add(user)  # a recovery code may have been consumed
    session.commit()
    _set_cookie(response, user)
    return me_payload(session, user)


# ── Mobile app sign-in (bearer token instead of a cookie) ────────────────────


def mobile_session(session: Session, user: User) -> dict:
    token = create_access_token(str(user.id), {"ver": user.token_version, "client": "mobile"})
    return {"access_token": token, "token_type": "bearer", "me": me_payload(session, user)}


@router.post("/token", dependencies=[Depends(rate_limit("login", 10, 60))])
def token_login(payload: LoginIn, session: Session = Depends(get_session)):
    """Email + password → bearer token for the mobile app (or the 2FA step)."""
    user = session.exec(select(User).where(User.email == payload.email.lower())).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    if user.mfa_enabled_at:
        token = create_access_token(str(user.id), {"ver": user.token_version, "purpose": "mfa"}, expires_minutes=MFA_TOKEN_MINUTES)
        return {"mfa_required": True, "mfa_token": token}
    return mobile_session(session, user)


@router.post("/token/mfa", dependencies=[Depends(rate_limit("login_mfa", 10, 60))])
def token_login_mfa(payload: MfaLoginIn, session: Session = Depends(get_session)):
    claims = decode_token(payload.mfa_token) or {}
    user = session.get(User, uuid.UUID(claims["sub"])) if claims.get("purpose") == "mfa" and claims.get("sub") else None
    if not user or claims.get("ver") != user.token_version or not user.mfa_enabled_at:
        raise HTTPException(status_code=401, detail="Your sign-in expired. Please sign in again.")
    if not mfa.verify_second_factor(user, payload.code):
        raise HTTPException(status_code=401, detail="That code isn't right. Try the current code from your authenticator app.")
    session.add(user)
    session.commit()
    return mobile_session(session, user)


@router.post("/devices", status_code=201)
def register_device(payload: PushDeviceIn, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    from app.services import push

    push.register(session, user.id, payload.token, payload.platform)
    return {"ok": True}


@router.post("/devices/unregister")
def unregister_device(payload: PushDeviceIn, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    from app.services import push

    push.unregister(session, user.id, payload.token)
    return {"ok": True}


@router.post("/logout")
def logout(response: Response, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    user.token_version += 1  # invalidates every token issued so far
    session.add(user)
    session.commit()
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me")
def me(request: Request, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return me_payload(session, user, token_claims(request))


# ── Two-factor authentication ────────────────────────────────────────────────


@router.post("/mfa/setup")
def mfa_setup(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if user.mfa_enabled_at:
        raise HTTPException(status_code=400, detail="Two-factor authentication is already on.")
    user.mfa_secret = mfa.new_secret()
    session.add(user)
    session.commit()
    return mfa.provisioning(user, user.mfa_secret)


@router.post("/mfa/enable", dependencies=[Depends(rate_limit("mfa_enable", 10, 60))])
def mfa_enable(payload: MfaCodeIn, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if user.mfa_enabled_at:
        raise HTTPException(status_code=400, detail="Two-factor authentication is already on.")
    if not mfa.verify_totp(user.mfa_secret, payload.code):
        raise HTTPException(status_code=400, detail="That code isn't right. Check your authenticator app and try again.")
    codes, hashes = mfa.new_recovery_codes()
    user.mfa_enabled_at = utcnow()
    user.mfa_recovery_codes = hashes
    session.add(user)
    session.commit()
    return {"recovery_codes": codes}


@router.post("/mfa/recovery-codes", dependencies=[Depends(rate_limit("mfa_codes", 5, 60))])
def mfa_regenerate(payload: MfaCodeIn, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if not user.mfa_enabled_at or not mfa.verify_totp(user.mfa_secret, payload.code):
        raise HTTPException(status_code=400, detail="That code isn't right.")
    codes, hashes = mfa.new_recovery_codes()
    user.mfa_recovery_codes = hashes
    session.add(user)
    session.commit()
    return {"recovery_codes": codes}


@router.post("/mfa/disable", dependencies=[Depends(rate_limit("mfa_disable", 5, 60))])
def mfa_disable(payload: MfaDisableIn, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if not user.mfa_enabled_at:
        return {"ok": True}
    if not verify_password(payload.password, user.password_hash) or not mfa.verify_second_factor(user, payload.code):
        raise HTTPException(status_code=400, detail="Your password or code isn't right.")
    user.mfa_enabled_at = None
    user.mfa_secret = None
    user.mfa_recovery_codes = []
    session.add(user)
    session.commit()
    return {"ok": True}


# ── Google sign-in (OpenID Connect) ──────────────────────────────────────────

GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs"
STATE_COOKIE = "pp_oauth_state"
_jwks_client: jwt.PyJWKClient | None = None


def _google_redirect_uri() -> str:
    return f"{settings.frontend_url}/api/auth/google/callback"


def verify_google_id_token(id_token: str) -> dict:
    """Verify signature (Google's JWKS), audience and issuer. Overridden in tests."""
    global _jwks_client
    _jwks_client = _jwks_client or jwt.PyJWKClient(GOOGLE_JWKS)
    key = _jwks_client.get_signing_key_from_jwt(id_token).key
    return jwt.decode(id_token, key, algorithms=["RS256"], audience=settings.google_client_id, issuer=["https://accounts.google.com", "accounts.google.com"])


def exchange_google_code(code: str) -> str:
    """Trade the authorization code for an ID token. Overridden in tests."""
    resp = httpx.post(
        GOOGLE_TOKEN,
        data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": _google_redirect_uri(),
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["id_token"]


@router.get("/providers")
def providers():
    return {"google": settings.google_enabled}


@router.get("/google/start")
def google_start():
    if not settings.google_enabled:
        raise HTTPException(status_code=404, detail="Google sign-in isn't set up.")
    state = secrets.token_urlsafe(24)
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": _google_redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    resp = RedirectResponse(f"{GOOGLE_AUTH}?{urlencode(params)}", status_code=302)
    resp.set_cookie(STATE_COOKIE, state, max_age=600, httponly=True, samesite="lax", secure=settings.cookie_secure, path="/api/auth/google")
    return resp


@router.get("/google/callback")
def google_callback(request: Request, code: str = "", state: str = "", session: Session = Depends(get_session)):
    fail = RedirectResponse(f"{settings.frontend_url}/login?error=google", status_code=302)
    expected = request.cookies.get(STATE_COOKIE)
    if not settings.google_enabled or not code or not state or not expected or not secrets.compare_digest(state, expected):
        return fail
    try:
        info = verify_google_id_token(exchange_google_code(code))
    except Exception:  # noqa: BLE001 — any failure → back to sign-in with a message
        return fail
    if not info.get("email_verified") or not info.get("email"):
        return fail
    email, sub = info["email"].lower(), info["sub"]
    user = session.exec(select(User).where(User.google_sub == sub)).first() or session.exec(select(User).where(User.email == email)).first()
    if user is None:
        name = info.get("name") or email.split("@")[0]
        user = User(email=email, name=name, password_hash=hash_password(secrets.token_urlsafe(32)), email_verified_at=utcnow(), google_sub=sub)
        session.add(user)
        session.flush()
        org = Organization(name=f"{name}'s Properties")
        session.add(org)
        session.flush()
        session.add(Membership(org_id=org.id, user_id=user.id, role="owner"))
    else:
        user.google_sub = user.google_sub or sub
        user.email_verified_at = user.email_verified_at or utcnow()
        session.add(user)
    session.commit()
    if user.mfa_enabled_at:
        token = create_access_token(str(user.id), {"ver": user.token_version, "purpose": "mfa"}, expires_minutes=MFA_TOKEN_MINUTES)
        resp = RedirectResponse(f"{settings.frontend_url}/login?mfa={token}", status_code=302)
    else:
        resp = RedirectResponse(f"{settings.frontend_url}/", status_code=302)
        resp.set_cookie(
            key=COOKIE_NAME,
            value=create_access_token(str(user.id), {"ver": user.token_version}),
            httponly=True,
            samesite="lax",
            secure=settings.cookie_secure,
            max_age=settings.access_token_expire_minutes * 60,
            path="/",
        )
    resp.delete_cookie(STATE_COOKIE, path="/api/auth/google")
    return resp


@router.patch("/me")
def update_me(payload: ProfileUpdate, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(user, k, v)
    user.updated_at = utcnow()
    session.add(user)
    session.commit()
    return me_payload(session, user)


@router.post("/change-password")
def change_password(
    payload: ChangePasswordIn,
    response: Response,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if err := validate_password_strength(payload.new_password):
        raise HTTPException(status_code=422, detail=err)
    user.password_hash = hash_password(payload.new_password)
    user.token_version += 1
    session.add(user)
    session.commit()
    _set_cookie(response, user)
    return {"ok": True}


@router.post("/verify-email")
def verify_email(payload: TokenIn, session: Session = Depends(get_session)):
    user = _consume_token(session, payload.token, "verify_email")
    user.email_verified_at = user.email_verified_at or utcnow()
    session.add(user)
    session.commit()
    return {"ok": True}


@router.post("/resend-verification", dependencies=[Depends(rate_limit("resend_verify", 3, 600))])
def resend_verification(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if user.email_verified_at:
        return {"ok": True}
    _send_verification(session, user)
    session.commit()
    return {"ok": True}


@router.post("/forgot-password", dependencies=[Depends(rate_limit("forgot", 5, 600))])
def forgot_password(payload: EmailIn, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == payload.email.lower())).first()
    if user:
        raw = _issue_token(session, user, "reset_password", RESET_HOURS)
        session.commit()
        link = f"{settings.frontend_url}/reset-password?token={raw}"
        send_email(
            user.email,
            "Reset your Proppros password",
            layout("Reset your password", f"<p>This link expires in {RESET_HOURS} hours.</p>", "Choose a new password", link),
        )
    # Same response either way — don't reveal which emails are registered.
    return {"ok": True}


@router.post("/reset-password", dependencies=[Depends(rate_limit("reset", 10, 600))])
def reset_password(payload: ResetPasswordIn, session: Session = Depends(get_session)):
    if err := validate_password_strength(payload.password):
        raise HTTPException(status_code=422, detail=err)
    user = _consume_token(session, payload.token, "reset_password")
    user.password_hash = hash_password(payload.password)
    user.token_version += 1
    user.email_verified_at = user.email_verified_at or utcnow()  # they proved inbox access
    session.add(user)
    session.commit()
    return {"ok": True}


# ── Invitations (team members and tenant portal) ─────────────────────────────


def _load_invite(session: Session, raw: str) -> Invitation:
    inv = session.exec(select(Invitation).where(Invitation.token_hash == hash_token(raw))).first()
    if not inv or inv.accepted_at or inv.expires_at < utcnow():
        raise HTTPException(status_code=400, detail="This invitation is invalid or has expired.")
    return inv


@router.get("/invitations/{token}")
def preview_invite(token: str, session: Session = Depends(get_session)):
    inv = _load_invite(session, token)
    org = session.get(Organization, inv.org_id)
    has_account = session.exec(select(User.id).where(User.email == inv.email)).first() is not None
    return {"email": inv.email, "role": inv.role, "organization": org.name, "has_account": has_account}


@router.post("/invitations/accept", dependencies=[Depends(rate_limit("accept_invite", 10, 600))])
def accept_invite(payload: AcceptInviteIn, response: Response, session: Session = Depends(get_session)):
    inv = _load_invite(session, payload.token)
    user = session.exec(select(User).where(User.email == inv.email)).first()
    if user is None:
        if not payload.name or not payload.password:
            raise HTTPException(status_code=422, detail="Name and password are required to create your account.")
        if err := validate_password_strength(payload.password):
            raise HTTPException(status_code=422, detail=err)
        user = User(email=inv.email, name=payload.name, password_hash=hash_password(payload.password), email_verified_at=utcnow())
        session.add(user)
        session.flush()
    elif not payload.password or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Enter the password for your existing account.")

    existing = session.exec(select(Membership).where(Membership.org_id == inv.org_id, Membership.user_id == user.id)).first()
    if not existing:
        session.add(Membership(org_id=inv.org_id, user_id=user.id, role=inv.role, property_ids=inv.property_ids))
    if inv.tenant_id:
        tenant = session.get(Tenant, inv.tenant_id)
        if tenant and tenant.org_id == inv.org_id:
            tenant.user_id = user.id
            session.add(tenant)
    inv.accepted_at = utcnow()
    session.add(inv)
    session.commit()
    return finish_login(response, session, user)  # existing accounts with 2FA still need their code
