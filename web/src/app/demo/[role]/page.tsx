"use client";

import { notFound, useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { mutate } from "swr";
import { AuthScreen } from "@/components/auth-screen";
import { ApiError, post } from "@/lib/api";
import { homeFor } from "@/lib/auth";
import { saveToken } from "@/lib/token";
import type { AuthOut, Role } from "@/lib/types";

const DEMO_EMAIL: Record<Role, string> = {
  brand: "brand@ugc-demo.in",
  creator: "creator@ugc-demo.in",
};

function isRole(value: string): value is Role {
  return value === "brand" || value === "creator";
}

export default function DemoPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = use(params);
  if (process.env.NEXT_PUBLIC_DEMO !== "1") notFound();
  if (!isRole(role)) notFound();
  return <DemoLogin role={role} />;
}

function DemoLogin({ role }: { role: Role }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const out = await post<AuthOut>("/auth/login", {
          email: DEMO_EMAIL[role],
          password: "demo-pass-123",
        });
        if (cancelled) return;
        saveToken(out.token);
        await mutate(() => true, undefined, { revalidate: false });
        const next = new URLSearchParams(window.location.search).get("next");
        const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : homeFor(role);
        router.replace(dest);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, router]);

  return (
    <AuthScreen
      title="Opening the demo"
      lede={role === "brand" ? "Signing in as the demo brand." : "Signing in as the demo creator."}
    >
      {error ? (
        <div className="grid gap-3">
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
          <Link href="/login" className="text-sm text-primary underline">
            Back to log in
          </Link>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This takes a moment.</p>
      )}
    </AuthScreen>
  );
}
