from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import create_token, current_user
from app.db import get_db
from app.models import User
from app.schemas import AuthOut, LoginIn, MeUpdate, SignupIn, UserOut
from app.services import users

router = APIRouter(tags=["auth"])


def _auth_out(user: User) -> AuthOut:
    return AuthOut(token=create_token(user), user=UserOut.model_validate(user))


@router.post("/auth/signup", response_model=AuthOut, status_code=201)
def signup(data: SignupIn, db: Session = Depends(get_db)):
    return _auth_out(users.signup(db, data))


@router.post("/auth/login", response_model=AuthOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    return _auth_out(users.authenticate(db, data.email, data.password))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
def update_me(data: MeUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return UserOut.model_validate(users.update_me(db, user, data))
