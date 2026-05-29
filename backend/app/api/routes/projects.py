from fastapi import APIRouter, Depends, Response, status
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
    ProjectUpdate,
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


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ProjectService(db).get(project_id, user)


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ProjectService(db).update(project_id, payload, user)


@router.post("/projects/{project_id}/api-keys", response_model=ApiKeyCreated)
def create_api_key(
    project_id: str,
    payload: ApiKeyCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ProjectService(db).create_key(project_id, payload, user)


@router.get("/projects/{project_id}/api-keys", response_model=list[ApiKeyOut])
def list_api_keys(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ProjectService(db).list_keys(project_id, user)


@router.delete("/projects/{project_id}/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_api_key(project_id: str, key_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ProjectService(db).revoke_key(project_id, key_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
