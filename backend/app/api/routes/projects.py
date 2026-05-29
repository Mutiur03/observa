from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.auth import User
from app.schemas.organization import (
    ApiKeyCreate,
    ApiKeyCreated,
    ApiKeyOut,
    OrganizationCreate,
    OrganizationOut,
    ProjectCreate,
    ProjectOut,
)
from app.services.projects import OrganizationService, ProjectService

router = APIRouter(tags=["organizations", "projects"])


@router.post("/organizations", response_model=OrganizationOut)
def create_organization(payload: OrganizationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return OrganizationService(db).create(payload, user)


@router.get("/organizations", response_model=list[OrganizationOut])
def list_organizations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return OrganizationService(db).list_for_user(user)


@router.post("/projects", response_model=ProjectOut)
def create_project(payload: ProjectCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ProjectService(db).create(payload, user)


@router.get("/projects", response_model=list[ProjectOut])
def list_projects(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ProjectService(db).list_for_user(user)


@router.post("/projects/{project_id}/api-keys", response_model=ApiKeyCreated)
def create_api_key(
    project_id: str,
    payload: ApiKeyCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ = user
    return ProjectService(db).create_key(project_id, payload)


@router.get("/projects/{project_id}/api-keys", response_model=list[ApiKeyOut])
def list_api_keys(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ = user
    return ProjectService(db).list_keys(project_id)
