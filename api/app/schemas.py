from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field

PHONE = r"^\+?[0-9]{10,15}$"
HANDLE = r"^@?[A-Za-z0-9._]{1,30}$"
UPI = r"^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$"


class FromORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- auth and profile ---
class SignupIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # bcrypt's limit
    role: Literal["brand", "creator"]
    phone: str | None = Field(default=None, pattern=PHONE)
    instagram_handle: str | None = Field(default=None, pattern=HANDLE)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(FromORM):
    id: int
    name: str
    email: str
    role: str
    phone: str | None
    instagram_handle: str | None
    upi_id: str | None
    email_opt_in: bool
    whatsapp_opt_in: bool


class AuthOut(BaseModel):
    token: str
    user: UserOut


class MeUpdate(BaseModel):
    phone: str | None = Field(default=None, pattern=PHONE)
    upi_id: str | None = Field(default=None, pattern=UPI)
    email_opt_in: bool | None = None
    whatsapp_opt_in: bool | None = None


# --- campaigns ---
class CampaignIn(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=4000)
    budget_paise: int = Field(gt=0)
    fee_paise: int = Field(gt=0)
    slots: int = Field(ge=1, le=1000)
    apply_deadline: AwareDatetime
    submit_deadline: AwareDatetime


class CampaignEdit(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=4000)
    budget_paise: int | None = Field(default=None, gt=0)
    fee_paise: int | None = Field(default=None, gt=0)
    slots: int | None = Field(default=None, ge=1, le=1000)
    apply_deadline: AwareDatetime | None = None
    submit_deadline: AwareDatetime | None = None


class CampaignCounts(BaseModel):
    applied: int
    to_review: int


class MyApplication(BaseModel):
    id: int
    status: str


class CampaignOut(BaseModel):
    id: int
    brand_name: str
    title: str
    description: str
    budget_paise: int
    fee_paise: int
    slots: int
    filled_slots: int
    reserved_paise: int
    spent_paise: int
    apply_deadline: datetime
    submit_deadline: datetime
    status: str
    accepting_applications: bool
    counts: CampaignCounts | None = None
    my_application: MyApplication | None = None


# --- applications ---
class ApplyIn(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class DeclineIn(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class SubmitIn(BaseModel):
    url: str = Field(min_length=1, max_length=300)


class ReviewIn(BaseModel):
    action: Literal["approve", "revise", "reject"]
    note: str | None = Field(default=None, max_length=1000)


class CampaignSummary(BaseModel):
    id: int
    title: str
    brand_name: str
    fee_paise: int
    apply_deadline: datetime
    submit_deadline: datetime
    status: str


class CreatorSummary(FromORM):
    id: int
    name: str
    instagram_handle: str | None


class SubmissionOut(FromORM):
    id: int
    url: str
    version: int
    caption: str | None
    created_at: datetime


class EventOut(FromORM):
    from_status: str | None
    to_status: str
    note: str | None
    created_at: datetime


class PayoutOut(FromORM):
    fee_paise: int
    platform_fee_paise: int
    gst_paise: int
    tds_paise: int
    net_paise: int


class ApplicationOut(BaseModel):
    id: int
    status: str
    note: str | None
    fee_paise: int
    revision_count: int
    revisions_left: int
    created_at: datetime
    campaign: CampaignSummary
    creator: CreatorSummary
    submissions: list[SubmissionOut]
    events: list[EventOut]
    payout: PayoutOut | None


# --- wallet ---
class WithdrawIn(BaseModel):
    amount_paise: int = Field(gt=0)
    upi_id: str | None = Field(default=None, pattern=UPI)


class WithdrawalOut(FromORM):
    id: int
    amount_paise: int
    upi_id: str
    status: str
    failure_reason: str | None
    created_at: datetime
    processed_at: datetime | None


class LedgerOut(BaseModel):
    id: int
    kind: str
    amount_paise: int
    balance_after_paise: int
    created_at: datetime
    campaign_title: str | None
    payout: PayoutOut | None
    withdrawal_id: int | None


class WalletOut(BaseModel):
    balance_paise: int
    upi_id: str | None
    entries: list[LedgerOut]
    withdrawals: list[WithdrawalOut]


# --- notifications ---
class NotificationOut(FromORM):
    id: int
    channel: str
    event: str
    body: str
    status: str
    skip_reason: str | None
    send_at: datetime
    sent_at: datetime | None
    created_at: datetime
