from datetime import datetime

from pydantic import BaseModel, Field


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    slug: str = Field(min_length=2, max_length=120, pattern=r"^[a-z0-9-]+$")


class OrganizationOut(BaseModel):
    id: str
    name: str
    slug: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectCreate(BaseModel):
    organization_id: str
    name: str = Field(min_length=2, max_length=200)
    slug: str = Field(min_length=2, max_length=120, pattern=r"^[a-z0-9-]+$")
    environment: str = Field(default="production", max_length=50)


class ProjectOut(BaseModel):
    id: str
    organization_id: str
    name: str
    slug: str
    environment: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    key_type: str = Field(pattern=r"^(public|secret)$")


class ApiKeyOut(BaseModel):
    id: str
    name: str
    key_prefix: str
    key_type: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyCreated(ApiKeyOut):
    key: str
