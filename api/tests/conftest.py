from app.config import settings

# Tests wipe every table, so they must never touch the app's real database.
if not settings.test_database_url or settings.test_database_url == settings.database_url:
    raise RuntimeError("Set TEST_DATABASE_URL in api/.env to a separate database whose name ends in _test")
settings.database_url = settings.test_database_url  # must happen before anything imports app.db
