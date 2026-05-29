from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.auth import User
from app.models.organization import OrganizationMember, Project

ROLE_ORDER = {"viewer": 1, "member": 2, "admin": 3, "owner": 4}


class AuthorizationService:
    def __init__(self, db: Session):
        self.db = db

    def require_project_role(self, project_id: str, user: User, minimum_role: str = "viewer") -> Project:
        query = (
            select(Project, OrganizationMember.role)
            .join(OrganizationMember, OrganizationMember.organization_id == Project.organization_id)
            .where(Project.id == project_id, OrganizationMember.user_id == user.id)
        )
        row = self.db.execute(query).first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        project, role = row
        if ROLE_ORDER[role] < ROLE_ORDER[minimum_role]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient project permissions")
        return project

    def require_organization_role(self, organization_id: str, user: User, minimum_role: str = "member") -> None:
        member = self.db.scalar(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == organization_id,
                OrganizationMember.user_id == user.id,
            )
        )
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
        if ROLE_ORDER[member.role] < ROLE_ORDER[minimum_role]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient organization permissions")
