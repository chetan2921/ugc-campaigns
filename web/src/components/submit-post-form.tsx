"use client";

import { FormEvent, useState } from "react";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, post } from "@/lib/api";
import { parseInstagramUrl } from "@/lib/instagram";

export function SubmitPostForm({
  applicationId,
  onSubmitted,
}: {
  applicationId: number;
  onSubmitted: () => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const valid = parseInstagramUrl(url) !== null;

  async function paste() {
    setError(null);
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch {
      setError("Couldn't read the clipboard. Paste with the keyboard instead.");
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setError(null);
    setPending(true);
    try {
      await post(`/applications/${applicationId}/submissions`, { url: url.trim() });
      await mutate("/applications/mine");
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-2" onSubmit={(event) => void onSubmit(event)}>
      <Label htmlFor={`post-url-${applicationId}`}>Post link</Label>
      <div className="flex gap-2">
        <Input
          id={`post-url-${applicationId}`}
          value={url}
          inputMode="url"
          autoComplete="off"
          className="min-w-0"
          onChange={(event) => {
            setUrl(event.target.value);
            setError(null);
          }}
        />
        <Button type="button" variant="outline" onClick={() => void paste()}>
          Paste
        </Button>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {valid ? "Instagram reel ✓" : "Paste a link to an Instagram post or reel"}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-fit" disabled={!valid || pending}>
        {pending ? "Submitting" : "Submit"}
      </Button>
    </form>
  );
}
