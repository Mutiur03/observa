from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.monitoring import AlertRule, Monitor, MonitorCheck


class MonitorRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: dict) -> Monitor:
        monitor = Monitor(**data)
        self.db.add(monitor)
        self.db.commit()
        self.db.refresh(monitor)
        return monitor

    def get(self, monitor_id: str) -> Monitor | None:
        return self.db.get(Monitor, monitor_id)

    def list_for_project(self, project_id: str) -> list[Monitor]:
        return list(self.db.scalars(select(Monitor).where(Monitor.project_id == project_id)))

    def delete(self, monitor: Monitor) -> None:
        self.db.delete(monitor)
        self.db.commit()

    def add_check(self, data: dict) -> MonitorCheck:
        check = MonitorCheck(**data)
        self.db.add(check)
        self.db.commit()
        self.db.refresh(check)
        return check


class AlertRuleRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: dict) -> AlertRule:
        rule = AlertRule(**data)
        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def list_for_project(self, project_id: str) -> list[AlertRule]:
        return list(self.db.scalars(select(AlertRule).where(AlertRule.project_id == project_id)))

    def get(self, rule_id: str) -> AlertRule | None:
        return self.db.get(AlertRule, rule_id)

    def delete(self, rule: AlertRule) -> None:
        self.db.delete(rule)
        self.db.commit()
