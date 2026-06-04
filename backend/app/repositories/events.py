from datetime import datetime
from typing import Any

from sqlalchemy import Float, Select, String, case, cast, delete, func, literal, or_, select
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
                    cast(Event.properties, String).ilike(pattern),
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

    def count_events(self, project_id: str, start: datetime | None, end: datetime | None) -> int:
        query = select(func.count()).select_from(Event).where(Event.project_id == project_id)
        query = self._date_filter(query, Event.timestamp, start, end)
        return self.db.scalar(query) or 0

    def count_errors(self, project_id: str, start: datetime | None, end: datetime | None) -> int:
        query = select(func.count()).select_from(Event).where(
            Event.project_id == project_id,
            Event.event_type.in_(["frontend_error", "backend_error"]),
        )
        query = self._date_filter(query, Event.timestamp, start, end)
        return self.db.scalar(query) or 0

    def count_active_users(self, project_id: str, start: datetime | None, end: datetime | None) -> int:
        identity = self._identity_expression()
        query = select(func.count(func.distinct(identity))).where(
            Event.project_id == project_id,
            or_(Event.user_id.isnot(None), Event.anonymous_id.isnot(None)),
        )
        query = self._date_filter(query, Event.timestamp, start, end)
        return self.db.scalar(query) or 0

    def count_new_users(self, project_id: str, start: datetime | None, end: datetime | None) -> int:
        identity = self._identity_expression()
        first_seen = (
            select(identity.label("identity"), func.min(Event.timestamp).label("first_seen"))
            .where(Event.project_id == project_id, or_(Event.user_id.isnot(None), Event.anonymous_id.isnot(None)))
            .group_by(identity)
            .subquery()
        )
        query = select(func.count()).select_from(first_seen)
        if start:
            query = query.where(first_seen.c.first_seen >= start)
        if end:
            query = query.where(first_seen.c.first_seen <= end)
        return self.db.scalar(query) or 0

    def analytics_breakdown(
        self,
        project_id: str,
        property_name: str,
        start: datetime | None,
        end: datetime | None,
        limit: int = 8,
    ) -> list[dict[str, Any]]:
        dimension = Event.properties[property_name].as_string()
        query = (
            select(dimension.label("label"), func.count().label("count"))
            .where(
                Event.project_id == project_id,
                Event.event_type == "page_view",
                self._not_bot_expression(),
                dimension.isnot(None),
                dimension != "",
            )
            .group_by(dimension)
            .order_by(func.count().desc(), dimension.asc())
            .limit(limit)
        )
        query = self._date_filter(query, Event.timestamp, start, end)
        return list(self.db.execute(query).mappings())

    def analytics_series(self, project_id: str, start: datetime | None, end: datetime | None, interval: str) -> list[dict[str, Any]]:
        bucket = func.date_trunc(interval, Event.timestamp)
        identity = self._identity_expression()
        query = (
            select(
                bucket.label("timestamp"),
                func.count().label("page_views"),
                func.count(func.distinct(identity)).label("visitors"),
            )
            .where(Event.project_id == project_id, Event.event_type == "page_view", self._not_bot_expression())
            .group_by(bucket)
            .order_by(bucket.asc())
        )
        query = self._date_filter(query, Event.timestamp, start, end)
        return list(self.db.execute(query).mappings())

    def page_analytics_series(self, project_id: str, path: str, start: datetime | None, end: datetime | None, interval: str) -> list[dict[str, Any]]:
        bucket = func.date_trunc(interval, Event.timestamp)
        identity = self._identity_expression()
        query = (
            select(
                bucket.label("timestamp"),
                func.count().label("page_views"),
                func.count(func.distinct(identity)).label("visitors"),
            )
            .where(
                Event.project_id == project_id,
                Event.event_type == "page_view",
                self._not_bot_expression(),
                self._page_path_expression() == path,
            )
            .group_by(bucket)
            .order_by(bucket.asc())
        )
        query = self._date_filter(query, Event.timestamp, start, end)
        return list(self.db.execute(query).mappings())

    def count_page_views(self, project_id: str, start: datetime | None, end: datetime | None) -> int:
        query = select(func.count()).select_from(Event).where(Event.project_id == project_id, Event.event_type == "page_view", self._not_bot_expression())
        query = self._date_filter(query, Event.timestamp, start, end)
        return self.db.scalar(query) or 0

    def count_page_views_for_path(self, project_id: str, path: str, start: datetime | None, end: datetime | None) -> int:
        query = select(func.count()).select_from(Event).where(
            Event.project_id == project_id,
            Event.event_type == "page_view",
            self._not_bot_expression(),
            self._page_path_expression() == path,
        )
        query = self._date_filter(query, Event.timestamp, start, end)
        return self.db.scalar(query) or 0

    def count_bot_page_views(self, project_id: str, start: datetime | None, end: datetime | None) -> int:
        query = select(func.count()).select_from(Event).where(
            Event.project_id == project_id,
            Event.event_type == "page_view",
            Event.properties["is_bot"].as_boolean().is_(True),
        )
        query = self._date_filter(query, Event.timestamp, start, end)
        return self.db.scalar(query) or 0

    def count_visitors(self, project_id: str, start: datetime | None, end: datetime | None) -> int:
        identity = self._identity_expression()
        query = select(func.count(func.distinct(identity))).where(
            Event.project_id == project_id,
            Event.event_type == "page_view",
            self._not_bot_expression(),
            or_(Event.user_id.isnot(None), Event.anonymous_id.isnot(None)),
        )
        query = self._date_filter(query, Event.timestamp, start, end)
        return self.db.scalar(query) or 0

    def count_visitors_for_path(self, project_id: str, path: str, start: datetime | None, end: datetime | None) -> int:
        identity = self._identity_expression()
        query = select(func.count(func.distinct(identity))).where(
            Event.project_id == project_id,
            Event.event_type == "page_view",
            self._not_bot_expression(),
            self._page_path_expression() == path,
            or_(Event.user_id.isnot(None), Event.anonymous_id.isnot(None)),
        )
        query = self._date_filter(query, Event.timestamp, start, end)
        return self.db.scalar(query) or 0

    def count_sessions_with_page_views(self, project_id: str, start: datetime | None, end: datetime | None) -> int:
        query = select(func.count(func.distinct(Event.session_id))).where(
            Event.project_id == project_id,
            Event.event_type == "page_view",
            self._not_bot_expression(),
            Event.session_id.isnot(None),
        )
        query = self._date_filter(query, Event.timestamp, start, end)
        return self.db.scalar(query) or 0

    def count_sessions_for_path(self, project_id: str, path: str, start: datetime | None, end: datetime | None) -> int:
        query = select(func.count(func.distinct(Event.session_id))).where(
            Event.project_id == project_id,
            Event.event_type == "page_view",
            self._not_bot_expression(),
            self._page_path_expression() == path,
            Event.session_id.isnot(None),
        )
        query = self._date_filter(query, Event.timestamp, start, end)
        return self.db.scalar(query) or 0

    def count_unique_sessions(self, project_id: str) -> int:
        query = select(func.count(func.distinct(Event.session_id))).where(
            Event.project_id == project_id,
            Event.session_id.isnot(None),
        )
        return self.db.scalar(query) or 0

    def count_events_for_path(self, project_id: str, path: str, start: datetime | None, end: datetime | None) -> int:
        query = select(func.count()).select_from(Event).where(Event.project_id == project_id, self._page_path_expression() == path)
        query = self._date_filter(query, Event.timestamp, start, end)
        return self.db.scalar(query) or 0

    def count_errors_for_path(self, project_id: str, path: str, start: datetime | None, end: datetime | None) -> int:
        query = select(func.count()).select_from(Event).where(
            Event.project_id == project_id,
            Event.event_type.in_(["frontend_error", "backend_error"]),
            self._page_path_expression() == path,
        )
        query = self._date_filter(query, Event.timestamp, start, end)
        return self.db.scalar(query) or 0

    def page_analytics_breakdown(
        self,
        project_id: str,
        path: str,
        property_name: str,
        start: datetime | None,
        end: datetime | None,
        limit: int = 8,
    ) -> list[dict[str, Any]]:
        dimension = Event.properties[property_name].as_string()
        query = (
            select(dimension.label("label"), func.count().label("count"))
            .where(
                Event.project_id == project_id,
                Event.event_type == "page_view",
                self._not_bot_expression(),
                self._page_path_expression() == path,
                dimension.isnot(None),
                dimension != "",
            )
            .group_by(dimension)
            .order_by(func.count().desc(), dimension.asc())
            .limit(limit)
        )
        query = self._date_filter(query, Event.timestamp, start, end)
        return list(self.db.execute(query).mappings())

    def web_vitals_summary(self, project_id: str, start: datetime | None, end: datetime | None) -> list[dict[str, Any]]:
        metric = Event.properties["name"].as_string()
        value = cast(Event.properties["value"].as_string(), Float)
        query = (
            select(
                metric.label("name"),
                func.avg(value).label("average"),
                func.percentile_cont(0.75).within_group(value).label("p75"),
                func.count().label("count"),
            )
            .where(Event.project_id == project_id, Event.event_type == "custom_event", Event.event_name == "web_vital", metric.isnot(None))
            .group_by(metric)
            .order_by(metric.asc())
        )
        query = self._date_filter(query, Event.timestamp, start, end)
        return list(self.db.execute(query).mappings())

    def web_vitals_summary_for_path(self, project_id: str, path: str, start: datetime | None, end: datetime | None) -> list[dict[str, Any]]:
        metric = Event.properties["name"].as_string()
        value = cast(Event.properties["value"].as_string(), Float)
        query = (
            select(
                metric.label("name"),
                func.avg(value).label("average"),
                func.percentile_cont(0.75).within_group(value).label("p75"),
                func.count().label("count"),
            )
            .where(
                Event.project_id == project_id,
                Event.event_type == "custom_event",
                Event.event_name == "web_vital",
                self._page_path_expression() == path,
                metric.isnot(None),
            )
            .group_by(metric)
            .order_by(metric.asc())
        )
        query = self._date_filter(query, Event.timestamp, start, end)
        return list(self.db.execute(query).mappings())

    def funnel_counts(self, project_id: str, steps: list[dict[str, str | None]], start: datetime | None, end: datetime | None) -> list[int]:
        if not steps:
            return []

        event_types = {step["event_type"] for step in steps}
        query = (
            select(Event.user_id, Event.anonymous_id, Event.event_type, Event.event_name, Event.timestamp)
            .where(Event.project_id == project_id, Event.event_type.in_(event_types))
            .order_by(Event.timestamp.asc())
        )
        query = self._date_filter(query, Event.timestamp, start, end)

        progress: dict[str, int] = {}
        for row in self.db.execute(query):
            identity = self._row_identity(row.user_id, row.anonymous_id)
            if not identity:
                continue
            index = progress.get(identity, 0)
            if index >= len(steps):
                continue
            if self._matches_funnel_step(row.event_type, row.event_name, steps[index]):
                progress[identity] = index + 1

        return [sum(1 for reached in progress.values() if reached >= index + 1) for index in range(len(steps))]

    def retention_points(self, project_id: str, start: datetime | None, end: datetime | None) -> list[dict[str, Any]]:
        identity = self._identity_expression()
        day = func.date_trunc("day", Event.timestamp)
        first_seen = (
            select(identity.label("identity"), func.min(Event.timestamp).label("first_seen"))
            .where(Event.project_id == project_id, or_(Event.user_id.isnot(None), Event.anonymous_id.isnot(None)))
            .group_by(identity)
            .subquery()
        )
        query = (
            select(
                day.label("date"),
                func.count(func.distinct(identity)).label("active_users"),
                func.count(func.distinct(case((func.date_trunc("day", first_seen.c.first_seen) == day, identity)))).label("new_users"),
            )
            .join(first_seen, first_seen.c.identity == identity)
            .where(Event.project_id == project_id, or_(Event.user_id.isnot(None), Event.anonymous_id.isnot(None)))
            .group_by(day)
            .order_by(day.asc())
        )
        query = self._date_filter(query, Event.timestamp, start, end)
        rows = []
        for row in self.db.execute(query).mappings():
            active_users = int(row["active_users"] or 0)
            new_users = int(row["new_users"] or 0)
            rows.append(
                {
                    "date": row["date"],
                    "active_users": active_users,
                    "new_users": new_users,
                    "returning_users": max(0, active_users - new_users),
                }
            )
        return rows

    def timeline_for_user(self, project_id: str, user_id: str, limit: int = 100) -> list[Event]:
        query = (
            select(Event)
            .where(Event.project_id == project_id, Event.user_id == user_id)
            .order_by(Event.timestamp.desc())
            .limit(limit)
        )
        return list(self.db.scalars(query))

    def user_profile_stats(self, project_id: str, user_id: str) -> dict[str, Any]:
        query = select(
            func.min(Event.timestamp).label("first_seen"),
            func.max(Event.timestamp).label("last_seen"),
            func.count().label("event_count"),
            func.count(func.distinct(Event.session_id)).label("session_count"),
            func.count(case((Event.event_type.in_(["frontend_error", "backend_error"]), 1))).label("error_count"),
            func.count(case((Event.event_type == "page_view", 1))).label("page_view_count"),
        ).where(Event.project_id == project_id, Event.user_id == user_id)
        return dict(self.db.execute(query).mappings().one())

    def user_breakdown(self, project_id: str, user_id: str, property_name: str, limit: int = 8) -> list[dict[str, Any]]:
        dimension = Event.properties[property_name].as_string()
        query = (
            select(dimension.label("label"), func.count().label("count"))
            .where(Event.project_id == project_id, Event.user_id == user_id, dimension.isnot(None), dimension != "")
            .group_by(dimension)
            .order_by(func.count().desc(), dimension.asc())
            .limit(limit)
        )
        return list(self.db.execute(query).mappings())

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

    def _identity_expression(self):
        return case(
            (Event.user_id.isnot(None), literal("user:") + Event.user_id),
            else_=literal("anon:") + Event.anonymous_id,
        )

    def _page_path_expression(self):
        return Event.properties["path"].as_string()

    def _not_bot_expression(self):
        is_bot = Event.properties["is_bot"].as_boolean()
        return or_(is_bot.is_(None), is_bot.is_(False))

    def _row_identity(self, user_id: str | None, anonymous_id: str | None) -> str | None:
        if user_id:
            return f"user:{user_id}"
        if anonymous_id:
            return f"anon:{anonymous_id}"
        return None

    def _matches_funnel_step(self, event_type: str, event_name: str | None, step: dict[str, str | None]) -> bool:
        if event_type != step["event_type"]:
            return False
        expected_name = step.get("event_name")
        return expected_name in (None, "*") or event_name == expected_name


EVENT_MODELS = {
    "errors": ErrorEvent,
    "requests": ApiRequestEvent,
    "sessions": SessionEvent,
    "jobs": JobEvent,
    "webhooks": WebhookEvent,
}
