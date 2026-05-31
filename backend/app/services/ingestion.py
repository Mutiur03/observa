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

    def ingest_error(self, project_id: str, payload: ErrorEventIn) -> tuple[Event, ErrorEvent]:
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
        detail = self.events.add(ErrorEvent, {**payload.model_dump(), "project_id": project_id, "event_id": event.id})
        return self.events.refresh(event), detail

    def ingest_request(self, project_id: str, payload: ApiRequestEventIn) -> tuple[Event, ApiRequestEvent]:
        event_name = self._request_event_name(payload.method, payload.path)
        event = self.ingest_event(
            project_id,
            BaseEventIn(
                event_type="api_request",
                event_name=event_name,
                user_id=payload.user_id,
                session_id=payload.session_id,
                trace_id=payload.trace_id,
                properties=payload.properties,
                timestamp=payload.timestamp,
            ),
        )
        detail = self.events.add(ApiRequestEvent, {**payload.model_dump(), "project_id": project_id, "method": payload.method.upper()})
        return self.events.refresh(event), detail

    def ingest_session(self, project_id: str, payload: SessionEventIn) -> tuple[Event, SessionEvent]:
        event = self.ingest_event(
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
        detail = self.events.add(SessionEvent, {**payload.model_dump(), "project_id": project_id})
        return self.events.refresh(event), detail

    def ingest_job(self, project_id: str, payload: JobEventIn) -> tuple[Event, JobEvent]:
        event_type = {"started": "job_started", "completed": "job_completed", "failed": "job_failed"}[payload.status]
        event = self.ingest_event(
            project_id,
            BaseEventIn(
                event_type=event_type,
                event_name=payload.job_name,
                trace_id=payload.trace_id,
                properties=payload.properties,
                timestamp=payload.timestamp,
            ),
        )
        detail = self.events.add(JobEvent, {**payload.model_dump(), "project_id": project_id})
        return self.events.refresh(event), detail

    def ingest_webhook(self, project_id: str, payload: WebhookEventIn) -> tuple[Event, WebhookEvent]:
        event = self.ingest_event(
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
        detail = self.events.add(WebhookEvent, {**data, "project_id": project_id})
        return self.events.refresh(event), detail

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def _request_event_name(self, method: str, path: str) -> str:
        prefix = f"{method.upper()} "
        if len(prefix) + len(path) <= 200:
            return f"{prefix}{path}"

        route = path.split("?", 1)[0]
        if len(prefix) + len(route) <= 200:
            return f"{prefix}{route}"

        return f"{prefix}{route[:200 - len(prefix) - 3]}..."
