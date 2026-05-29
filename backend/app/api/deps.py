from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.core.rate_limit import rate_limit_ingestion
from app.core.config import get_settings
from app.db.session import get_db
from app.models.auth import User
from app.repositories.users import UserRepository
from app.services.ingestion import IngestionService

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials if credentials else request.cookies.get(get_settings().auth_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing auth token")
    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = UserRepository(db).get(user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
    return user


def get_project_id_from_api_key(
    request: Request,
    x_observa_key: str | None = Header(default=None, alias="X-Observa-Key"),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> str:
    api_key = x_observa_key
    if not api_key and authorization and authorization.lower().startswith("bearer "):
        api_key = authorization.split(" ", 1)[1]
    if not api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing API key")
    rate_limit_ingestion(request, api_key)
    return IngestionService(db).resolve_project_id(api_key)
