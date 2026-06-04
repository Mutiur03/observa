import time
from hashlib import sha256

from fastapi import HTTPException, Request, status
from redis import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings


class RateLimiter:
    def __init__(self) -> None:
        settings = get_settings()
        self.limit = settings.ingestion_rate_limit_per_minute
        self.redis = Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=settings.redis_connect_timeout_seconds,
            socket_timeout=settings.redis_socket_timeout_seconds,
        )

    def check(self, key: str, limit: int | None = None) -> None:
        now = int(time.time())
        window = now // 60
        redis_key = f"rate:ingestion:{key}:{window}"
        try:
            count = self.redis.incr(redis_key)
            if count == 1:
                self.redis.expire(redis_key, 90)
        except RedisError:
            if get_settings().environment == "production":
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Rate limiter unavailable")
            return
        if count > (limit or self.limit):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Ingestion rate limit exceeded")


rate_limiter = RateLimiter()


def rate_limit_ingestion(request: Request, api_key: str) -> None:
    client_host = request.client.host if request.client else "unknown"
    api_key_hash = sha256(api_key.encode("utf-8")).hexdigest()
    rate_limiter.check(f"ip:{client_host}", get_settings().ingestion_ip_rate_limit_per_minute)
    rate_limiter.check(f"{api_key_hash}:{client_host}")


def rate_limit_auth(request: Request, action: str) -> None:
    client_host = request.client.host if request.client else "unknown"
    rate_limiter.check(f"auth:{action}:{client_host}", get_settings().auth_rate_limit_per_minute)
