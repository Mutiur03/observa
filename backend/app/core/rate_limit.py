import time

from fastapi import HTTPException, Request, status
from redis import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings


class RateLimiter:
    def __init__(self) -> None:
        settings = get_settings()
        self.limit = settings.ingestion_rate_limit_per_minute
        self.redis = Redis.from_url(settings.redis_url, decode_responses=True)

    def check(self, key: str) -> None:
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
        if count > self.limit:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Ingestion rate limit exceeded")


rate_limiter = RateLimiter()


def rate_limit_ingestion(request: Request, api_key: str) -> None:
    client_host = request.client.host if request.client else "unknown"
    rate_limiter.check(f"{api_key}:{client_host}")
