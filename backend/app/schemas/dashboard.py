from datetime import datetime
from typing import Any

from pydantic import BaseModel


class OverviewStats(BaseModel):
    time_range: str
    online_users: int
    active_sessions: int
    active_users: int
    new_users: int
    events: int
    errors: int
    requests: int
    sessions: int
    failed_jobs: int
    failed_webhooks: int
    monitor_down: int


class TimelineItem(BaseModel):
    id: str
    kind: str
    name: str | None
    timestamp: datetime
    properties: dict[str, Any]


class SessionSummaryItem(BaseModel):
    session_id: str
    user_id: str | None
    anonymous_id: str | None
    event_count: int
    first_seen: datetime
    last_seen: datetime
