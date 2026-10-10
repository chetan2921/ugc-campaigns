"use client";

import { FormEvent, useState } from "react";
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
import type { AuthOut } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const demo = process.env.NEXT_PUBLIC_DEMO === "1";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const out = await post<AuthOut>("/auth/login", { email, password });
      saveToken(out.token);
      await mutate(() => true, undefined, { revalidate: false });
      router.replace(homeFor(out.user.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScreen
      title="Log in"
      lede="Brands post paid campaigns. Creators submit Instagram posts and withdraw from a wallet."
    >
      <form onSubmit={onSubmit} className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="mt-3 h-11 w-full" data-primary-cta disabled={pending}>
          {pending ? "Logging in" : "Log in"}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        <Link href="/signup" className="text-primary underline">
          Need an account? Sign up
        </Link>
      </p>
      {demo ? (
        <div className="mt-8 grid gap-2 border-t border-border pt-4">
          <Link href="/demo/brand" className="text-sm text-primary underline">
            Try the demo as a brand
          </Link>
          <Link href="/demo/creator" className="text-sm text-primary underline">
            Try the demo as a creator
          </Link>
        </div>
      ) : null}
    </AuthScreen>
  );
}
