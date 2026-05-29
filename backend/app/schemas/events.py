from datetime import datetime
from typing import Any, Literal

from pydantic import AnyUrl, BaseModel, Field

EventType = Literal[
    "page_view",
    "custom_event",
    "frontend_error",
    "backend_error",
    "api_request",
    "session_start",
    "session_end",
    "job_started",
    "job_completed",
    "job_failed",
    "webhook_delivery",
]


class BaseEventIn(BaseModel):
    event_type: EventType
    event_name: str | None = Field(default=None, max_length=200)
    user_id: str | None = Field(default=None, max_length=200)
    anonymous_id: str | None = Field(default=None, max_length=200)
    session_id: str | None = Field(default=None, max_length=200)
    trace_id: str | None = Field(default=None, max_length=200)
    properties: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime | None = None
    environment: str = Field(default="production", max_length=50)


class ErrorEventIn(BaseModel):
    error_type: str = Field(max_length=100)
    message: str = Field(min_length=1)
    stack_trace: str | None = None
    source: Literal["frontend", "backend"] = "frontend"
    user_id: str | None = None
    session_id: str | None = None
    trace_id: str | None = None
    properties: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime | None = None


class ApiRequestEventIn(BaseModel):
    method: str = Field(max_length=12)
    path: str = Field(min_length=1, max_length=500)
    status_code: int = Field(ge=100, le=599)
    duration_ms: int = Field(ge=0)
    user_id: str | None = None
    session_id: str | None = None
    trace_id: str | None = None
    properties: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime | None = None


class SessionEventIn(BaseModel):
    session_id: str = Field(min_length=1, max_length=200)
    action: Literal["start", "end"]
    user_id: str | None = None
    anonymous_id: str | None = None
    properties: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime | None = None


class JobEventIn(BaseModel):
    job_name: str = Field(min_length=1, max_length=200)
    status: Literal["started", "completed", "failed"]
    duration_ms: int | None = Field(default=None, ge=0)
    error_message: str | None = None
    trace_id: str | None = None
    properties: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime | None = None


class WebhookEventIn(BaseModel):
    webhook_name: str = Field(min_length=1, max_length=200)
    target_url: AnyUrl
    status_code: int | None = Field(default=None, ge=100, le=599)
    is_success: bool
    duration_ms: int | None = Field(default=None, ge=0)
    error_message: str | None = None
    trace_id: str | None = None
    properties: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime | None = None


class EventOut(BaseModel):
    id: str
    project_id: str
    event_type: str
    event_name: str | None
    user_id: str | None
    anonymous_id: str | None
    session_id: str | None
    trace_id: str | None
    properties: dict[str, Any]
    timestamp: datetime
    environment: str

    model_config = {"from_attributes": True}
