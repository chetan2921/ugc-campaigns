from app.config import settings

# Tests wipe every table, so they must never touch the app's real database.
if not settings.test_database_url or settings.test_database_url == settings.database_url:
    raise RuntimeError("Set TEST_DATABASE_URL in api/.env to a separate database whose name ends in _test")
settings.database_url = settings.test_database_url  # must happen before anything imports app.db

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import models  # noqa: F401  (registers tables)
from app.db import Base, SessionLocal, engine
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture(autouse=True)
def clean_tables():
    yield
    names = ", ".join(table.name for table in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client():
    return TestClient(app)
