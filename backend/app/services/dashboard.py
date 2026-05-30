from sqlalchemy.orm import Session

from app.models.events import ApiRequestEvent, ErrorEvent, Event, JobEvent, SessionEvent, WebhookEvent
from app.models.monitoring import Monitor, MonitorCheck
from app.repositories.events import EventRepository
from app.schemas.dashboard import OverviewStats, SessionSummaryItem, TimelineItem


class DashboardService:
    def __init__(self, db: Session):
        self.db = db
        self.events = EventRepository(db)

    def overview(self, project_id: str) -> OverviewStats:
        return OverviewStats(
            events=self.events.count(Event, project_id),
            errors=self.events.count(ErrorEvent, project_id),
            requests=self.events.count(ApiRequestEvent, project_id),
            sessions=self.events.count(SessionEvent, project_id),
            failed_jobs=self.db.query(JobEvent).filter_by(project_id=project_id, status="failed").count(),
            failed_webhooks=self.db.query(WebhookEvent).filter_by(project_id=project_id, is_success=False).count(),
            monitor_down=(
                self.db.query(MonitorCheck)
                .join(Monitor, Monitor.id == MonitorCheck.monitor_id)
                .filter(Monitor.project_id == project_id, MonitorCheck.is_success.is_(False))
                .count()
            ),
        )

    def events_page(self, project_id: str, page: int, page_size: int, event_type: str | None, session_id: str | None = None):
        items, total = self.events.paginate_events(project_id, page, page_size, event_type, session_id=session_id)
        return {"items": items, "total": total, "page": page, "page_size": page_size}

    def model_page(self, model: type, project_id: str, page: int, page_size: int):
        items, total = self.events.list_model(model, project_id, page, page_size)
        return {"items": items, "total": total, "page": page, "page_size": page_size}

    def timeline(self, project_id: str, user_id: str) -> list[TimelineItem]:
        return [
            TimelineItem(id=item.id, kind=item.event_type, name=item.event_name, timestamp=item.timestamp, properties=item.properties)
            for item in self.events.timeline_for_user(project_id, user_id)
        ]

    def sessions_page(self, project_id: str, page: int, page_size: int):
        rows, total = self.events.list_sessions(project_id, page, page_size)
        items = [
            SessionSummaryItem(
                session_id=row["session_id"],
                user_id=row["user_id"],
                anonymous_id=row["anonymous_id"],
                event_count=int(row["event_count"] or 0),
                first_seen=row["first_seen"],
                last_seen=row["last_seen"],
            )
            for row in rows
        ]
        return {"items": items, "total": total, "page": page, "page_size": page_size}
