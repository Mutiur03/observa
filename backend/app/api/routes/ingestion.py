import json

from fastapi import APIRouter, Depends
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.api.deps import get_project_id_from_api_key
from app.core.config import get_settings
from app.core.responses import success
from app.db.session import get_db
from app.schemas.events import (
    ApiRequestEventIn,
    BaseEventIn,
    BatchIngestIn,
    ErrorEventIn,
    JobEventIn,
    SessionEventIn,
    WebhookEventIn,
)
from app.services.ingestion import IngestionService
from redis import Redis

router = APIRouter(prefix="/v1", tags=["ingestion"])


def _publish_event(project_id: str, message_type: str, event) -> None:
    try:
        settings = get_settings()
        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        channel = f"project:{project_id}:events"
        message = {"type": message_type, "data": jsonable_encoder(event)}
        redis.publish(channel, json.dumps(message))
    except Exception:
        pass


@router.post("/events")
def events(payload: BaseEventIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    event = IngestionService(db).ingest_event(project_id, payload)
    _publish_event(project_id, event.event_type, event)
    return success({"id": event.id})


@router.post("/errors")
def errors(payload: ErrorEventIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    event, detail = IngestionService(db).ingest_error(project_id, payload)
    _publish_event(project_id, "error", event)
    return success({"id": detail.id})


@router.post("/requests")
def requests(payload: ApiRequestEventIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    event, detail = IngestionService(db).ingest_request(project_id, payload)
    _publish_event(project_id, "request", event)
    return success({"id": detail.id})


@router.post("/sessions")
def sessions(payload: SessionEventIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    event, detail = IngestionService(db).ingest_session(project_id, payload)
    _publish_event(project_id, "session", event)
    return success({"id": detail.id})


@router.post("/jobs")
def jobs(payload: JobEventIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    event, detail = IngestionService(db).ingest_job(project_id, payload)
    _publish_event(project_id, "job", event)
    return success({"id": detail.id})


@router.post("/webhooks")
def webhooks(payload: WebhookEventIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    event, detail = IngestionService(db).ingest_webhook(project_id, payload)
    _publish_event(project_id, "webhook", event)
    return success({"id": detail.id})


@router.post("/batch")
def batch(payload: BatchIngestIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    service = IngestionService(db)
    counts = {"events": 0, "errors": 0, "requests": 0, "sessions": 0, "jobs": 0, "webhooks": 0}

    for item in payload.events:
        event = service.ingest_event(project_id, item)
        _publish_event(project_id, event.event_type, event)
        counts["events"] += 1

    for item in payload.errors:
        event, _ = service.ingest_error(project_id, item)
        _publish_event(project_id, "error", event)
        counts["errors"] += 1

    for item in payload.requests:
        event, _ = service.ingest_request(project_id, item)
        _publish_event(project_id, "request", event)
        counts["requests"] += 1

    for item in payload.sessions:
        event, _ = service.ingest_session(project_id, item)
        _publish_event(project_id, "session", event)
        counts["sessions"] += 1

    for item in payload.jobs:
        event, _ = service.ingest_job(project_id, item)
        _publish_event(project_id, "job", event)
        counts["jobs"] += 1

    for item in payload.webhooks:
        event, _ = service.ingest_webhook(project_id, item)
        _publish_event(project_id, "webhook", event)
        counts["webhooks"] += 1

    return success(counts)
