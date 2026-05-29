from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.auth import User
from app.schemas.monitoring import AlertRuleCreate, AlertRuleOut, MonitorCheckOut, MonitorCreate, MonitorOut
from app.services.monitoring import AlertRuleService, MonitorService

router = APIRouter(tags=["monitoring", "alerts"])


@router.post("/monitors", response_model=MonitorOut)
def create_monitor(payload: MonitorCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ = user
    return MonitorService(db).create(payload)


@router.get("/monitors", response_model=list[MonitorOut])
def list_monitors(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ = user
    return MonitorService(db).list_for_project(project_id)


@router.delete("/monitors/{monitor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_monitor(monitor_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ = user
    MonitorService(db).delete(monitor_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/monitors/{monitor_id}/check", response_model=MonitorCheckOut)
def check_monitor(monitor_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ = user
    return MonitorService(db).check_now(monitor_id)


@router.post("/alerts", response_model=AlertRuleOut)
def create_alert(payload: AlertRuleCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ = user
    return AlertRuleService(db).create(payload)


@router.get("/alerts", response_model=list[AlertRuleOut])
def list_alerts(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ = user
    return AlertRuleService(db).list_for_project(project_id)
