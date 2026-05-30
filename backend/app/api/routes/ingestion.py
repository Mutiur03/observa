from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import json

from redis import Redis

from app.api.deps import get_project_id_from_api_key
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
from app.core.config import get_settings

router = APIRouter(prefix="/v1", tags=["ingestion"])


@router.post("/events")
def events(payload: BaseEventIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    event = IngestionService(db).ingest_event(project_id, payload)
    try:
        settings = get_settings()
        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        channel = f"project:{project_id}:events"
        message = {
            "type": "event",
            "data": {
                "id": event.id,
                "event_type": event.event_type,
                "event_name": event.event_name,
                "user_id": event.user_id,
                "session_id": event.session_id,
                "trace_id": event.trace_id,
                "timestamp": event.timestamp.isoformat(),
                "properties": event.properties,
            },
        }
        redis.publish(channel, json.dumps(message))
    except Exception:
        pass
    return success({"id": event.id})


@router.post("/errors")
def errors(payload: ErrorEventIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    event = IngestionService(db).ingest_error(project_id, payload)
    try:
        settings = get_settings()
        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        channel = f"project:{project_id}:events"
        message = {
            "type": "error",
            "data": {
                "id": event.id,
                "error_type": event.error_type,
                "message": event.message,
                "stack_trace": event.stack_trace,
                "source": event.source,
                "user_id": event.user_id,
                "session_id": event.session_id,
                "trace_id": event.trace_id,
                "properties": event.properties,
                "timestamp": event.timestamp.isoformat(),
            },
        }
        redis.publish(channel, json.dumps(message))
    except Exception:
        pass
    return success({"id": event.id})


@router.post("/requests")
def requests(payload: ApiRequestEventIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    event = IngestionService(db).ingest_request(project_id, payload)
    try:
        settings = get_settings()
        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        channel = f"project:{project_id}:events"
        message = {
            "type": "request",
            "data": {
                "id": event.id,
                "method": event.method,
                "path": event.path,
                "status_code": event.status_code,
                "duration_ms": event.duration_ms,
                "user_id": event.user_id,
                "session_id": event.session_id,
                "trace_id": event.trace_id,
                "properties": event.properties,
                "timestamp": event.timestamp.isoformat(),
            },
        }
        redis.publish(channel, json.dumps(message))
    except Exception:
        pass
    return success({"id": event.id})


@router.post("/sessions")
def sessions(payload: SessionEventIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    event = IngestionService(db).ingest_session(project_id, payload)
    try:
        settings = get_settings()
        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        channel = f"project:{project_id}:events"
        message = {
            "type": "session",
            "data": {
                "id": event.id,
                "session_id": event.session_id,
                "user_id": event.user_id,
                "anonymous_id": event.anonymous_id,
                "action": event.action,
                "properties": event.properties,
                "timestamp": event.timestamp.isoformat(),
            },
        }
        redis.publish(channel, json.dumps(message))
    except Exception:
        pass
    return success({"id": event.id})


@router.post("/jobs")
def jobs(payload: JobEventIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    event = IngestionService(db).ingest_job(project_id, payload)
    return success({"id": event.id})


@router.post("/webhooks")
def webhooks(payload: WebhookEventIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    event = IngestionService(db).ingest_webhook(project_id, payload)
    return success({"id": event.id})


@router.post("/batch")
def batch(payload: BatchIngestIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    service = IngestionService(db)
    counts = {
        "events": len([service.ingest_event(project_id, item) for item in payload.events]),
        "errors": len([service.ingest_error(project_id, item) for item in payload.errors]),
        "requests": len([service.ingest_request(project_id, item) for item in payload.requests]),
        "sessions": len([service.ingest_session(project_id, item) for item in payload.sessions]),
        "jobs": len([service.ingest_job(project_id, item) for item in payload.jobs]),
        "webhooks": len([service.ingest_webhook(project_id, item) for item in payload.webhooks]),
    }
    return success(counts)
