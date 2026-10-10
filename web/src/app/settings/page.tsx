"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ApiError, patch } from "@/lib/api";
import { useMe } from "@/lib/auth";
import type { User } from "@/lib/types";

const PHONE = /^\+?[0-9]{10,15}$/;
const UPI = /^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/;

type OptIn = "email_opt_in" | "whatsapp_opt_in";

export default function SettingsPage() {
  const { data: user, error, mutate } = useMe();
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const [upiDraft, setUpiDraft] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyOpt, setBusyOpt] = useState<OptIn | null>(null);

  const phone = phoneDraft ?? user?.phone ?? "";
  const upi = upiDraft ?? user?.upi_id ?? "";
  const creator = user?.role === "creator";
  const profileDirty =
    phone !== (user?.phone ?? "") || (creator && upi !== (user?.upi_id ?? ""));

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    const nextPhone = phone.trim();
    const nextUpi = upi.trim();
    if (nextPhone && !PHONE.test(nextPhone)) {
      setFieldError("Phone should be 10 to 15 digits, with an optional +.");
      return;
    }
    if (creator && nextUpi && !UPI.test(nextUpi)) {
      setFieldError("Enter a UPI ID like name@okbank.");
      return;
    }
    setFieldError(null);
    setSaving(true);
    try {
      const body: { phone: string | null; upi_id?: string | null } = { phone: nextPhone || null };
      if (creator) body.upi_id = nextUpi || null;
      const next = await patch<User>("/me", body);
      setPhoneDraft(null);
      setUpiDraft(null);
      await mutate(next, { revalidate: false });
      toast.success("Saved");
    } catch (err) {
      setFieldError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function setOpt(field: OptIn, checked: boolean) {
    if (!user) return;
    setToggleError(null);
    setBusyOpt(field);
    const previous = user;
    await mutate({ ...user, [field]: checked }, { revalidate: false });
    try {
      const next = await patch<User>("/me", { [field]: checked });
      await mutate(next, { revalidate: false });
      toast.success("Saved");
    } catch (err) {
      await mutate(previous, { revalidate: false });
      setToggleError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusyOpt(null);
    }
  }

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      {error ? (
        <LoadError
          message={error instanceof Error ? error.message : "Something went wrong. Please try again."}
          onRetry={() => void mutate()}
        />
      ) : null}
      {user ? (
        <>
          <dl className="mt-6 grid max-w-md gap-3 text-sm">
            <div>
              <dt className="font-medium">Name</dt>
              <dd className="mt-1">{user.name}</dd>
            </div>
            <div>
              <dt className="font-medium">Email</dt>
              <dd className="mt-1">{user.email}</dd>
            </div>
          </dl>
          <form className="mt-6 grid max-w-md gap-3" onSubmit={(event) => void saveProfile(event)}>
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+919800000001"
                value={phone}
                aria-invalid={fieldError ? true : undefined}
                onChange={(event) => {
                  setPhoneDraft(event.target.value);
                  setFieldError(null);
                }}
              />
              <p className="text-sm text-muted-foreground">Needed for WhatsApp</p>
            </div>
            {creator ? (
              <div className="grid gap-1.5">
                <Label htmlFor="upi">UPI ID</Label>
                <Input
                  id="upi"
                  name="upi_id"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="name@okbank"
                  value={upi}
                  aria-invalid={fieldError ? true : undefined}
                  onChange={(event) => {
                    setUpiDraft(event.target.value);
                    setFieldError(null);
                  }}
                />
              </div>
            ) : null}
            {fieldError ? (
              <p role="alert" className="text-sm text-bad">
                {fieldError}
              </p>
            ) : null}
            <Button type="submit" className="mt-3 w-fit" disabled={saving || !profileDirty}>
              {saving ? "Saving" : "Save"}
            </Button>
          </form>
          <div className="mt-8 grid max-w-md gap-4">
            <OptRow
              id="email-opt-in"
              label="Email"
              checked={user.email_opt_in}
              disabled={busyOpt !== null}
              onChange={(checked) => void setOpt("email_opt_in", checked)}
            />
            <OptRow
              id="whatsapp-opt-in"
              label="WhatsApp"
              checked={user.whatsapp_opt_in}
              disabled={busyOpt !== null}
              hint={user.phone ? undefined : "Add a phone number to receive WhatsApp messages"}
              onChange={(checked) => void setOpt("whatsapp_opt_in", checked)}
            />
            {toggleError ? (
              <p role="alert" className="text-sm text-bad">
                {toggleError}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </main>
  );
}

function OptRow({
  id,
  label,
  checked,
  disabled,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  hint?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {hint ? (
          <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onCheckedChange={onChange}
      />
    </div>
  );
}
