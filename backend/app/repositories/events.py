from datetime import datetime
from typing import Any

from sqlalchemy import Select, delete, func, or_, select
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

    def refresh(self, row):
        self.db.refresh(row)
        return row

    def paginate_events(
        self,
        project_id: str,
        page: int,
        page_size: int,
        event_type: str | None = None,
        session_id: str | None = None,
        user_id: str | None = None,
        anonymous_id: str | None = None,
        trace_id: str | None = None,
        search: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> tuple[list[Event], int]:
        query = select(Event).where(Event.project_id == project_id)
        if event_type:
            query = query.where(Event.event_type == event_type)
        if session_id:
            query = query.where(Event.session_id == session_id)
        if user_id:
            query = query.where(Event.user_id == user_id)
        if anonymous_id:
            query = query.where(Event.anonymous_id == anonymous_id)
        if trace_id:
            query = query.where(Event.trace_id == trace_id)
        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    Event.event_name.ilike(pattern),
                    Event.user_id.ilike(pattern),
                    Event.anonymous_id.ilike(pattern),
                    Event.session_id.ilike(pattern),
                    Event.trace_id.ilike(pattern),
                )
            )
        query = self._date_filter(query, Event.timestamp, start, end)
        return self._paginate(query.order_by(Event.timestamp.desc()), page, page_size)

    def delete_event(self, project_id: str, event_id: str) -> bool:
        self._delete_event_details(project_id, [event_id])
        result = self.db.execute(delete(Event).where(Event.project_id == project_id, Event.id == event_id))
        self.db.commit()
        return bool(result.rowcount)

    def delete_events(
        self,
        project_id: str,
        event_type: str | None = None,
        session_id: str | None = None,
        user_id: str | None = None,
        anonymous_id: str | None = None,
        trace_id: str | None = None,
        search: str | None = None,
    ) -> list[str]:
        query = select(Event.id).where(Event.project_id == project_id)
        if event_type:
            query = query.where(Event.event_type == event_type)
        if session_id:
            query = query.where(Event.session_id == session_id)
        if user_id:
            query = query.where(Event.user_id == user_id)
        if anonymous_id:
            query = query.where(Event.anonymous_id == anonymous_id)
        if trace_id:
            query = query.where(Event.trace_id == trace_id)
        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    Event.event_name.ilike(pattern),
                    Event.user_id.ilike(pattern),
                    Event.anonymous_id.ilike(pattern),
                    Event.session_id.ilike(pattern),
                    Event.trace_id.ilike(pattern),
                )
            )
        ids = list(self.db.scalars(query))
        if ids:
            clear_unlinked = not any((event_type, session_id, user_id, anonymous_id, trace_id, search))
            self._delete_event_details(project_id, ids, clear_unlinked=clear_unlinked)
            self.db.execute(delete(Event).where(Event.id.in_(ids)))
            self.db.commit()
        return ids

    def _delete_event_details(self, project_id: str, event_ids: list[str], clear_unlinked: bool = False) -> None:
        for model in (ErrorEvent, ApiRequestEvent, SessionEvent, JobEvent, WebhookEvent):
            query = delete(model).where(model.project_id == project_id)
            if not clear_unlinked:
                query = query.where(model.event_id.in_(event_ids))
            self.db.execute(query)

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

    def list_sessions(self, project_id: str, page: int, page_size: int) -> tuple[list[dict[str, Any]], int]:
        query = (
            select(
                Event.session_id.label("session_id"),
                func.max(Event.user_id).label("user_id"),
                func.max(Event.anonymous_id).label("anonymous_id"),
                func.count().label("event_count"),
                func.min(Event.timestamp).label("first_seen"),
                func.max(Event.timestamp).label("last_seen"),
            )
            .where(Event.project_id == project_id, Event.session_id.isnot(None))
            .group_by(Event.session_id)
            .order_by(func.max(Event.timestamp).desc())
        )
        total = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        rows = list(self.db.execute(query.offset((page - 1) * page_size).limit(page_size)).mappings())
        return rows, total

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
