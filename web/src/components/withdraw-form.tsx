"use client";

import { FormEvent, useState } from "react";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { post } from "@/lib/api";
import { errorText, instant } from "@/lib/instant";
import { rupeesToPaise } from "@/lib/money";
import type { Wallet, Withdrawal } from "@/lib/types";

export function paiseToRupeesInput(paise: number): string {
  const whole = Math.trunc(paise / 100);
  const frac = Math.abs(paise % 100);
  if (frac === 0) return String(whole);
  return `${whole}.${String(frac).padStart(2, "0")}`;
}

export function WithdrawForm({
  balancePaise,
  amount,
  upi,
  onAmountChange,
  onUpiChange,
}: {
  balancePaise: number;
  amount: string;
  upi: string;
  onAmountChange: (value: string) => void;
  onUpiChange: (value: string) => void;
}) {
  const [amountError, setAmountError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const paise = rupeesToPaise(amount);
    if (paise == null) {
      setAmountError("Enter an amount like 500 or 499.50");
      setFormError(null);
      return;
    }
    setAmountError(null);
    setFormError(null);
    setPending(true);
    const typed = amount;
    onAmountChange("");
    const placeholder: Withdrawal = {
      id: -Date.now(),
      amount_paise: paise,
      upi_id: upi.trim(),
      status: "processing",
      failure_reason: null,
      created_at: new Date().toISOString(),
      processed_at: null,
    };
    try {
      await instant("Withdrawal started", () =>
        mutate<Wallet>("/wallet", post("/wallet/withdrawals", { amount_paise: paise, upi_id: upi.trim() }), {
          optimisticData: (current) =>
            current
              ? { ...current, balance_paise: current.balance_paise - paise, withdrawals: [placeholder, ...current.withdrawals] }
              : (current as unknown as Wallet),
          populateCache: false,
          rollbackOnError: true,
          revalidate: true,
        }),
      );
    } catch (err) {
      onAmountChange(typed);
      setFormError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid max-w-md gap-3" onSubmit={(event) => void onSubmit(event)}>
      <div>
        <Label htmlFor="withdraw-amount">Amount</Label>
        <div className="mt-1 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
              ₹
            </span>
            <Input
              id="withdraw-amount"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              className="pl-7"
              onChange={(event) => {
                onAmountChange(event.target.value);
                setAmountError(null);
              }}
            />
          </div>
          <Button type="button" variant="outline" onClick={() => onAmountChange(paiseToRupeesInput(balancePaise))}>
            Withdraw all
          </Button>
        </div>
        {amountError ? (
          <p role="alert" className="mt-1 text-sm text-bad">
            {amountError}
          </p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="withdraw-upi">UPI ID</Label>
        <Input
          id="withdraw-upi"
          autoComplete="off"
          value={upi}
          className="mt-1"
          onChange={(event) => onUpiChange(event.target.value)}
        />
        <p className="mt-1 text-sm text-muted-foreground">Payouts go to this UPI ID</p>
      </div>
      {formError ? (
        <p role="alert" className="text-sm text-bad">
          {formError}
        </p>
      ) : null}
      <Button type="submit" className="w-fit" data-primary-cta disabled={pending}>
        {pending ? "Withdrawing" : "Withdraw"}
      </Button>
    </form>
  );
}
