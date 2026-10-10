"use client";

import { CampaignForm } from "@/components/campaign-form";

export default function NewCampaignPage() {
  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
      <CampaignForm />
    </main>
  );
}
