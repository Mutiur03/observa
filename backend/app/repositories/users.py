from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.auth import User


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email.lower()))

    def get(self, user_id: str) -> User | None:
        return self.db.get(User, user_id)

    def create(self, email: str, password_hash: str, full_name: str | None) -> User:
        user = User(email=email.lower(), password_hash=password_hash, full_name=full_name)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
