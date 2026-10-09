# api-surface

The seam between `api/` (FastAPI) and `web/` (Next.js), and any future Flutter
client. Read this before changing either side, and update it when a side moves.

## Conventions

- **JSON only.** Auth is a `Authorization: Bearer <jwt>` header on every
  endpoint except `/auth/*` and `/health`.
- **Money** is integer paise in every field ending in `_paise`. Clients format
  rupees.
- **Timestamps** are ISO 8601 with an offset. The API returns UTC; clients
  display them in IST.
- **Errors** have the shape `{"detail": "<human sentence>"}`. Pydantic
  validation errors (422) have the shape `{"detail": [{"loc": [...], "msg":
  "..."}]}`, and the client shows the first `msg`.
- **Status codes:**
  - 401: not logged in or bad token
  - 403: wrong role
  - 404: not found or not yours
  - 409: business rule refused
  - 422: invalid input

## Endpoints

| Method | Path | Role | Body | Returns |
|---|---|---|---|---|
| POST | /auth/signup | — | SignupIn | 201 AuthOut |
| POST | /auth/login | — | LoginIn | AuthOut |
| GET | /me | any | — | UserOut |
| PATCH | /me | any | MeUpdate | UserOut |
| POST | /campaigns | brand | CampaignIn | 201 CampaignOut |
| GET | /campaigns/mine | brand | — | CampaignOut[] (with counts) |
| GET | /campaigns | creator | — | CampaignOut[] (accepting applications, with my_application) |
| GET | /campaigns/{id} | any | — | CampaignOut |
| PATCH | /campaigns/{id} | brand | CampaignEdit | CampaignOut |
| POST | /campaigns/{id}/cancel | brand | — | CampaignOut |
| GET | /campaigns/{id}/applications | brand | — | ApplicationOut[] |
| POST | /campaigns/{id}/apply | creator | ApplyIn | 201 ApplicationOut |
| GET | /applications/mine | creator | — | ApplicationOut[] |
| POST | /applications/{id}/approve | brand | — | ApplicationOut |
| POST | /applications/{id}/decline | brand | DeclineIn | ApplicationOut |
| POST | /applications/{id}/withdraw | creator | — | ApplicationOut |
| POST | /applications/{id}/submissions | creator | SubmitIn | ApplicationOut |
| POST | /applications/{id}/review | brand | ReviewIn | ApplicationOut |
| GET | /wallet | creator | — | WalletOut |
| POST | /wallet/withdrawals | creator | WithdrawIn | 201 WithdrawalOut |
| GET | /notifications | any | — | NotificationOut[] (newest first, max 200) |
| GET | /health | — | — | {"ok": true} |

## Shapes

```
SignupIn      { name, email, password (8-72), role: "brand"|"creator",
                phone?: "+919800000001", instagram_handle?: "asha.makes" }
LoginIn       { email, password }
AuthOut       { token, user: UserOut }
UserOut       { id, name, email, role, phone|null, instagram_handle|null,
                upi_id|null, email_opt_in, whatsapp_opt_in }
MeUpdate      { phone?, upi_id?, email_opt_in?, whatsapp_opt_in? }

CampaignIn    { title, description?, budget_paise, fee_paise, slots,
                apply_deadline, submit_deadline }
CampaignEdit  every CampaignIn field optional
CampaignOut   { id, brand_name, title, description, budget_paise, fee_paise,
                slots, filled_slots, reserved_paise, spent_paise,
                apply_deadline, submit_deadline, status: "active"|"cancelled",
                accepting_applications,
                counts: {applied, to_review} | null,          // brand only
                my_application: {id, status} | null }         // creator only

ApplyIn       { note? (<=500) }
DeclineIn     { reason? }
SubmitIn      { url }
ReviewIn      { action: "approve"|"revise"|"reject", note? }  // note required for revise/reject
ApplicationOut{ id, status, note|null, fee_paise, revision_count, revisions_left,
                created_at,
                campaign: { id, title, brand_name, fee_paise, apply_deadline,
                            submit_deadline, status },
                creator:  { id, name, instagram_handle },
                submissions: [{ id, url, version, caption|null, created_at }],
                events: [{ from_status|null, to_status, note|null, created_at }],
                payout: PayoutOut | null }
PayoutOut     { fee_paise, platform_fee_paise, gst_paise, tds_paise, net_paise }

WithdrawIn    { amount_paise, upi_id? }
WithdrawalOut { id, amount_paise, upi_id, status: "processing"|"succeeded"|"failed",
                failure_reason|null, created_at, processed_at|null }
WalletOut     { balance_paise, upi_id|null,
                entries: [{ id, kind: "payout"|"withdrawal"|"refund", amount_paise,
                            balance_after_paise, created_at, campaign_title|null,
                            payout: PayoutOut|null, withdrawal_id|null }],
                withdrawals: WithdrawalOut[] }
NotificationOut { id, channel: "email"|"whatsapp", event, body,
                  status: "queued"|"sent"|"skipped", skip_reason|null,
                  send_at, sent_at|null, created_at }
```

Application statuses: `applied, approved, declined, withdrawn, expired,
submitted, revision_requested, paid, rejected`.

<!-- intent: written from SPEC.md before any code; stamp it with the api sha once Task 8 lands -->
