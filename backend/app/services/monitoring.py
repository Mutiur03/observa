import time

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.monitoring import AlertRuleRepository, MonitorRepository
from app.schemas.monitoring import AlertRuleCreate, MonitorCreate
from app.services.authorization import AuthorizationService


class MonitorService:
    def __init__(self, db: Session):
        self.authz = AuthorizationService(db)
        self.monitors = MonitorRepository(db)

    def create(self, payload: MonitorCreate, user):
        self.authz.require_project_role(payload.project_id, user, "admin")
        data = payload.model_dump()
        data["url"] = str(payload.url)
        data["method"] = payload.method.upper()
        return self.monitors.create(data)

    def list_for_project(self, project_id: str, user):
        self.authz.require_project_role(project_id, user, "viewer")
        return self.monitors.list_for_project(project_id)

    def delete(self, monitor_id: str, user) -> None:
        monitor = self.monitors.get(monitor_id)
        if not monitor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitor not found")
        self.authz.require_project_role(monitor.project_id, user, "admin")
        self.monitors.delete(monitor)

    def check_now(self, monitor_id: str, user):
        monitor = self.monitors.get(monitor_id)
        if not monitor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitor not found")
        self.authz.require_project_role(monitor.project_id, user, "member")
        started = time.perf_counter()
        try:
            response = httpx.request(monitor.method, monitor.url, timeout=monitor.timeout_seconds)
            elapsed = int((time.perf_counter() - started) * 1000)
            return self.monitors.add_check(
                {
                    "monitor_id": monitor.id,
                    "status_code": response.status_code,
                    "response_time_ms": elapsed,
                    "is_success": response.status_code == monitor.expected_status,
                }
            )
        except httpx.HTTPError as exc:
            elapsed = int((time.perf_counter() - started) * 1000)
            return self.monitors.add_check(
                {
                    "monitor_id": monitor.id,
                    "response_time_ms": elapsed,
                    "is_success": False,
                    "error_message": str(exc),
                }
            )


class AlertRuleService:
    def __init__(self, db: Session):
        self.authz = AuthorizationService(db)
        self.rules = AlertRuleRepository(db)

    def create(self, payload: AlertRuleCreate, user):
        self.authz.require_project_role(payload.project_id, user, "admin")
        return self.rules.create({**payload.model_dump(), "notification_config": {}})

    def list_for_project(self, project_id: str, user):
        self.authz.require_project_role(project_id, user, "viewer")
        return self.rules.list_for_project(project_id)

    def delete(self, rule_id: str, user) -> None:
        rule = self.rules.get(rule_id)
        if not rule:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found")
        self.authz.require_project_role(rule.project_id, user, "admin")
        self.rules.delete(rule)
