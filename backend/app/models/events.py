from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class Event(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "events"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(60), index=True, nullable=False)
    event_name: Mapped[str | None] = mapped_column(String(200), index=True)
    user_id: Mapped[str | None] = mapped_column(String(200), index=True)
    anonymous_id: Mapped[str | None] = mapped_column(String(200), index=True)
    session_id: Mapped[str | None] = mapped_column(String(200), index=True)
    trace_id: Mapped[str | None] = mapped_column(String(200), index=True)
    properties: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    environment: Mapped[str] = mapped_column(String(50), default="production", nullable=False)


class ErrorEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "error_events"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    event_id: Mapped[str | None] = mapped_column(ForeignKey("events.id", ondelete="SET NULL"))
    error_type: Mapped[str] = mapped_column(String(100), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    stack_trace: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(50), default="frontend", nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(200), index=True)
    session_id: Mapped[str | None] = mapped_column(String(200), index=True)
    trace_id: Mapped[str | None] = mapped_column(String(200), index=True)
    properties: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ApiRequestEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "api_request_events"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    method: Mapped[str] = mapped_column(String(12), nullable=False)
    path: Mapped[str] = mapped_column(String(500), index=True, nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(200), index=True)
    session_id: Mapped[str | None] = mapped_column(String(200), index=True)
    trace_id: Mapped[str | None] = mapped_column(String(200), index=True)
    properties: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SessionEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "session_events"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    session_id: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(200), index=True)
    anonymous_id: Mapped[str | None] = mapped_column(String(200), index=True)
    action: Mapped[str] = mapped_column(String(30), nullable=False)
    properties: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class JobEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "job_events"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    job_name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(30), index=True, nullable=False)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)
    trace_id: Mapped[str | None] = mapped_column(String(200), index=True)
    properties: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class WebhookEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "webhook_events"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    webhook_name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    target_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    status_code: Mapped[int | None] = mapped_column(Integer)
    is_success: Mapped[bool] = mapped_column(index=True, nullable=False)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)
    trace_id: Mapped[str | None] = mapped_column(String(200), index=True)
    properties: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
