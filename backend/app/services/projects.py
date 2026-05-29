from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import generate_api_key
from app.models.auth import User
from app.repositories.organizations import ApiKeyRepository, OrganizationRepository, ProjectRepository
from app.schemas.organization import ApiKeyCreate, ApiKeyCreated, OrganizationCreate, ProjectCreate


class OrganizationService:
    def __init__(self, db: Session):
        self.organizations = OrganizationRepository(db)

    def create(self, payload: OrganizationCreate, user: User):
        return self.organizations.create(payload.name, payload.slug, user.id)

    def list_for_user(self, user: User):
        return self.organizations.list_for_user(user.id)


class ProjectService:
    def __init__(self, db: Session):
        self.projects = ProjectRepository(db)
        self.keys = ApiKeyRepository(db)

    def create(self, payload: ProjectCreate, user: User):
        return self.projects.create(payload.organization_id, payload.name, payload.slug, payload.environment)

    def list_for_user(self, user: User):
        return self.projects.list_for_user(user.id)

    def create_key(self, project_id: str, payload: ApiKeyCreate) -> ApiKeyCreated:
        prefix = "obspk" if payload.key_type == "public" else "obssk"
        raw_key, key_hash = generate_api_key(prefix)
        api_key = self.keys.create(project_id, payload.name, key_hash, prefix, payload.key_type)
        return ApiKeyCreated(
            id=api_key.id,
            name=api_key.name,
            key_prefix=api_key.key_prefix,
            key_type=api_key.key_type,
            is_active=api_key.is_active,
            created_at=api_key.created_at,
            key=raw_key,
        )

    def list_keys(self, project_id: str):
        return self.keys.list_for_project(project_id)

    def require_project(self, project_id: str):
        project = self.projects.get(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        return project
