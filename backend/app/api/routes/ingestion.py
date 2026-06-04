from pathlib import Path

from fastapi import APIRouter, Depends, Request
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
def events(payload: BaseEventIn, request: Request, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    payload = _with_request_context(payload, request)
    event = IngestionService(db).ingest_event(project_id, payload)
    publish_project_update(project_id, "event.created", event)
    return success({"id": event.id})


@router.post("/errors")
def errors(payload: ErrorEventIn, request: Request, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    payload = payload.model_copy(update={"properties": _merge_context(payload.properties, request)})
    event, detail = IngestionService(db).ingest_error(project_id, payload)
    publish_project_update(project_id, "event.created", event)
    return success({"id": detail.id})


@router.post("/requests")
def requests(payload: ApiRequestEventIn, project_id: str = Depends(get_project_id_from_secret_api_key), db: Session = Depends(get_db)):
    event, detail = IngestionService(db).ingest_request(project_id, payload)
    publish_project_update(project_id, "event.created", event)
    return success({"id": detail.id})


@router.post("/sessions")
def sessions(payload: SessionEventIn, request: Request, project_id: str = Depends(get_project_id_from_api_key), db: Session = Depends(get_db)):
    payload = payload.model_copy(update={"properties": _merge_context(payload.properties, request)})
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
def batch(payload: BatchIngestIn, request: Request, project_id: str = Depends(get_project_id_from_secret_api_key), db: Session = Depends(get_db)):
    service = IngestionService(db)
    counts = {"events": 0, "errors": 0, "requests": 0, "sessions": 0, "jobs": 0, "webhooks": 0}

    for item in payload.events:
        item = _with_request_context(item, request)
        event = service.ingest_event(project_id, item)
        publish_project_update(project_id, "event.created", event)
        counts["events"] += 1

    for item in payload.errors:
        item = item.model_copy(update={"properties": _merge_context(item.properties, request)})
        event, _ = service.ingest_error(project_id, item)
        publish_project_update(project_id, "event.created", event)
        counts["errors"] += 1

    for item in payload.requests:
        event, _ = service.ingest_request(project_id, item)
        publish_project_update(project_id, "event.created", event)
        counts["requests"] += 1

    for item in payload.sessions:
        item = item.model_copy(update={"properties": _merge_context(item.properties, request)})
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


def _with_request_context(payload: BaseEventIn, request: Request) -> BaseEventIn:
    return payload.model_copy(update={"properties": _merge_context(payload.properties, request)})


def _merge_context(properties: dict, request: Request) -> dict:
    context = _geo_context(request)
    return {**context, **properties}


def _geo_context(request: Request) -> dict[str, str]:
    headers = request.headers
    country = headers.get("cf-ipcountry") or headers.get("x-vercel-ip-country")
    region = headers.get("x-vercel-ip-country-region") or headers.get("x-appengine-region")
    city = headers.get("x-vercel-ip-city") or headers.get("x-appengine-city")
    context = {}
    if country:
        context["geo_country"] = country
    if region:
        context["geo_region"] = region
    if city:
        context["geo_city"] = city
    return context
