# api/app

Public functions and classes. Private helpers (names starting with `_`) are
omitted. Routes are the decorator path next to the function.

```
app/
  __init__.py
  main.py
    handle_domain_error(request: Request, exc: DomainError) -> JSONResponse
    health()                                          GET /health
    app: FastAPI
  worker.py
    run_once(now: datetime | None = None) -> None
    main() -> None
  seed.py
    main() -> None
    PASSWORD
  clock.py
    utcnow() -> datetime
  config.py
    class Settings(BaseSettings)
      use_psycopg_driver(cls, url: str | None) -> str | None
    settings: Settings
  db.py
    class Base(DeclarativeBase)
    engine, SessionLocal
    get_db()
  errors.py
    class DomainError(Exception)
      __init__(self, message: str, status_code: int = 409)
  auth.py
    hash_password(password: str) -> str
    verify_password(password: str, password_hash: str) -> bool
    create_token(user: User) -> str
    current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User
    require_role(role: str)   # returns a FastAPI dependency
    brand_only, creator_only
  presenters.py
    campaign_out(db: Session, c: Campaign, now: datetime, viewer: User) -> CampaignOut
    application_out(app: Application) -> ApplicationOut
    wallet_out(db: Session, creator: User) -> WalletOut
  models.py
    class User                table users
    class Wallet              table wallets
    class Campaign            table campaigns
    class Application         table applications
    class ApplicationEvent    table application_events
    class Submission          table submissions
    class Payout              table payouts
    class Withdrawal          table withdrawals
    class LedgerEntry         table ledger_entries
    class Notification        table notifications
  schemas.py
    class FromORM(BaseModel)
    class SignupIn, LoginIn, UserOut, AuthOut, MeUpdate
    class CampaignIn, CampaignEdit, CampaignCounts, MyApplication, CampaignOut
    class ApplyIn, DeclineIn, SubmitIn, ReviewIn
    class CampaignSummary, CreatorSummary, SubmissionOut, EventOut, PayoutOut, ApplicationOut
    class WithdrawIn, WithdrawalOut, LedgerOut, WalletOut
    class NotificationOut
  domain/
    __init__.py
    money.py
      class PayoutBreakdown
      payout_breakdown(fee_paise: int) -> PayoutBreakdown
      format_inr(paise: int) -> str
    ist.py
      is_quiet(now: datetime) -> bool
      next_send_at(now: datetime) -> datetime
      format_ist(moment: datetime) -> str
    states.py
      MAX_REVISIONS, TRANSITIONS
      check_transition(current: str, target: str) -> None
  mocks/
    __init__.py
    instagram.py
      class PostLookup
      lookup_post(shortcode: str) -> PostLookup
    messaging.py
      send_email(user: User, body: str) -> None
      send_whatsapp(user: User, body: str) -> None
      SENDERS
    payouts.py
      class TransferResult
      class MockPayoutProvider
        transfer(self, upi_id: str, amount_paise: int, reference: str) -> TransferResult
  routers/
    __init__.py
    auth.py
      signup(data: SignupIn, db: Session = Depends(get_db))                         POST /auth/signup
      login(data: LoginIn, db: Session = Depends(get_db))                           POST /auth/login
      me(user: User = Depends(current_user))                                        GET /me
      update_me(data: MeUpdate, user: User = Depends(current_user), db: Session = Depends(get_db))
                                                                                     PATCH /me
    campaigns.py
      create(data: CampaignIn, brand: User = Depends(brand_only), db: Session = Depends(get_db))
                                                                                     POST /campaigns
      mine(brand: User = Depends(brand_only), db: Session = Depends(get_db))        GET /campaigns/mine
      open_campaigns(creator: User = Depends(creator_only), db: Session = Depends(get_db))
                                                                                     GET /campaigns
      get_one(campaign_id: int, user: User = Depends(current_user), db: Session = Depends(get_db))
                                                                                     GET /campaigns/{id}
      edit(campaign_id: int, data: CampaignEdit, brand: User = Depends(brand_only), db: Session = Depends(get_db))
                                                                                     PATCH /campaigns/{id}
      cancel(campaign_id: int, brand: User = Depends(brand_only), db: Session = Depends(get_db))
                                                                                     POST /campaigns/{id}/cancel
      campaign_applications(campaign_id: int, brand: User = Depends(brand_only), db: Session = Depends(get_db))
                                                                                     GET /campaigns/{id}/applications
      apply(campaign_id: int, data: ApplyIn, creator: User = Depends(creator_only), db: Session = Depends(get_db))
                                                                                     POST /campaigns/{id}/apply
    applications.py
      mine(creator: User = Depends(creator_only), db: Session = Depends(get_db))    GET /applications/mine
      approve(application_id: int, brand: User = Depends(brand_only), db: Session = Depends(get_db))
                                                                                     POST /applications/{id}/approve
      decline(application_id: int, data: DeclineIn, brand: User = Depends(brand_only), db: Session = Depends(get_db))
                                                                                     POST /applications/{id}/decline
      withdraw(application_id: int, creator: User = Depends(creator_only), db: Session = Depends(get_db))
                                                                                     POST /applications/{id}/withdraw
      submit(application_id: int, data: SubmitIn, creator: User = Depends(creator_only), db: Session = Depends(get_db))
                                                                                     POST /applications/{id}/submissions
      review(application_id: int, data: ReviewIn, brand: User = Depends(brand_only), db: Session = Depends(get_db))
                                                                                     POST /applications/{id}/review
    wallet.py
      get_wallet(creator: User = Depends(creator_only), db: Session = Depends(get_db))
                                                                                     GET /wallet
      withdraw(data: WithdrawIn, creator: User = Depends(creator_only), db: Session = Depends(get_db))
                                                                                     POST /wallet/withdrawals
    notifications.py
      my_notifications(user: User = Depends(current_user), db: Session = Depends(get_db))
                                                                                     GET /notifications
  services/
    __init__.py
    users.py
      signup(db: Session, data: SignupIn) -> User
      authenticate(db: Session, email: str, password: str) -> User
      update_me(db: Session, user: User, data: MeUpdate) -> User
    campaigns.py
      accepting_applications(c: Campaign, now: datetime) -> bool
      create_campaign(db: Session, brand: User, data: CampaignIn, now: datetime) -> Campaign
      edit_campaign(db: Session, brand: User, campaign_id: int, data: CampaignEdit, now: datetime) -> Campaign
      cancel_campaign(db: Session, brand: User, campaign_id: int, now: datetime) -> Campaign
      get_for_viewer(db: Session, viewer: User, campaign_id: int) -> Campaign
      list_open(db: Session, now: datetime) -> list[Campaign]
      list_for_brand(db: Session, brand: User) -> list[Campaign]
    applications.py
      lock_campaign(db: Session, campaign_id: int) -> Campaign | None
      lock_application(db: Session, application_id: int) -> Application
      ensure_brand(app: Application, brand: User) -> None
      ensure_creator(app: Application, creator: User) -> None
      apply(db: Session, creator: User, campaign_id: int, note: str | None, now: datetime) -> Application
      approve(db: Session, brand: User, application_id: int, now: datetime) -> Application
      decline(db: Session, brand: User, application_id: int, reason: str | None, now: datetime) -> Application
      withdraw(db: Session, creator: User, application_id: int, now: datetime) -> Application
      list_for_creator(db: Session, creator: User) -> list[Application]
      list_for_campaign(db: Session, brand: User, campaign_id: int) -> list[Application]
    submissions.py
      submit(db: Session, creator: User, application_id: int, url: str, now: datetime) -> Application
      review(db: Session, brand: User, application_id: int, action: str, note: str | None, now: datetime) -> Application
    slots.py
      reserve_slot(db: Session, app: Application) -> None
      release_slot(db: Session, app: Application) -> None
      mark_spent(db: Session, app: Application) -> None
    transitions.py
      move(db: Session, app: Application, target: str, now: datetime, note: str | None = None) -> None
      record(db: Session, app: Application, previous: str | None, now: datetime, note: str | None = None) -> None
      messages(app: Application, note: str | None) -> list[tuple[int, str]]
    wallet.py
      credit(db: Session, user_id: int, amount_paise: int, kind: str, now: datetime, payout_id: int | None = None, withdrawal_id: int | None = None) -> int
      request_withdrawal(db: Session, creator: User, amount_paise: int, upi_id: str | None, now: datetime) -> Withdrawal
      process_withdrawals(db: Session, provider: MockPayoutProvider, now: datetime, limit: int = 10) -> int
    notify.py
      enqueue(db: Session, user_id: int, event: str, body: str, now: datetime) -> None
      send_due_notifications(db: Session, now: datetime, limit: int = 50) -> int
    deadlines.py
      expire_missed_deadlines(db: Session, now: datetime) -> int
```

<!-- mapped: .@09f5afd paths: api/app,api/tests -->
