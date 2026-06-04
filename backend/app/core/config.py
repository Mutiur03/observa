from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import AnyHttpUrl, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict



BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "Observa"
    environment: str = "development"
    api_v1_prefix: str = "/v1"
    database_url: str = "postgresql+psycopg://observa:observa@127.0.0.1:5435/observa"
    database_pool_size: int = 20
    database_max_overflow: int = 20
    database_pool_timeout_seconds: int = 5
    redis_url: str = "redis://127.0.0.1:6380/0"
    redis_connect_timeout_seconds: float = 0.5
    redis_socket_timeout_seconds: float = 5.0
    jwt_secret_key: str = Field(default="change-me-in-production")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    auth_cookie_name: str = "observa_access_token"
    auth_cookie_secure: bool = False
    auth_cookie_samesite: str = "lax"
    auth_cookie_domain: str | None = None
    observa_api_key: str | None = None
    observa_endpoint: str = "http://127.0.0.1:8000/v1"
    cors_origins: List[AnyHttpUrl] | List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
    ingestion_rate_limit_per_minute: int = 120
    ingestion_ip_rate_limit_per_minute: int = 600
    auth_rate_limit_per_minute: int = 10

    @field_validator("database_url", mode="before")
    @classmethod
    def assemble_db_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

    @model_validator(mode="after")
    def validate_production_security(self):
        if self.environment != "production":
            return self
        if self.jwt_secret_key == "change-me-in-production" or len(self.jwt_secret_key) < 32:
            raise ValueError("JWT_SECRET_KEY must be a random value with at least 32 characters in production")
        if not self.auth_cookie_secure:
            raise ValueError("AUTH_COOKIE_SECURE must be true in production")
        if "*" in {str(origin) for origin in self.cors_origins}:
            raise ValueError("CORS_ORIGINS cannot contain '*' in production")
        return self

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )



@lru_cache
def get_settings() -> Settings:
    return Settings()


def is_allowed_browser_origin(origin: str | None) -> bool:
    if not origin:
        return True
    allowed = {str(item).rstrip("/") for item in get_settings().cors_origins}
    return origin.rstrip("/") in allowed
