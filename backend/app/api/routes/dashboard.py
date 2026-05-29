from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.auth import User
from app.models.events import ApiRequestEvent, ErrorEvent, SessionEvent
from app.services.authorization import AuthorizationService
from app.services.dashboard import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview")
def overview(project_id: str = Query(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    AuthorizationService(db).require_project_role(project_id, user, "viewer")
    return DashboardService(db).overview(project_id)


@router.get("/events")
def events(
    project_id: str = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    event_type: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    AuthorizationService(db).require_project_role(project_id, user, "viewer")
    return DashboardService(db).events_page(project_id, page, page_size, event_type)


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
    return DashboardService(db).model_page(SessionEvent, project_id, page, page_size)


@router.get("/users/{user_id}/timeline")
def user_timeline(user_id: str, project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    AuthorizationService(db).require_project_role(project_id, user, "viewer")
    return DashboardService(db).timeline(project_id, user_id)


@router.get("/projects/{project_id}/stats")
def project_stats(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    AuthorizationService(db).require_project_role(project_id, user, "viewer")
    return DashboardService(db).overview(project_id)
