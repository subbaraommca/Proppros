"""Shared fixtures: one in-memory SQLite DB per test session, wiped between tests."""
import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("JWT_SECRET", "test-secret-key-that-is-at-least-32-chars")
os.environ["RESEND_API_KEY"] = ""
os.environ["BLOB_READ_WRITE_TOKEN"] = ""
os.environ["UPSTASH_REDIS_REST_URL"] = ""
os.environ["CRON_SECRET"] = "test-cron-secret"

import tempfile  # noqa: E402

os.environ["LOCAL_UPLOAD_DIR"] = tempfile.mkdtemp(prefix="proppros-test-uploads-")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import Session, SQLModel, create_engine  # noqa: E402
from sqlmodel.pool import StaticPool  # noqa: E402

_ENGINE = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

import app.core.database as _db  # noqa: E402

_db.engine = _ENGINE

from app.core import email as _email  # noqa: E402
from app.core import limiter as _limiter  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_db():
    SQLModel.metadata.create_all(_ENGINE)
    _email.outbox.clear()
    _limiter.reset()
    yield
    SQLModel.metadata.drop_all(_ENGINE)


@pytest.fixture
def session():
    with Session(_ENGINE) as s:
        yield s


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def outbox():
    return _email.outbox
