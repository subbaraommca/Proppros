from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select

from app.core.config import settings
from app.core.database import get_session
from app.core.deps import COOKIE_NAME, get_current_user
from app.core.email import esc, layout, send_email
from app.core.limiter import rate_limit
from app.core.security import (
    create_access_token,
    hash_password,
    hash_token,
    new_url_token,
    validate_password_strength,
    verify_password,
)
from app.models import AuthToken, Invitation, Membership, Organization, Tenant, User, utcnow
from app.schemas import (
    AcceptInviteIn,
    ChangePasswordIn,
    EmailIn,
    LoginIn,
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


def me_payload(session: Session, user: User) -> dict:
    memberships = session.exec(select(Membership).where(Membership.user_id == user.id).order_by(Membership.created_at)).all()
    orgs = []
    for m in memberships:
        org = session.get(Organization, m.org_id)
        orgs.append({"id": str(org.id), "name": org.name, "role": m.role, "timezone": org.timezone, "currency": org.currency})
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "phone": user.phone,
        "email_verified": user.email_verified_at is not None,
        "is_superadmin": user.is_superadmin,
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
    _set_cookie(response, user)
    return me_payload(session, user)


@router.post("/logout")
def logout(response: Response, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    user.token_version += 1  # invalidates every token issued so far
    session.add(user)
    session.commit()
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return me_payload(session, user)


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
        session.add(Membership(org_id=inv.org_id, user_id=user.id, role=inv.role))
    if inv.tenant_id:
        tenant = session.get(Tenant, inv.tenant_id)
        if tenant and tenant.org_id == inv.org_id:
            tenant.user_id = user.id
            session.add(tenant)
    inv.accepted_at = utcnow()
    session.add(inv)
    session.commit()
    _set_cookie(response, user)
    return me_payload(session, user)
