import logging
from collections.abc import Generator

from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings

logger = logging.getLogger(__name__)


def _make_engine(url: str):
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})
    # Serverless: every invocation may be a fresh instance, so don't hold a pool.
    # Neon's pooled endpoint (PgBouncer) does the pooling for us.
    return create_engine(url, poolclass=NullPool, pool_pre_ping=True)


engine = _make_engine(settings.database_url)


def init_db() -> None:
    """Create tables directly — only for zero-setup local SQLite dev.

    Postgres environments (Neon dev/preview/prod) are managed by `alembic upgrade head`.
    Never raises: a startup failure here would take down every request on Vercel.
    """
    if not settings.database_url.startswith("sqlite") or settings.is_production or settings.on_vercel:
        return
    try:
        SQLModel.metadata.create_all(engine)
    except Exception:  # noqa: BLE001
        logger.exception("Could not create local SQLite tables")


def check_db_connection() -> bool:
    if not settings.database_configured:
        return False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("Database health check failed: %s", exc)
        return False


def get_session() -> Generator[Session, None, None]:
    # expire_on_commit=False: handlers commit and then serialize the same rows;
    # expired instances would serialize as empty dicts.
    with Session(engine, expire_on_commit=False) as session:
        yield session
