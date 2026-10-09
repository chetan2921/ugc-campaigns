from fastapi.testclient import TestClient

from app.main import app


def test_health():
    assert TestClient(app).get("/health").json() == {"ok": True}


def test_tests_run_on_the_test_database():
    from sqlalchemy import text

    from app.db import engine

    with engine.connect() as conn:
        assert conn.execute(text("select current_database()")).scalar().endswith("_test")
