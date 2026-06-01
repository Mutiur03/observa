import json
from datetime import datetime, timezone
from time import time

from redis import Redis

from app.core.config import get_settings
from app.schemas.presence import PresenceHeartbeatIn, PresenceSnapshot, PresenceVisitor

PRESENCE_TTL_SECONDS = 60
PRESENCE_LIST_LIMIT = 100
PRESENCE_SESSION_LIMIT = 10_000


class PresenceService:
    def __init__(self):
        self.redis = Redis.from_url(get_settings().redis_url, decode_responses=True)

    def heartbeat(self, project_id: str, payload: PresenceHeartbeatIn) -> dict[str, bool]:
        try:
            now = time()
            visitor = {
                **payload.model_dump(),
                "last_seen": datetime.fromtimestamp(now, timezone.utc).isoformat(),
            }
            pipeline = self.redis.pipeline()
            pipeline.zadd(self._sessions_key(project_id), {payload.session_id: now})
            pipeline.hset(self._visitors_key(project_id), payload.session_id, json.dumps(visitor))
            pipeline.expire(self._sessions_key(project_id), PRESENCE_TTL_SECONDS * 2)
            pipeline.expire(self._visitors_key(project_id), PRESENCE_TTL_SECONDS * 2)
            pipeline.execute()
            overflow = self.redis.zcard(self._sessions_key(project_id)) - PRESENCE_SESSION_LIMIT
            if overflow > 0:
                evicted = self.redis.zrange(self._sessions_key(project_id), 0, overflow - 1)
                pipeline = self.redis.pipeline()
                pipeline.zrem(self._sessions_key(project_id), *evicted)
                pipeline.hdel(self._visitors_key(project_id), *evicted)
                pipeline.execute()
            snapshot = self.snapshot(project_id)
            self.redis.publish(f"project:{project_id}:presence", snapshot.model_dump_json())
            return {"ok": True}
        except Exception:
            return {"ok": False}

    def snapshot(self, project_id: str) -> PresenceSnapshot:
        try:
            cutoff = time() - PRESENCE_TTL_SECONDS
            sessions_key = self._sessions_key(project_id)
            visitors_key = self._visitors_key(project_id)
            expired = self.redis.zrangebyscore(sessions_key, "-inf", cutoff)
            pipeline = self.redis.pipeline()
            pipeline.zremrangebyscore(sessions_key, "-inf", cutoff)
            if expired:
                pipeline.hdel(visitors_key, *expired)
            pipeline.zrevrange(sessions_key, 0, -1)
            results = pipeline.execute()
            session_ids = results[-1]
            records = self.redis.hmget(visitors_key, session_ids) if session_ids else []
            all_visitors = [PresenceVisitor.model_validate_json(record) for record in records if record]
            identities = {visitor.user_id or visitor.anonymous_id for visitor in all_visitors}
            identified = {visitor.user_id for visitor in all_visitors if visitor.user_id}
            anonymous = {visitor.anonymous_id for visitor in all_visitors if not visitor.user_id}
            return PresenceSnapshot(
                online_users=len(identities),
                identified_users=len(identified),
                anonymous_users=len(anonymous),
                active_sessions=len(session_ids),
                visitors=all_visitors[:PRESENCE_LIST_LIMIT],
            )
        except Exception:
            return self._empty_snapshot()

    def _empty_snapshot(self) -> PresenceSnapshot:
        return PresenceSnapshot(
            online_users=0,
            identified_users=0,
            anonymous_users=0,
            active_sessions=0,
            visitors=[],
        )

    def _sessions_key(self, project_id: str) -> str:
        return f"project:{project_id}:presence:sessions"

    def _visitors_key(self, project_id: str) -> str:
        return f"project:{project_id}:presence:visitors"
