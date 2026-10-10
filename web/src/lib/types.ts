export type Role = "brand" | "creator";

export type AppStatus =
  | "applied"
  | "approved"
  | "declined"
  | "withdrawn"
  | "expired"
  | "submitted"
  | "revision_requested"
  | "paid"
  | "rejected";

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  instagram_handle: string | null;
  upi_id: string | null;
  email_opt_in: boolean;
  whatsapp_opt_in: boolean;
};

export type AuthOut = {
  token: string;
  user: User;
};

export type Campaign = {
  id: number;
  brand_name: string;
  title: string;
  description: string;
  budget_paise: number;
  fee_paise: number;
  slots: number;
  filled_slots: number;
  reserved_paise: number;
  spent_paise: number;
  apply_deadline: string;
  submit_deadline: string;
  status: "active" | "cancelled";
  accepting_applications: boolean;
  counts: { applied: number; to_review: number } | null;
  my_application: { id: number; status: AppStatus } | null;
};

export type Payout = {
  fee_paise: number;
  platform_fee_paise: number;
  gst_paise: number;
  tds_paise: number;
  net_paise: number;
};

export type Submission = {
  id: number;
  url: string;
  version: number;
  caption: string | null;
  created_at: string;
};

export type AppEvent = {
  from_status: AppStatus | null;
  to_status: AppStatus;
  note: string | null;
  created_at: string;
};

export type Application = {
  id: number;
  status: AppStatus;
  note: string | null;
  fee_paise: number;
  revision_count: number;
  revisions_left: number;
  created_at: string;
  campaign: {
    id: number;
    title: string;
    brand_name: string;
    fee_paise: number;
    apply_deadline: string;
    submit_deadline: string;
    status: "active" | "cancelled";
  };
  creator: {
    id: number;
    name: string;
    instagram_handle: string | null;
  };
  submissions: Submission[];
  events: AppEvent[];
  payout: Payout | null;
};

export type Withdrawal = {
  id: number;
  amount_paise: number;
  upi_id: string;
  status: "processing" | "succeeded" | "failed";
  failure_reason: string | null;
  created_at: string;
  processed_at: string | null;
};

export type LedgerEntry = {
  id: number;
  kind: "payout" | "withdrawal" | "refund";
  amount_paise: number;
  balance_after_paise: number;
  created_at: string;
  campaign_title: string | null;
  payout: Payout | null;
  withdrawal_id: number | null;
};

export type Wallet = {
  balance_paise: number;
  upi_id: string | null;
  entries: LedgerEntry[];
  withdrawals: Withdrawal[];
};

export type Notification = {
  id: number;
  channel: "email" | "whatsapp";
  event: string;
  body: string;
  status: "queued" | "sent" | "skipped";
  skip_reason: string | null;
  send_at: string;
  sent_at: string | null;
  created_at: string;
};
