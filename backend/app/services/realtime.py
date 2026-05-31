import json

from fastapi.encoders import jsonable_encoder
from redis import Redis

from app.core.config import get_settings


def publish_project_update(project_id: str, message_type: str, data) -> None:
    try:
        redis = Redis.from_url(get_settings().redis_url, decode_responses=True)
        redis.publish(
            f"project:{project_id}:events",
            json.dumps({"type": message_type, "data": jsonable_encoder(data)}),
        )
    except Exception:
        # Dashboard websocket is best-effort. HTTP writes must still succeed if Redis is unavailable.
        pass
