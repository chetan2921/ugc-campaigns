import { STATUS_LABEL } from "@/lib/next-step";
import type { AppStatus } from "@/lib/types";

const TONE: Record<AppStatus, "good" | "bad" | "neutral"> = {
  applied: "neutral",
  approved: "neutral",
  declined: "bad",
  withdrawn: "bad",
  expired: "bad",
  submitted: "neutral",
  revision_requested: "neutral",
  paid: "good",
  rejected: "bad",
};

export function StatusPill({ status }: { status: AppStatus }) {
  return <span className={`status-pill status-pill-${TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}
