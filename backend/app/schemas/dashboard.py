from datetime import datetime
from typing import Any

from pydantic import BaseModel


class OverviewStats(BaseModel):
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
