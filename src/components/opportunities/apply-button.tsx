"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { applyToOpportunityAction, getApplicationEntryAction } from "@/lib/opportunities/student-actions";
import { cn } from "@/lib/utils";

type Entry = Awaited<ReturnType<typeof getApplicationEntryAction>>;

export function ApplyButton({ opportunityId, label = "Apply", className }: { opportunityId: string; label?: string; className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  function review() {
    setError(null);
    startTransition(async () => {
      try {
        const next = await getApplicationEntryAction(opportunityId);
        if (next.applicationId) { router.push(`/student/applications/${next.applicationId}`); return; }
        setEntry(next);
        setAnswers(next.questions.map(() => ""));
        setOpen(true);
      } catch (err) { setError(err instanceof Error ? err.message : "Couldn't load application requirements."); }
    });
  }

  function apply() {
    if (!entry) return;
    setError(null);
    startTransition(async () => {
      try {
        const id = await applyToOpportunityAction(opportunityId, document.referrer || undefined, { answers, revision: entry.revision });
        router.push(`/student/applications/${id}`);
      } catch (err) { setError(err instanceof Error ? err.message : "Couldn't apply. Try again."); }
    });
  }

  const unmet = entry?.eligibility.filter((requirement) => !requirement.met) ?? [];
  return (
    <div>
      <Button onClick={review} disabled={isPending} className={cn(className)}>{isPending ? "Loading…" : label}</Button>
      {!open && error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{unmet.length ? "Check your eligibility" : "Apply with your profile"}</DialogTitle>
            <DialogDescription>{unmet.length ? "These explicit company prerequisites are not met by the information currently on your profile." : "CV optional. Answer these short work questions in about 5–15 minutes. A person will review your responses."}</DialogDescription>
          </DialogHeader>
          {unmet.length ? (
            <div className="space-y-3">
              <ul className="list-disc space-y-2 pl-5">{unmet.map((item) => <li key={item.requirement}>{item.requirement}</li>)}</ul>
              <p className="text-sm text-muted-foreground">Eligibility uses declared profile information. It does not establish overall suitability or independently verify credentials.</p>
              <Link href="/student/profile" className="text-sm font-medium text-teal-ink underline">Review your profile</Link>
            </div>
          ) : (
            <div className="space-y-4">{entry?.questions.map((question, index) => (
              <label key={`${entry.revision}-${index}`} className="block space-y-2">
                <span className="text-sm font-medium">{question}</span>
                <Textarea value={answers[index] ?? ""} maxLength={3000} rows={4} onChange={(event) => setAnswers((current) => current.map((answer, item) => item === index ? event.target.value : answer))} />
              </label>
            ))}</div>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Back</Button>
            {!unmet.length && <Button onClick={apply} disabled={isPending || !answers.length || answers.some((answer) => !answer.trim())}>{isPending ? "Applying…" : "Submit application"}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
