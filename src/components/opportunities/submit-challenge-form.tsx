"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { submitChallengeAction } from "@/lib/opportunities/student-actions";

export function SubmitChallengeForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [artifactUrl, setArtifactUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await submitChallengeAction({ applicationId, notes, artifactUrl: artifactUrl || undefined });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't submit. Try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 border border-navy/12 bg-white p-6">
      <div>
        <label htmlFor="artifact-url" className="text-sm font-medium text-navy">
          Link to your work
        </label>
        <Input
          id="artifact-url"
          type="url"
          placeholder="https://..."
          value={artifactUrl}
          onChange={(e) => setArtifactUrl(e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <label htmlFor="submission-notes" className="text-sm font-medium text-navy">
          Notes for the reviewer
        </label>
        <Textarea
          id="submission-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          className="mt-1.5"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Submitting…" : "Submit Challenge"}
      </Button>
    </form>
  );
}
