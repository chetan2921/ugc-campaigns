import { formatINR } from "@/lib/money";
import type { Campaign } from "@/lib/types";

export function slotMeterLabel(campaign: Campaign): string {
  const free = Math.max(0, campaign.budget_paise - campaign.reserved_paise - campaign.spent_paise);
  const freeWord = campaign.status === "cancelled" ? "released" : "free";
  return `Slots ${campaign.filled_slots} of ${campaign.slots} · ${formatINR(campaign.reserved_paise)} reserved · ${formatINR(campaign.spent_paise)} paid · ${formatINR(free)} ${freeWord}`;
}

export function SlotMeter({ campaign, compact = false }: { campaign: Campaign; compact?: boolean }) {
  const label = slotMeterLabel(campaign);
  const budget = campaign.budget_paise || 1;
  const spent = Math.max(0, campaign.spent_paise);
  const reserved = Math.max(0, campaign.reserved_paise);
  return (
    <div className={compact ? "min-w-0" : undefined}>
      <p className={compact ? "text-xs text-muted-foreground" : "text-sm"}>{label}</p>
      <div className={compact ? "mt-1 flex h-1.5 overflow-hidden rounded-sm bg-border" : "mt-2 flex h-2 overflow-hidden rounded-sm bg-border"} aria-hidden="true">
        <div className="h-full bg-primary" style={{ width: `${(spent / budget) * 100}%` }} />
        <div
          className="h-full bg-[color-mix(in_oklch,var(--primary)_55%,var(--background))]"
          style={{ width: `${(reserved / budget) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function CampaignStatus({ status }: { status: Campaign["status"] }) {
  const cancelled = status === "cancelled";
  return <span className={cancelled ? "status-pill status-pill-bad" : "status-pill"}>{cancelled ? "Cancelled" : "Active"}</span>;
}
