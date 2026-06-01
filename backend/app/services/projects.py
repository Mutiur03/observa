from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import generate_api_key
from app.models.auth import User
from app.repositories.organizations import ApiKeyRepository, OrganizationRepository, ProjectRepository
from app.schemas.organization import ApiKeyCreate, ApiKeyCreated, OrganizationCreate, ProjectCreate, ProjectUpdate
from app.services.authorization import AuthorizationService


class OrganizationService:
    def __init__(self, db: Session):
        self.organizations = OrganizationRepository(db)

    def create(self, payload: OrganizationCreate, user: User):
        if self.organizations.get_by_slug(payload.slug):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Organization slug already exists")
        return self.organizations.create(payload.name, payload.slug, user.id)

    def list_for_user(self, user: User):
        return self.organizations.list_for_user(user.id)


class ProjectService:
    def __init__(self, db: Session):
        self.db = db
        self.projects = ProjectRepository(db)
        self.keys = ApiKeyRepository(db)
        self.authz = AuthorizationService(db)

    def create(self, payload: ProjectCreate, user: User):
        self.authz.require_organization_role(payload.organization_id, user, "admin")
        return self.projects.create(payload.organization_id, payload.name, payload.slug, payload.environment)

    def get(self, project_id: str, user: User):
        return self.authz.require_project_role(project_id, user, "viewer")

    def update(self, project_id: str, payload: ProjectUpdate, user: User):
        project = self.authz.require_project_role(project_id, user, "admin")
        data = payload.model_dump(exclude_unset=True)
        return self.projects.update(project, data)

    def list_for_user(self, user: User):
        return self.projects.list_for_user(user.id)

    def create_key(self, project_id: str, payload: ApiKeyCreate, user: User) -> ApiKeyCreated:
        self.authz.require_project_role(project_id, user, "admin")
        prefix = "obspk" if payload.key_type == "public" else "obssk"
        raw_key, key_hash = generate_api_key(prefix)
        api_key = self.keys.create(project_id, payload.name, key_hash, raw_key[:16], payload.key_type)
        return ApiKeyCreated(
            id=api_key.id,
            name=api_key.name,
            key_prefix=api_key.key_prefix,
            key_type=api_key.key_type,
            is_active=api_key.is_active,
            created_at=api_key.created_at,
            key=raw_key,
        )

    def list_keys(self, project_id: str, user: User):
        self.authz.require_project_role(project_id, user, "viewer")
        return self.keys.list_for_project(project_id)

    def revoke_key(self, project_id: str, key_id: str, user: User) -> None:
        self.authz.require_project_role(project_id, user, "admin")
        self.keys.deactivate(project_id, key_id)

    def require_project(self, project_id: str):
        project = self.projects.get(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        return project
