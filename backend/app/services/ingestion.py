from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models.events import ApiRequestEvent, ErrorEvent, Event, JobEvent, SessionEvent, WebhookEvent
from app.repositories.events import EventRepository
from app.repositories.organizations import ApiKeyRepository
from app.schemas.events import (
    ApiRequestEventIn,
    BaseEventIn,
    ErrorEventIn,
    JobEventIn,
    SessionEventIn,
    WebhookEventIn,
)


class IngestionService:
    def __init__(self, db: Session):
        self.events = EventRepository(db)
        self.keys = ApiKeyRepository(db)

    def resolve_project_id(self, api_key: str) -> str:
        prefix = api_key.split("_", 1)[0] if "_" in api_key else ""
        for candidate in self.keys.find_active_by_prefix(prefix):
            if verify_password(api_key, candidate.key_hash):
                return candidate.project_id
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

    def ingest_event(self, project_id: str, payload: BaseEventIn) -> Event:
        return self.events.create_event(
            {
                **payload.model_dump(),
                "project_id": project_id,
                "timestamp": payload.timestamp or self._now(),
            }
        )

    def ingest_error(self, project_id: str, payload: ErrorEventIn) -> ErrorEvent:
        event = self.ingest_event(
            project_id,
            BaseEventIn(
                event_type="backend_error" if payload.source == "backend" else "frontend_error",
                event_name=payload.error_type,
                user_id=payload.user_id,
                session_id=payload.session_id,
                trace_id=payload.trace_id,
                properties=payload.properties,
                timestamp=payload.timestamp,
            ),
        )
        return self.events.add(ErrorEvent, {**payload.model_dump(), "project_id": project_id, "event_id": event.id})

    def ingest_request(self, project_id: str, payload: ApiRequestEventIn) -> ApiRequestEvent:
        self.ingest_event(
            project_id,
            BaseEventIn(
                event_type="api_request",
                event_name=f"{payload.method.upper()} {payload.path}",
                user_id=payload.user_id,
                session_id=payload.session_id,
                trace_id=payload.trace_id,
                properties=payload.properties,
                timestamp=payload.timestamp,
            ),
        )
        return self.events.add(ApiRequestEvent, {**payload.model_dump(), "project_id": project_id, "method": payload.method.upper()})

    def ingest_session(self, project_id: str, payload: SessionEventIn) -> SessionEvent:
        self.ingest_event(
            project_id,
            BaseEventIn(
                event_type="session_start" if payload.action == "start" else "session_end",
                event_name=payload.action,
                user_id=payload.user_id,
                anonymous_id=payload.anonymous_id,
                session_id=payload.session_id,
                properties=payload.properties,
                timestamp=payload.timestamp,
            ),
        )
        return self.events.add(SessionEvent, {**payload.model_dump(), "project_id": project_id})

    def ingest_job(self, project_id: str, payload: JobEventIn) -> JobEvent:
        event_type = {"started": "job_started", "completed": "job_completed", "failed": "job_failed"}[payload.status]
        self.ingest_event(
            project_id,
            BaseEventIn(
                event_type=event_type,
                event_name=payload.job_name,
                trace_id=payload.trace_id,
                properties=payload.properties,
                timestamp=payload.timestamp,
            ),
        )
        return self.events.add(JobEvent, {**payload.model_dump(), "project_id": project_id})

    def ingest_webhook(self, project_id: str, payload: WebhookEventIn) -> WebhookEvent:
        self.ingest_event(
            project_id,
            BaseEventIn(
                event_type="webhook_delivery",
                event_name=payload.webhook_name,
                trace_id=payload.trace_id,
                properties=payload.properties,
                timestamp=payload.timestamp,
            ),
        )
        data = payload.model_dump()
        data["target_url"] = str(payload.target_url)
        return self.events.add(WebhookEvent, {**data, "project_id": project_id})

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)
