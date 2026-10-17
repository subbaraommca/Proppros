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
    """
    if settings.database_url.startswith("sqlite") and not settings.is_production:
        SQLModel.metadata.create_all(engine)


def check_db_connection() -> bool:
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
