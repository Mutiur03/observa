from datetime import datetime
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.events import ApiRequestEvent, ErrorEvent, Event, JobEvent, SessionEvent, WebhookEvent


class EventRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_event(self, data: dict[str, Any]) -> Event:
        event = Event(**data)
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def add(self, model: type, data: dict[str, Any]):
        row = model(**data)
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def paginate_events(
        self,
        project_id: str,
        page: int,
        page_size: int,
        event_type: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> tuple[list[Event], int]:
        query = select(Event).where(Event.project_id == project_id)
        if event_type:
            query = query.where(Event.event_type == event_type)
        query = self._date_filter(query, Event.timestamp, start, end)
        return self._paginate(query.order_by(Event.timestamp.desc()), page, page_size)

    def count(self, model: type, project_id: str) -> int:
        return self.db.scalar(select(func.count()).select_from(model).where(model.project_id == project_id)) or 0

    def timeline_for_user(self, project_id: str, user_id: str, limit: int = 100) -> list[Event]:
        query = (
            select(Event)
            .where(Event.project_id == project_id, Event.user_id == user_id)
            .order_by(Event.timestamp.desc())
            .limit(limit)
        )
        return list(self.db.scalars(query))

    def list_model(self, model: type, project_id: str, page: int, page_size: int) -> tuple[list[Any], int]:
        query = select(model).where(model.project_id == project_id).order_by(model.timestamp.desc())
        return self._paginate(query, page, page_size)

    def _paginate(self, query: Select, page: int, page_size: int) -> tuple[list[Any], int]:
        total = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        items = list(self.db.scalars(query.offset((page - 1) * page_size).limit(page_size)))
        return items, total

    def _date_filter(self, query: Select, column, start: datetime | None, end: datetime | None) -> Select:
        if start:
            query = query.where(column >= start)
        if end:
            query = query.where(column <= end)
        return query


EVENT_MODELS = {
    "errors": ErrorEvent,
    "requests": ApiRequestEvent,
    "sessions": SessionEvent,
    "jobs": JobEvent,
    "webhooks": WebhookEvent,
}
