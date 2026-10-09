from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import brand_only, creator_only, current_user
from app.clock import utcnow
from app.db import get_db
from app.models import User
from app.presenters import application_out, campaign_out
from app.schemas import ApplicationOut, ApplyIn, CampaignEdit, CampaignIn, CampaignOut
from app.services import applications, campaigns

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.post("", response_model=CampaignOut, status_code=201)
def create(data: CampaignIn, brand: User = Depends(brand_only), db: Session = Depends(get_db)):
    now = utcnow()
    return campaign_out(db, campaigns.create_campaign(db, brand, data, now), now, brand)


@router.get("/mine", response_model=list[CampaignOut])
def mine(brand: User = Depends(brand_only), db: Session = Depends(get_db)):
    now = utcnow()
    return [campaign_out(db, c, now, brand) for c in campaigns.list_for_brand(db, brand)]


@router.get("", response_model=list[CampaignOut])
def open_campaigns(creator: User = Depends(creator_only), db: Session = Depends(get_db)):
    now = utcnow()
    return [campaign_out(db, c, now, creator) for c in campaigns.list_open(db, now)]


@router.get("/{campaign_id}", response_model=CampaignOut)
def get_one(campaign_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return campaign_out(db, campaigns.get_for_viewer(db, user, campaign_id), utcnow(), user)


@router.patch("/{campaign_id}", response_model=CampaignOut)
def edit(campaign_id: int, data: CampaignEdit, brand: User = Depends(brand_only), db: Session = Depends(get_db)):
    now = utcnow()
    return campaign_out(db, campaigns.edit_campaign(db, brand, campaign_id, data, now), now, brand)


@router.post("/{campaign_id}/cancel", response_model=CampaignOut)
def cancel(campaign_id: int, brand: User = Depends(brand_only), db: Session = Depends(get_db)):
    now = utcnow()
    return campaign_out(db, campaigns.cancel_campaign(db, brand, campaign_id, now), now, brand)


@router.get("/{campaign_id}/applications", response_model=list[ApplicationOut])
def campaign_applications(campaign_id: int, brand: User = Depends(brand_only), db: Session = Depends(get_db)):
    return [application_out(a) for a in applications.list_for_campaign(db, brand, campaign_id)]


@router.post("/{campaign_id}/apply", response_model=ApplicationOut, status_code=201)
def apply(campaign_id: int, data: ApplyIn, creator: User = Depends(creator_only), db: Session = Depends(get_db)):
    return application_out(applications.apply(db, creator, campaign_id, data.note, utcnow()))
