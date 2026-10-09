from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    test_database_url: str | None = None
    jwt_secret: str = "dev-only-secret-change-me"
    jwt_ttl_hours: int = 24 * 7
    cors_origins: list[str] = ["http://localhost:3000"]
    worker_poll_seconds: float = 3.0

    @field_validator("database_url", "test_database_url")
    @classmethod
    def use_psycopg_driver(cls, url: str | None) -> str | None:
        # Neon hands out postgresql:// URLs; SQLAlchemy has to be told to use psycopg 3.
        for prefix in ("postgresql://", "postgres://"):
            if url and url.startswith(prefix):
                return "postgresql+psycopg://" + url.removeprefix(prefix)
        return url


settings = Settings()
