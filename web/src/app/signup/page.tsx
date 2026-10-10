"use client";

import { FormEvent, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, post } from "@/lib/api";
import { homeFor } from "@/lib/auth";
import { saveToken } from "@/lib/token";
import type { AuthOut, Role } from "@/lib/types";
import { cn } from "cn";

const HANDLE = /^@?[A-Za-z0-9._]{1,30}$/;
const PHONE = /^\+?[0-9]{10,15}$/;

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!role) return;
    setError(null);
    if (role === "creator" && !HANDLE.test(handle.trim())) {
      setError("Use letters, numbers, dots or underscores in the Instagram handle.");
      return;
    }
    if (phone.trim() && !PHONE.test(phone.trim())) {
      setError("Phone should be 10 to 15 digits, with an optional +.");
      return;
    }
    setPending(true);
    try {
      const body: Record<string, string> = {
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      };
      if (role === "creator") body.instagram_handle = handle.trim().replace(/^@/, "");
      if (phone.trim()) body.phone = phone.trim();
      const out = await post<AuthOut>("/auth/signup", body);
      saveToken(out.token);
      await mutate(() => true, undefined, { revalidate: false });
      router.replace(homeFor(role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (step === 1) {
    return (
      <AuthScreen title="Sign up">
        <div className="grid gap-2">
          <RoleChoice
            pressed={role === "brand"}
            title="I'm a brand"
            detail="Post a campaign and review the posts that come in."
            onClick={() => setRole("brand")}
          />
          <RoleChoice
            pressed={role === "creator"}
            title="I'm a creator"
            detail="Apply, submit your Instagram post, and get paid into a wallet."
            onClick={() => setRole("creator")}
          />
        </div>
        <Button
          type="button"
          className="mt-6 h-11 w-full"
          data-primary-cta
          disabled={!role}
          onClick={() => setStep(2)}
        >
          Continue
        </Button>
        <p className="mt-4 text-sm">
          <Link href="/login" className="text-primary underline">
            Already have an account? Log in
          </Link>
        </p>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title={role === "creator" ? "Creator account" : "Brand account"}>
      <form onSubmit={onSubmit} className="grid gap-3">
        <Field id="name" label="Name">
          <Input id="name" name="name" autoComplete="name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field id="email" label="Email">
          <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field id="password" label="Password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {role === "creator" ? (
          <>
            <Field id="instagram" label="Instagram handle">
              <Input
                id="instagram"
                name="instagram_handle"
                required
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="asha.makes"
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
              />
            </Field>
            <Field id="phone" label="Phone" hint="Add it to get WhatsApp updates">
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+919800000001"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </Field>
          </>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="mt-3 h-11 w-full" data-primary-cta disabled={pending}>
          {pending ? "Creating account" : "Create account"}
        </Button>
      </form>
      <button type="button" className="mt-4 text-left text-sm text-primary underline" onClick={() => setStep(1)}>
        Change role
      </button>
    </AuthScreen>
  );
}

function RoleChoice({
  pressed,
  title,
  detail,
  onClick,
}: {
  pressed: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-3 text-left",
        pressed ? "border-foreground bg-secondary" : "border-border bg-background",
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="mt-1 block text-sm text-muted-foreground">{detail}</span>
    </button>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
