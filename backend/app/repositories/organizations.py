from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.organization import ApiKey, Organization, OrganizationMember, Project


class OrganizationRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, name: str, slug: str, owner_id: str) -> Organization:
        organization = Organization(name=name, slug=slug)
        self.db.add(organization)
        self.db.flush()
        self.db.add(OrganizationMember(organization_id=organization.id, user_id=owner_id, role="owner"))
        self.db.commit()
        self.db.refresh(organization)
        return organization

    def list_for_user(self, user_id: str) -> list[Organization]:
        query = (
            select(Organization)
            .join(OrganizationMember)
            .where(OrganizationMember.user_id == user_id)
            .order_by(Organization.created_at.desc())
        )
        return list(self.db.scalars(query))


class ProjectRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, organization_id: str, name: str, slug: str, environment: str) -> Project:
        project = Project(organization_id=organization_id, name=name, slug=slug, environment=environment)
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def get(self, project_id: str) -> Project | None:
        return self.db.get(Project, project_id)

    def list_for_user(self, user_id: str) -> list[Project]:
        query = (
            select(Project)
            .join(Organization)
            .join(OrganizationMember)
            .where(OrganizationMember.user_id == user_id)
            .order_by(Project.created_at.desc())
        )
        return list(self.db.scalars(query))


class ApiKeyRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, project_id: str, name: str, key_hash: str, key_prefix: str, key_type: str) -> ApiKey:
        api_key = ApiKey(
            project_id=project_id,
            name=name,
            key_hash=key_hash,
            key_prefix=key_prefix,
            key_type=key_type,
        )
        self.db.add(api_key)
        self.db.commit()
        self.db.refresh(api_key)
        return api_key

    def list_for_project(self, project_id: str) -> list[ApiKey]:
        return list(self.db.scalars(select(ApiKey).where(ApiKey.project_id == project_id)))

    def find_active_by_prefix(self, key_prefix: str) -> list[ApiKey]:
        query = select(ApiKey).where(ApiKey.key_prefix == key_prefix, ApiKey.is_active.is_(True))
        return list(self.db.scalars(query))
