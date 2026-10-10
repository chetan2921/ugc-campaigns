"use client";

import { Fragment, useState } from "react";
import useSWR from "swr";
import { LoadError } from "@/components/load-error";
import { PayoutBill } from "@/components/payout-bill";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { paiseToRupeesInput, WithdrawForm } from "@/components/withdraw-form";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/money";
import { formatIST } from "@/lib/time";
import type { LedgerEntry, Wallet, Withdrawal } from "@/lib/types";

function signed(paise: number): string {
  if (paise < 0) return `−${formatINR(Math.abs(paise))}`;
  if (paise > 0) return `+${formatINR(paise)}`;
  return formatINR(0);
}

function ledgerWhat(entry: LedgerEntry): string {
  if (entry.kind === "payout") return `Payout: ${entry.campaign_title ?? "Campaign"}`;
  if (entry.kind === "withdrawal") return "Withdrawal";
  return "Refund";
}

function withdrawalLine(item: Withdrawal): string {
  if (item.status === "processing") return "Processing…";
  if (item.status === "succeeded") {
    return `Sent to ${item.upi_id} · ${formatIST(item.processed_at ?? item.created_at)}`;
  }
  return `Failed: ${item.failure_reason ?? "The transfer failed"}. ${formatINR(item.amount_paise)} is back in your wallet.`;
}

export default function WalletPage() {
  const { data, error, isLoading, mutate } = useSWR<Wallet>("/wallet", api, {
    refreshInterval: (latest) => (latest?.withdrawals.some((item) => item.status === "processing") ? 3_000 : 0),
  });
  const [amount, setAmount] = useState("");
  const [upiDraft, setUpiDraft] = useState<string | null>(null);
  const [openBills, setOpenBills] = useState<number[]>([]);
  const upi = upiDraft ?? data?.upi_id ?? "";

  function retry(item: Withdrawal) {
    setAmount(paiseToRupeesInput(item.amount_paise));
    document.getElementById("withdraw-amount")?.focus();
  }

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Wallet</h1>
      {isLoading ? <WalletSkeleton /> : null}
      {error ? (
        <LoadError
          message={error instanceof Error ? error.message : "Something went wrong. Please try again."}
          onRetry={() => void mutate()}
        />
      ) : null}
      {data ? (
        <>
          <p className="money mt-4 text-3xl font-semibold">{formatINR(data.balance_paise)}</p>
          <div className="mt-6">
            <WithdrawForm
              balancePaise={data.balance_paise}
              amount={amount}
              upi={upi}
              onAmountChange={setAmount}
              onUpiChange={setUpiDraft}
            />
          </div>
          {data.withdrawals.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-base font-semibold">Withdrawals</h2>
              <ul className="mt-2">
                {data.withdrawals.map((item) => (
                  <li key={item.id} className="border-b border-border py-3">
                    <p className="money text-sm font-medium">{formatINR(item.amount_paise)}</p>
                    <p className={item.status === "failed" ? "mt-1 text-sm" : "mt-1 text-sm text-muted-foreground"}>
                      {withdrawalLine(item)}
                    </p>
                    {item.status === "failed" ? (
                      <Button type="button" variant="outline" className="mt-2" onClick={() => retry(item)}>
                        Try again
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {data.entries.length === 0 ? (
            <p className="mt-10">No money yet. Approved posts are paid here.</p>
          ) : (
            <section className="mt-10">
              <h2 className="text-base font-semibold">Ledger</h2>
              <table className="mt-2 w-full table-fixed text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="w-[58%] py-2 font-medium">What</th>
                    <th className="w-[42%] py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => {
                    const open = openBills.includes(entry.id);
                    return (
                      <Fragment key={entry.id}>
                        <tr className="align-top">
                          <td className="pt-3 break-words">
                            {ledgerWhat(entry)}
                            <p className="mt-1 text-muted-foreground">{formatIST(entry.created_at)}</p>
                          </td>
                          <td className="money pt-3 text-right">
                            {signed(entry.amount_paise)}
                            <p className="mt-1 text-muted-foreground">Balance {formatINR(entry.balance_after_paise)}</p>
                          </td>
                        </tr>
                        <tr className="border-b border-border">
                          <td colSpan={2} className="pb-3">
                            {entry.payout ? (
                              <>
                                <button
                                  type="button"
                                  className="text-sm text-primary underline"
                                  aria-expanded={open}
                                  onClick={() =>
                                    setOpenBills((ids) =>
                                      ids.includes(entry.id) ? ids.filter((id) => id !== entry.id) : [...ids, entry.id],
                                    )
                                  }
                                >
                                  See payout
                                </button>
                                {open ? (
                                  <div className="mt-2">
                                    <PayoutBill payout={entry.payout} />
                                  </div>
                                ) : null}
                              </>
                            ) : null}
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}
        </>
      ) : null}
    </main>
  );
}

function WalletSkeleton() {
  return (
    <div className="mt-4" aria-busy="true">
      <Skeleton className="h-9 w-36" />
      <Skeleton className="mt-6 h-8 w-full" />
      <Skeleton className="mt-3 h-8 w-full" />
    </div>
  );
}
