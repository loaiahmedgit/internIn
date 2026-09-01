"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Pencil } from "lucide-react";
import { publishOpportunityFromReviewAction, type MissingOpportunityDetails } from "@/lib/opportunities/opportunity-from-challenge-actions";
import { toDateInputValue } from "@/lib/format-date";

type WorkMode = "remote" | "onsite" | "hybrid" | null;

/**
 * "Ready to publish" — the review-before-publish step for an internship
 * generated from an Ask internIn ChallengeDraft (see
 * opportunity-from-challenge-actions.ts). Most of the posting is already
 * written; this only asks for the real logistics the conversation never
 * collected (location, mode, duration, hours/week, deadline, start date,
 * openings). Deeper edits go through the existing manual Edit Internship
 * page — this stays a compact summary, not another giant form.
 */
export function OpportunityDraftReview({
  opportunityId,
  companyName,
  role,
  shortDescription,
  description,
  whatYouWillLearn,
  requirements,
  niceToHave,
  challengeSummary,
  initialLocation,
  initialDuration,
  initialHoursPerWeek,
  initialWorkMode,
  initialApplicationDeadline,
  initialStartDate,
  initialSlots,
}: {
  opportunityId: string;
  companyName: string;
  role: string;
  shortDescription: string | null;
  description: string;
  whatYouWillLearn: string | null;
  requirements: string[];
  niceToHave: string[];
  challengeSummary: { title: string; taskCount: number; estimatedMinutes: number } | null;
  /** Empty string means "not set yet" — the field renders blank, not with
   * a fabricated value. */
  initialLocation: string;
  initialDuration: string;
  initialHoursPerWeek: number | null;
  initialWorkMode: WorkMode;
  initialApplicationDeadline: Date | null;
  initialStartDate: Date | null;
  initialSlots: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [location, setLocation] = useState(initialLocation);
  const [duration, setDuration] = useState(initialDuration);
  const [hoursPerWeek, setHoursPerWeek] = useState(initialHoursPerWeek?.toString() ?? "");
  const [workMode, setWorkMode] = useState<WorkMode>(initialWorkMode);
  const [deadlineInput, setDeadlineInput] = useState(initialApplicationDeadline ? toDateInputValue(initialApplicationDeadline) : "");
  const [startDateInput, setStartDateInput] = useState(initialStartDate ? toDateInputValue(initialStartDate) : "");
  const [slots, setSlots] = useState(initialSlots);

  const canPublish = location.trim().length > 0 && duration.trim().length > 0 && Number(hoursPerWeek) > 0;

  function handlePublish() {
    if (!canPublish) {
      setError("Fill in location, duration, and hours per week before publishing.");
      return;
    }
    setError(null);
    const missing: MissingOpportunityDetails = {
      location: location.trim(),
      duration: duration.trim(),
      hoursPerWeek: Number(hoursPerWeek),
      workMode,
      applicationDeadline: deadlineInput ? new Date(deadlineInput) : null,
      startDate: startDateInput ? new Date(startDateInput) : null,
      slots,
    };
    startTransition(async () => {
      try {
        await publishOpportunityFromReviewAction(opportunityId, missing);
        setPublished(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't publish this internship — try again.");
      }
    });
  }

  if (published) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <CheckCircle2 className="mx-auto size-10 text-primary" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">Internship published</h1>
        <p className="mt-1 text-sm text-muted-foreground">{role} is now live.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link href={`/company/opportunities/${opportunityId}`}>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">View internship</Button>
          </Link>
          <Link href={`/company/candidates?opportunity=${opportunityId}`}>
            <Button variant="outline">View candidates</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ready to publish</p>
          <h1 className="mt-1 text-xl font-semibold text-foreground">{role}</h1>
          <p className="text-sm text-muted-foreground">{companyName}</p>
        </div>
        <Link href={`/company/opportunities/${opportunityId}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="size-3.5" /> Edit details
          </Button>
        </Link>
      </div>

      {shortDescription && <p className="mt-4 text-sm text-foreground/80">{shortDescription}</p>}

      <div className="mt-6 space-y-5">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground/80">{description}</p>
        </section>

        {requirements.length > 0 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requirements</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-foreground/80">
              {requirements.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>
        )}

        {niceToHave.length > 0 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nice to have</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-foreground/80">
              {niceToHave.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>
        )}

        {whatYouWillLearn && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What you&apos;ll learn</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">{whatYouWillLearn}</p>
          </section>
        )}
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Challenge</p>
        {challengeSummary ? (
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 font-normal text-primary hover:bg-primary/10">Attached</Badge>
            <p className="text-sm text-foreground">
              {challengeSummary.title} <span className="text-muted-foreground">· {challengeSummary.taskCount} task{challengeSummary.taskCount === 1 ? "" : "s"} · {challengeSummary.estimatedMinutes} min</span>
            </p>
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-muted-foreground">No challenge attached.</p>
        )}
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Missing details</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="review-location">Location</label>
            <Input id="review-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Doha, Qatar" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="review-mode">Mode</label>
            <Select value={workMode ?? "unset"} onValueChange={(v) => setWorkMode(v === "unset" ? null : (v as WorkMode))}>
              <SelectTrigger id="review-mode" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Not specified</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="onsite">On-site</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="review-duration">Duration</label>
            <Input id="review-duration" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 3 months" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="review-hours">Hours / week</label>
            <Input id="review-hours" type="number" min={1} max={60} value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} placeholder="e.g. 20" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="review-deadline">Application deadline</label>
            <Input id="review-deadline" type="date" value={deadlineInput} onChange={(e) => setDeadlineInput(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="review-start">Start date</label>
            <Input id="review-start" type="date" value={startDateInput} onChange={(e) => setStartDateInput(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="review-slots">Openings</label>
            <Input id="review-slots" type="number" min={1} max={100} value={slots} onChange={(e) => setSlots(Number(e.target.value) || 1)} />
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-6 flex justify-end">
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={isPending} onClick={handlePublish}>
          {isPending ? "Publishing…" : "Publish internship"}
        </Button>
      </div>
    </div>
  );
}
