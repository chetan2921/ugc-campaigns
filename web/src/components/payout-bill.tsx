"use client";

import { FEE_NOTE } from "@/components/fee-note";
import { formatINR } from "@/lib/money";
import type { Payout } from "@/lib/types";

export function PayoutBill({ payout }: { payout: Payout }) {
  const lines: [string, number][] = [
    ["Campaign fee", payout.fee_paise],
    ["Platform fee (10%)", -payout.platform_fee_paise],
    ["GST on platform fee (18%)", -payout.gst_paise],
    ["TDS (1%)", -payout.tds_paise],
  ];
  return (
    <div className="max-w-sm">
      <dl className="money text-sm tabular-nums">
        {lines.map(([label, amount]) => (
          <div key={label} className="flex justify-between gap-6 py-1">
            <dt className={amount < 0 ? "text-muted-foreground" : undefined}>{label}</dt>
            <dd className={amount < 0 ? "text-muted-foreground" : undefined}>
              {amount < 0 ? "−" : ""}
              {formatINR(Math.abs(amount))}
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-6 border-t border-border pt-2 font-semibold">
          <dt>Credited to wallet</dt>
          <dd>{formatINR(payout.net_paise)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-sm text-muted-foreground">{FEE_NOTE}</p>
    </div>
  );
}
