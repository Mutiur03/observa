from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_project_id_from_api_key, get_project_id_from_secret_api_key
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
from app.schemas.presence import PresenceHeartbeatIn
from app.services.ingestion import IngestionService
from app.services.presence import PresenceService
from app.services.realtime import publish_project_update

router = APIRouter(prefix="/v1", tags=["ingestion"])
STATIC_DIR = Path(__file__).resolve().parents[2] / "static"


@router.get("/presence.js", include_in_schema=False)
def presence_script():
    return FileResponse(STATIC_DIR / "observa-presence.js", media_type="application/javascript")


@router.post("/presence")
def presence(payload: PresenceHeartbeatIn, project_id: str = Depends(get_project_id_from_api_key)):
    return PresenceService().heartbeat(project_id, payload)


@router.post("/events")
def events(payload: BaseEventIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    event = IngestionService(db).ingest_event(project_id, payload)
    publish_project_update(project_id, "event.created", event)
    return success({"id": event.id})


@router.post("/errors")
def errors(payload: ErrorEventIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    event, detail = IngestionService(db).ingest_error(project_id, payload)
    publish_project_update(project_id, "event.created", event)
    return success({"id": detail.id})


@router.post("/requests")
def requests(payload: ApiRequestEventIn, project_id: str = Depends(get_project_id_from_secret_api_key), db: Session = Depends(get_db)):
    event, detail = IngestionService(db).ingest_request(project_id, payload)
    publish_project_update(project_id, "event.created", event)
    return success({"id": detail.id})


@router.post("/sessions")
def sessions(payload: SessionEventIn, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    event, detail = IngestionService(db).ingest_session(project_id, payload)
    publish_project_update(project_id, "event.created", event)
    return success({"id": detail.id})


@router.post("/jobs")
def jobs(payload: JobEventIn, project_id: str = Depends(get_project_id_from_secret_api_key), db: Session = Depends(get_db)):
    event, detail = IngestionService(db).ingest_job(project_id, payload)
    publish_project_update(project_id, "event.created", event)
    return success({"id": detail.id})


@router.post("/webhooks")
def webhooks(payload: WebhookEventIn, project_id: str = Depends(get_project_id_from_secret_api_key), db: Session = Depends(get_db)):
    event, detail = IngestionService(db).ingest_webhook(project_id, payload)
    publish_project_update(project_id, "event.created", event)
    return success({"id": detail.id})


@router.post("/batch")
def batch(payload: BatchIngestIn, project_id: str = Depends(get_project_id_from_secret_api_key), db: Session = Depends(get_db)):
    service = IngestionService(db)
    counts = {"events": 0, "errors": 0, "requests": 0, "sessions": 0, "jobs": 0, "webhooks": 0}

    for item in payload.events:
        event = service.ingest_event(project_id, item)
        publish_project_update(project_id, "event.created", event)
        counts["events"] += 1

    for item in payload.errors:
        event, _ = service.ingest_error(project_id, item)
        publish_project_update(project_id, "event.created", event)
        counts["errors"] += 1

    for item in payload.requests:
        event, _ = service.ingest_request(project_id, item)
        publish_project_update(project_id, "event.created", event)
        counts["requests"] += 1

    for item in payload.sessions:
        event, _ = service.ingest_session(project_id, item)
        publish_project_update(project_id, "event.created", event)
        counts["sessions"] += 1

    for item in payload.jobs:
        event, _ = service.ingest_job(project_id, item)
        publish_project_update(project_id, "event.created", event)
        counts["jobs"] += 1

    for item in payload.webhooks:
        event, _ = service.ingest_webhook(project_id, item)
        publish_project_update(project_id, "event.created", event)
        counts["webhooks"] += 1

    return success(counts)
