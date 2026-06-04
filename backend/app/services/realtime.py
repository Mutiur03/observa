import json

from fastapi.encoders import jsonable_encoder
from redis import Redis

from app.core.config import get_settings


def publish_project_update(project_id: str, message_type: str, data) -> None:
    try:
        settings = get_settings()
        with Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=settings.redis_connect_timeout_seconds,
            socket_timeout=settings.redis_socket_timeout_seconds,
        ) as redis:
            redis.publish(
                f"project:{project_id}:events",
                json.dumps({"type": message_type, "data": jsonable_encoder(data)}),
            )
    except Exception:
        # Dashboard websocket is best-effort. HTTP writes must still succeed if Redis is unavailable.
        pass
