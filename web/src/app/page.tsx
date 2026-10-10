"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { homeFor, useMe } from "@/lib/auth";
import { getToken } from "@/lib/token";

export default function HomePage() {
  const router = useRouter();
  const { data, error } = useMe();

  useEffect(() => {
    if (!getToken() || error) {
      router.replace("/login");
      return;
    }
    if (data) router.replace(homeFor(data.role));
  }, [data, error, router]);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
      <p className="mt-2 text-sm text-muted-foreground">Opening your campaigns.</p>
    </main>
  );
}
