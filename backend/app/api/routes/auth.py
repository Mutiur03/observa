from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.rate_limit import rate_limit_auth
from app.db.session import get_db
from app.models.auth import User
from app.schemas.auth import AuthSessionResponse, UserLogin, UserOut, UserRegister
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def set_auth_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        domain=settings.auth_cookie_domain,
        path="/",
    )


@router.post("/register", response_model=AuthSessionResponse)
def register(payload: UserRegister, request: Request, response: Response, db: Session = Depends(get_db)):
    rate_limit_auth(request, "register")
    token = AuthService(db).register(payload)
    set_auth_cookie(response, token.access_token)
    return AuthSessionResponse(user=token.user)


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: UserLogin, request: Request, response: Response, db: Session = Depends(get_db)):
    rate_limit_auth(request, "login")
    token = AuthService(db).login(payload)
    set_auth_cookie(response, token.access_token)
    return AuthSessionResponse(user=token.user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    settings = get_settings()
    response.delete_cookie(
        key=settings.auth_cookie_name,
        path="/",
        domain=settings.auth_cookie_domain,
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
