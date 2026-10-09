from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import brand_only, creator_only
from app.clock import utcnow
from app.db import get_db
from app.models import User
from app.presenters import application_out
from app.schemas import ApplicationOut, DeclineIn
from app.services import applications

router = APIRouter(prefix="/applications", tags=["applications"])


@router.get("/mine", response_model=list[ApplicationOut])
def mine(creator: User = Depends(creator_only), db: Session = Depends(get_db)):
    return [application_out(a) for a in applications.list_for_creator(db, creator)]


@router.post("/{application_id}/approve", response_model=ApplicationOut)
def approve(application_id: int, brand: User = Depends(brand_only), db: Session = Depends(get_db)):
    return application_out(applications.approve(db, brand, application_id, utcnow()))


@router.post("/{application_id}/decline", response_model=ApplicationOut)
def decline(application_id: int, data: DeclineIn, brand: User = Depends(brand_only), db: Session = Depends(get_db)):
    return application_out(applications.decline(db, brand, application_id, data.reason, utcnow()))


@router.post("/{application_id}/withdraw", response_model=ApplicationOut)
def withdraw(application_id: int, creator: User = Depends(creator_only), db: Session = Depends(get_db)):
    return application_out(applications.withdraw(db, creator, application_id, utcnow()))
