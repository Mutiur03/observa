import asyncio
import logging

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.websockets import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings, is_allowed_browser_origin
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.auth import User
from app.models.events import ApiRequestEvent, ErrorEvent
from app.db.session import SessionLocal
from app.repositories.users import UserRepository
from app.services.authorization import AuthorizationService
from app.services.dashboard import DashboardService
from app.services.realtime import publish_project_update
from app.services.presence import PresenceService
import json
import redis.asyncio as aioredis
from redis.exceptions import TimeoutError as RedisTimeoutError

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

logger = logging.getLogger(__name__)


async def _require_allowed_origin(websocket: WebSocket) -> bool:
    if is_allowed_browser_origin(websocket.headers.get("origin")):
        return True
    await websocket.close(code=1008)
    return False


def _is_realtime_payload(payload) -> bool:
    if not isinstance(payload, dict):
        return False

    data = payload.get("data")
    if payload.get("type") == "event.created":
        return isinstance(data, dict) and isinstance(data.get("event_type"), str) and data.get("timestamp") is not None
    if payload.get("type") in {"event.deleted", "events.deleted"}:
        return isinstance(data, dict)
    return False


@router.get("/overview")
def overview(
    project_id: str = Query(...),
    range_: str = Query("24h", alias="range"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    AuthorizationService(db).require_project_role(project_id, user, "viewer")
    return DashboardService(db).overview(project_id, range_)


@router.websocket("/overview/ws")
async def overview_stream(websocket: WebSocket, project_id: str = Query(...), range_: str = Query("24h", alias="range")):
    db = SessionLocal()
    try:
        if not await _require_allowed_origin(websocket):
            return
        logger.info("websocket connection attempt for project_id=%s", project_id)
        token = websocket.cookies.get(get_settings().auth_cookie_name)
        if not token:
            logger.warning("ws no auth cookie for project %s", project_id)
            await websocket.close(code=1008)
            return

        user_id = decode_access_token(token)
        logger.debug("ws decoded user id: %s", user_id)
        if not user_id:
            logger.warning("ws token invalid for project %s", project_id)
            await websocket.close(code=1008)
            return

        user = UserRepository(db).get(user_id)
        if not user or not user.is_active:
            await websocket.close(code=1008)
            return

        AuthorizationService(db).require_project_role(project_id, user, "viewer")
        await websocket.accept()
        logger.info("ws accepted for user=%s project=%s", user_id, project_id)

        service = DashboardService(db)
        while True:
            try:
                data = service.overview(project_id, range_).model_dump()
                await websocket.send_json({"type": "overview", "data": data})
            except WebSocketDisconnect:
                break
            except Exception as exc:
                logger.exception("ws send error for project %s: %s", project_id, exc)
                # break loop on error to avoid noisy retry
                break
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
    finally:
        db.close()


@router.websocket("/events/ws")
async def events_stream(websocket: WebSocket, project_id: str = Query(...)):
    db = SessionLocal()
    try:
        if not await _require_allowed_origin(websocket):
            return
        logger.info("events websocket connection attempt for project_id=%s", project_id)
        token = websocket.cookies.get(get_settings().auth_cookie_name)
        if not token:
            logger.warning("events ws no auth token for project %s", project_id)
            await websocket.close(code=1008)
            return

        user_id = decode_access_token(token)
        if not user_id:
            await websocket.close(code=1008)
            return

        user = UserRepository(db).get(user_id)
        if not user or not user.is_active:
            await websocket.close(code=1008)
            return

        AuthorizationService(db).require_project_role(project_id, user, "viewer")
        await websocket.accept()

        settings = get_settings()
        redis = aioredis.from_url(settings.redis_url, decode_responses=True)
        pubsub = redis.pubsub()
        channel = f"project:{project_id}:events"
        await pubsub.subscribe(channel)
        logger.info("events ws subscribed user=%s project=%s", user_id, project_id)

        disconnect_task = asyncio.create_task(websocket.receive())
        try:
            while True:
                message_task = asyncio.create_task(pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0))
                try:
                    done, _ = await asyncio.wait(
                        {disconnect_task, message_task},
                        return_when=asyncio.FIRST_COMPLETED,
                    )
                    if disconnect_task in done:
                        message_task.cancel()
                        await asyncio.gather(message_task, return_exceptions=True)
                        break
                    message = message_task.result()
                except RedisTimeoutError:
                    logger.debug("events ws redis timeout project=%s", project_id)
                    continue
                except asyncio.CancelledError:
                    message_task.cancel()
                    await asyncio.gather(message_task, return_exceptions=True)
                    logger.info("events ws cancelled for project=%s", project_id)
                    break
                except Exception as exc:
                    logger.exception("events ws get_message error for project=%s: %s", project_id, exc)
                    await asyncio.sleep(0.5)
                    continue

                if message is None:
                    continue

                data_raw = message.get("data")
                try:
                    payload = json.loads(data_raw)
                except Exception:
                    payload = {"type": "unknown", "data": data_raw}

                if not _is_realtime_payload(payload):
                    logger.debug("events ws ignored malformed payload for project=%s", project_id)
                    continue

                try:
                    await websocket.send_json(payload)
                except WebSocketDisconnect:
                    break
                except Exception as exc:
                    logger.exception("events ws send failed: %s", exc)
                    break
        finally:
            disconnect_task.cancel()
            await asyncio.gather(disconnect_task, return_exceptions=True)
            await pubsub.unsubscribe(channel)
            await pubsub.close()
            await redis.close()
    except WebSocketDisconnect:
        pass
    finally:
        db.close()


@router.get("/presence")
def presence(project_id: str = Query(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    AuthorizationService(db).require_project_role(project_id, user, "viewer")
    return PresenceService().snapshot(project_id)


@router.websocket("/presence/ws")
async def presence_stream(websocket: WebSocket, project_id: str = Query(...)):
    db = SessionLocal()
    redis = None
    pubsub = None
    try:
        if not await _require_allowed_origin(websocket):
            return
        token = websocket.cookies.get(get_settings().auth_cookie_name)
        user_id = decode_access_token(token) if token else None
        user = UserRepository(db).get(user_id) if user_id else None
        if not user or not user.is_active:
            await websocket.close(code=1008)
            return

        AuthorizationService(db).require_project_role(project_id, user, "viewer")
        await websocket.accept()

        redis = aioredis.from_url(get_settings().redis_url, decode_responses=True)
        pubsub = redis.pubsub()
        await pubsub.subscribe(f"project:{project_id}:presence")
        service = PresenceService()
        while True:
            await websocket.send_json({"type": "presence", "data": service.snapshot(project_id).model_dump(mode="json")})
            await pubsub.get_message(ignore_subscribe_messages=True, timeout=5.0)
    except WebSocketDisconnect:
        pass
    finally:
        if pubsub:
            await pubsub.close()
        if redis:
            await redis.close()
        db.close()


@router.get("/events")
def events(
    project_id: str = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    event_type: str | None = None,
    session_id: str | None = None,
    user_id: str | None = None,
    anonymous_id: str | None = None,
    trace_id: str | None = None,
    search: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    AuthorizationService(db).require_project_role(project_id, user, "viewer")
    return DashboardService(db).events_page(
        project_id,
        page,
        page_size,
        event_type,
        session_id=session_id,
        user_id=user_id,
        anonymous_id=anonymous_id,
        trace_id=trace_id,
        search=search,
    )


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: str,
    project_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    AuthorizationService(db).require_project_role(project_id, user, "member")
    if DashboardService(db).events.delete_event(project_id, event_id):
        publish_project_update(project_id, "event.deleted", {"id": event_id})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/events", status_code=status.HTTP_204_NO_CONTENT)
def delete_events(
    project_id: str = Query(...),
    event_type: str | None = None,
    session_id: str | None = None,
    user_id: str | None = None,
    anonymous_id: str | None = None,
    trace_id: str | None = None,
    search: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    AuthorizationService(db).require_project_role(project_id, user, "member")
    ids = DashboardService(db).events.delete_events(
        project_id,
        event_type=event_type,
        session_id=session_id,
        user_id=user_id,
        anonymous_id=anonymous_id,
        trace_id=trace_id,
        search=search,
    )
    if ids:
        publish_project_update(project_id, "events.deleted", {"ids": ids})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/errors")
def errors(project_id: str, page: int = 1, page_size: int = 25, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    AuthorizationService(db).require_project_role(project_id, user, "viewer")
    return DashboardService(db).model_page(ErrorEvent, project_id, page, page_size)


@router.get("/requests")
def requests(project_id: str, page: int = 1, page_size: int = 25, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    AuthorizationService(db).require_project_role(project_id, user, "viewer")
    return DashboardService(db).model_page(ApiRequestEvent, project_id, page, page_size)


@router.get("/sessions")
def sessions(project_id: str, page: int = 1, page_size: int = 25, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    AuthorizationService(db).require_project_role(project_id, user, "viewer")
    return DashboardService(db).sessions_page(project_id, page, page_size)


@router.get("/users/{user_id}/timeline")
def user_timeline(user_id: str, project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    AuthorizationService(db).require_project_role(project_id, user, "viewer")
    return DashboardService(db).timeline(project_id, user_id)


@router.get("/projects/{project_id}/stats")
def project_stats(
    project_id: str,
    range_: str = Query("24h", alias="range"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    AuthorizationService(db).require_project_role(project_id, user, "viewer")
    return DashboardService(db).overview(project_id, range_)
