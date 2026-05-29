from datetime import datetime

from pydantic import AnyUrl, BaseModel, Field


class MonitorCreate(BaseModel):
    project_id: str
    name: str = Field(min_length=2, max_length=200)
    url: AnyUrl
    method: str = Field(default="GET", max_length=12)
    expected_status: int = Field(default=200, ge=100, le=599)
    interval_seconds: int = Field(default=60, ge=30)
    timeout_seconds: int = Field(default=5, ge=1, le=30)
    is_active: bool = True


class MonitorOut(BaseModel):
    id: str
    project_id: str
    name: str
    url: str
    method: str
    expected_status: int
    interval_seconds: int
    timeout_seconds: int
    is_active: bool

    model_config = {"from_attributes": True}


class MonitorCheckOut(BaseModel):
    id: str
    monitor_id: str
    status_code: int | None
    response_time_ms: int | None
    is_success: bool
    checked_at: datetime
    error_message: str | None

    model_config = {"from_attributes": True}


class AlertRuleCreate(BaseModel):
    project_id: str
    name: str = Field(min_length=2, max_length=200)
    rule_type: str = Field(pattern=r"^(error_threshold|monitor_down|slow_endpoint|failed_job|failed_webhook)$")
    threshold: int | None = Field(default=None, ge=1)
    window_seconds: int | None = Field(default=300, ge=60)
    is_active: bool = True


class AlertRuleOut(AlertRuleCreate):
    id: str

    model_config = {"from_attributes": True}
