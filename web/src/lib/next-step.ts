import { formatINR } from "./money";
import { formatIST } from "./time";
import type { Application, AppStatus } from "./types";

export type Step =
  | { kind: "action"; label: string }
  | { kind: "waiting"; label: string }
  | { kind: "done"; label: string; tone: "good" | "bad" };

export const STATUS_LABEL: Record<AppStatus, string> = {
  applied: "Applied", approved: "Approved", declined: "Declined", withdrawn: "Withdrew",
  expired: "Deadline missed", submitted: "Post submitted", revision_requested: "Changes requested",
  paid: "Paid", rejected: "Post rejected",
};

export function creatorNextStep(a: Application): Step {
  switch (a.status) {
    case "applied": return { kind: "waiting", label: "Waiting for the brand to decide" };
    case "approved": return { kind: "action", label: `Submit post link by ${formatIST(a.campaign.submit_deadline)}` };
    case "submitted": return { kind: "waiting", label: "Your post is in review" };
    case "revision_requested": return { kind: "action", label: "Resubmit your post" };
    case "paid": return { kind: "done", label: `Paid ${formatINR(a.payout!.fee_paise)}`, tone: "good" };
    case "rejected": return { kind: "done", label: "Post rejected", tone: "bad" };
    case "declined": return { kind: "done", label: "Not selected", tone: "bad" };
    case "withdrawn": return { kind: "done", label: "You withdrew", tone: "bad" };
    case "expired": return { kind: "done", label: "Deadline missed", tone: "bad" };
  }
}

export function brandNextStep(a: Application): Step {
  switch (a.status) {
    case "applied": return { kind: "action", label: "Approve or decline" };
    case "approved": return { kind: "waiting", label: `Post due ${formatIST(a.campaign.submit_deadline)}` };
    case "submitted": return { kind: "action", label: "Review post" };
    case "revision_requested": return { kind: "waiting", label: "Waiting for the revised post" };
    case "paid": return { kind: "done", label: "Paid", tone: "good" };
    default: return { kind: "done", label: STATUS_LABEL[a.status], tone: "bad" };
  }
}
