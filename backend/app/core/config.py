import logging
import os
import secrets

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    app_name: str = "Proppros"
    environment: str = "development"  # development | test | preview | production

    # Database — Neon pooled URL in Vercel; SQLite file for zero-setup local dev.
    database_url: str = "sqlite:///./proppros.db"
    database_url_unpooled: str = ""  # direct connection, used by Alembic only

    # Auth
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7
    cookie_secure: bool = False

    # URLs
    frontend_url: str = "http://localhost:5173"

    # Cron — Vercel sends "Authorization: Bearer $CRON_SECRET"
    cron_secret: str = ""

    # Email (Resend). Blank → emails are logged instead of sent.
    resend_api_key: str = ""
    # SMTP (e.g. Gmail with an app password). Takes precedence over Resend when set.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = "Proppros <noreply@proppros.app>"

    # File storage (Vercel Blob). Neither set → files saved to local_upload_dir.
    blob_read_write_token: str = ""
    blob_store_id: str = ""  # with Vercel OIDC auth (no static token)
    blob_access: str = "private"  # must match the store: "private" | "public"
    local_upload_dir: str = "./.uploads"
    max_upload_bytes: int = 4 * 1024 * 1024  # Vercel function body limit is 4.5 MB

    # Online payments (Stripe Connect). Blank → online payments are hidden.
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_card_fee_bps: int = 290  # used when the owner passes the card fee to tenants (2.9% …
    stripe_card_fee_fixed_cents: int = 30  # … + 30¢)

    # Proppros subscriptions (Stripe Billing). BILLING_ENABLED=false → no plan limits, no checkout.
    billing_enabled: bool = False
    stripe_price_pro: str = ""  # price_… (per-unit, monthly, licensed quantity)
    stripe_price_business: str = ""

    # Platform admins (comma-separated emails) — get the super-admin console
    superadmin_emails: str = ""
    feedback_notify_email: str = ""  # feedback submissions are emailed here (blank → super admins)

    # Google sign-in (OAuth 2.0 / OpenID Connect). Blank → button hidden.
    google_client_id: str = ""
    google_client_secret: str = ""

    # Rate limiting (Upstash Redis REST). Blank → in-memory (dev only).
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""

    # Monitoring
    sentry_dsn: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def on_vercel(self) -> bool:
        return bool(os.environ.get("VERCEL"))

    @property
    def database_configured(self) -> bool:
        """False on Vercel until a real Postgres URL (Neon) is set — the SQLite default can't work there."""
        return not (self.on_vercel and self.database_url.startswith("sqlite"))

    @property
    def billing_active(self) -> bool:
        return self.billing_enabled and bool(self.stripe_secret_key) and bool(self.stripe_price_pro)

    @property
    def google_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    def is_superadmin_email(self, email: str) -> bool:
        return email.lower() in {e.strip().lower() for e in self.superadmin_emails.split(",") if e.strip()}

    @property
    def stripe_enabled(self) -> bool:
        return bool(self.stripe_secret_key)

    @property
    def email_provider(self) -> str:
        if self.smtp_host and self.smtp_user and self.smtp_password:
            return "smtp"
        if self.resend_api_key:
            return "resend"
        return "log-only"

    @property
    def email_enabled(self) -> bool:
        return self.email_provider != "log-only"

    @model_validator(mode="after")
    def validate_production(self) -> "Settings":
        # Neon/Vercel may provide the standard POSTGRES_* names instead of DATABASE_URL*.
        if self.database_url.startswith("sqlite") and os.environ.get("POSTGRES_URL"):
            self.database_url = os.environ["POSTGRES_URL"]
        if not self.database_url_unpooled and os.environ.get("POSTGRES_URL_NON_POOLING"):
            self.database_url_unpooled = os.environ["POSTGRES_URL_NON_POOLING"]
        # Neon / Vercel provide "postgres://" or "postgresql://"; SQLAlchemy needs the psycopg driver.
        for attr in ("database_url", "database_url_unpooled"):
            url = getattr(self, attr)
            for prefix in ("postgres://", "postgresql://"):
                if url.startswith(prefix):
                    setattr(self, attr, "postgresql+psycopg://" + url[len(prefix):])
        if not self.jwt_secret:
            if self.is_production:
                raise ValueError("JWT_SECRET must be set in production")
            self.jwt_secret = secrets.token_hex(32)
            logger.warning("JWT_SECRET not set — using an ephemeral secret (sessions reset on restart).")
        elif len(self.jwt_secret) < 32 and self.is_production:
            raise ValueError("JWT_SECRET must be at least 32 characters in production")
        if self.is_production:
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE must be true in production")
            if not self.cron_secret:
                raise ValueError("CRON_SECRET must be set in production")
        return self


settings = Settings()
