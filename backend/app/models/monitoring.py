from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Monitor(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "monitors"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    method: Mapped[str] = mapped_column(String(12), default="GET", nullable=False)
    expected_status: Mapped[int] = mapped_column(Integer, default=200, nullable=False)
    interval_seconds: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    checks = relationship("MonitorCheck", back_populates="monitor", cascade="all, delete-orphan")


class MonitorCheck(Base, UUIDMixin):
    __tablename__ = "monitor_checks"

    monitor_id: Mapped[str] = mapped_column(ForeignKey("monitors.id", ondelete="CASCADE"), index=True, nullable=False)
    status_code: Mapped[int | None] = mapped_column(Integer)
    response_time_ms: Mapped[int | None] = mapped_column(Integer)
    is_success: Mapped[bool] = mapped_column(Boolean, index=True, nullable=False)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    error_message: Mapped[str | None] = mapped_column(Text)

    monitor = relationship("Monitor", back_populates="checks")


class AlertRule(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "alert_rules"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    rule_type: Mapped[str] = mapped_column(String(60), index=True, nullable=False)
    threshold: Mapped[int | None] = mapped_column(Integer)
    window_seconds: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notification_config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
