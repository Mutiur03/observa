from datetime import datetime

from pydantic import BaseModel, Field


class PresenceHeartbeatIn(BaseModel):
    user_id: str | None = Field(default=None, max_length=200)
    anonymous_id: str = Field(min_length=1, max_length=200)
    session_id: str = Field(min_length=1, max_length=200)
    path: str | None = Field(default=None, max_length=1000)
    url: str | None = Field(default=None, max_length=2000)
    title: str | None = Field(default=None, max_length=500)


class PresenceVisitor(BaseModel):
    user_id: str | None
    anonymous_id: str
    session_id: str
    path: str | None
    url: str | None
    title: str | None
    last_seen: datetime


class PresenceSnapshot(BaseModel):
    online_users: int
    identified_users: int
    anonymous_users: int
    active_sessions: int
    visitors: list[PresenceVisitor]
