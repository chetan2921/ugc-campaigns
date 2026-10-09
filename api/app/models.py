from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('brand', 'creator')", name="role_valid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(10))
    phone: Mapped[str | None] = mapped_column(String(20))
    instagram_handle: Mapped[str | None] = mapped_column(String(30))
    upi_id: Mapped[str | None] = mapped_column(String(100))
    email_opt_in: Mapped[bool] = mapped_column(default=True)
    whatsapp_opt_in: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Wallet(Base):
    __tablename__ = "wallets"
    __table_args__ = (CheckConstraint("balance_paise >= 0", name="balance_never_negative"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    balance_paise: Mapped[int] = mapped_column(BigInteger, default=0)


class Campaign(Base):
    __tablename__ = "campaigns"
    __table_args__ = (
        CheckConstraint("fee_paise > 0", name="fee_positive"),
        CheckConstraint("slots > 0", name="slots_positive"),
        CheckConstraint("filled_slots >= 0 AND filled_slots <= slots", name="filled_within_slots"),
        CheckConstraint("reserved_paise >= 0 AND spent_paise >= 0", name="money_non_negative"),
        CheckConstraint("reserved_paise + spent_paise <= budget_paise", name="within_budget"),
        CheckConstraint("apply_deadline < submit_deadline", name="deadlines_ordered"),
        CheckConstraint("status IN ('active', 'cancelled')", name="status_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    budget_paise: Mapped[int] = mapped_column(BigInteger)
    fee_paise: Mapped[int] = mapped_column(BigInteger)
    slots: Mapped[int]
    apply_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    submit_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(10), default="active")
    filled_slots: Mapped[int] = mapped_column(default=0)
    reserved_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    spent_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    brand: Mapped[User] = relationship()


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("campaign_id", "creator_id"),
        CheckConstraint("revision_count BETWEEN 0 AND 2", name="revisions_capped"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id"))
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), default="applied")
    note: Mapped[str | None] = mapped_column(Text)
    fee_paise: Mapped[int | None] = mapped_column(BigInteger)  # agreed fee, set on approval
    revision_count: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    campaign: Mapped[Campaign] = relationship()
    creator: Mapped[User] = relationship()
    submissions: Mapped[list[Submission]] = relationship(order_by="Submission.version")
    events: Mapped[list[ApplicationEvent]] = relationship(order_by="ApplicationEvent.id")
    payout: Mapped[Payout | None] = relationship(back_populates="application")


class ApplicationEvent(Base):
    __tablename__ = "application_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"))
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"))
    url: Mapped[str] = mapped_column(String(300))
    version: Mapped[int]
    caption: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Payout(Base):
    __tablename__ = "payouts"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), unique=True)  # one payout per application, ever
    fee_paise: Mapped[int] = mapped_column(BigInteger)
    platform_fee_paise: Mapped[int] = mapped_column(BigInteger)
    gst_paise: Mapped[int] = mapped_column(BigInteger)
    tds_paise: Mapped[int] = mapped_column(BigInteger)
    net_paise: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application: Mapped[Application] = relationship(back_populates="payout")


class Withdrawal(Base):
    __tablename__ = "withdrawals"
    __table_args__ = (
        CheckConstraint("amount_paise > 0", name="amount_positive"),
        CheckConstraint("status IN ('processing', 'succeeded', 'failed')", name="status_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    upi_id: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(12), default="processing")
    failure_reason: Mapped[str | None] = mapped_column(String(200))
    provider_ref: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    __table_args__ = (CheckConstraint("kind IN ('payout', 'withdrawal', 'refund')", name="kind_valid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(12))
    amount_paise: Mapped[int] = mapped_column(BigInteger)  # signed: + credit, - debit
    balance_after_paise: Mapped[int] = mapped_column(BigInteger)
    payout_id: Mapped[int | None] = mapped_column(ForeignKey("payouts.id"))
    withdrawal_id: Mapped[int | None] = mapped_column(ForeignKey("withdrawals.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    payout: Mapped[Payout | None] = relationship()


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint("channel IN ('email', 'whatsapp')", name="channel_valid"),
        CheckConstraint("status IN ('queued', 'sent', 'skipped')", name="status_valid"),
        Index("ix_notifications_due", "status", "send_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    channel: Mapped[str] = mapped_column(String(10))
    event: Mapped[str] = mapped_column(String(40))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), default="queued")
    skip_reason: Mapped[str | None] = mapped_column(String(100))
    send_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
