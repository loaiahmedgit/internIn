"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye, FileCheck2, Pencil } from "lucide-react";
import { publishOpportunityFromReviewAction, type MissingOpportunityDetails } from "@/lib/opportunities/opportunity-from-challenge-actions";
import { formatChallengeDuration } from "@/lib/opportunities/challenge-duration";
import { LocationCombobox } from "@/components/opportunities/location-combobox";
import { DatePickerField } from "@/components/opportunities/date-picker-field";

type WorkMode = "remote" | "onsite" | "hybrid" | null;

const DURATION_OPTIONS = ["1 month", "2 months", "3 months", "4 months", "6 months"];
const CUSTOM_DURATION = "custom";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayAfter(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

type ChallengeSummary = {
  title: string;
  scenario: string;
  skills: string[];
  tasks: { id: string; title: string; description: string }[];
  deliverables: string[];
  taskCount: number;
  estimatedMinutes: number;
  estimatedDurationLabel: string | null;
};

/**
 * "Ready to publish" — the review-before-publish step for an internship
 * generated from an Ask internIn ChallengeDraft. Most of the posting is
 * already written; this only asks for the real logistics the conversation
 * never collected. A review, not a form: compact fields, proper pickers
 * (searchable location, Select for mode/duration, shadcn date picker),
 * client-side validation before the server ever sees a bad value, and a
 * toast + redirect on success — never a full-page "published!" screen.
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
  challengeSummary: ChallengeSummary | null;
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const submittedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const [location, setLocation] = useState(initialLocation);
  const [workMode, setWorkMode] = useState<WorkMode>(initialWorkMode);
  const isPresetDuration = DURATION_OPTIONS.includes(initialDuration);
  const [durationChoice, setDurationChoice] = useState(initialDuration ? (isPresetDuration ? initialDuration : CUSTOM_DURATION) : "");
  const [customDuration, setCustomDuration] = useState(isPresetDuration ? "" : initialDuration);
  const duration = durationChoice === CUSTOM_DURATION ? customDuration : durationChoice;
  const [hoursPerWeek, setHoursPerWeek] = useState(initialHoursPerWeek?.toString() ?? "");
  const [deadline, setDeadline] = useState<Date | null>(initialApplicationDeadline);
  const [startDate, setStartDate] = useState<Date | null>(initialStartDate);
  const [slots, setSlots] = useState(initialSlots);

  const today = startOfToday();
  const fieldErrors = {
    location: location.trim().length === 0 ? "Required" : null,
    workMode: workMode === null ? "Required" : null,
    duration: duration.trim().length === 0 ? "Required" : null,
    hoursPerWeek: !Number(hoursPerWeek) || Number(hoursPerWeek) < 1 || Number(hoursPerWeek) > 60 ? "1–60" : null,
    deadline: !deadline ? "Required" : deadline < today ? "Cannot be in the past" : null,
    startDate: !startDate ? "Required" : startDate < today ? "Cannot be in the past" : deadline && startDate <= deadline ? "Must be after the deadline" : null,
    slots: slots < 1 ? "At least 1" : null,
  };
  const canPublish = Object.values(fieldErrors).every((e) => e === null);

  function handlePublish() {
    setAttempted(true);
    if (!canPublish) return;
    // Synchronous, not state-based — closes the double-click race a
    // React-state `disabled` flag can't (same fix as the Questionnaire's
    // submit guard: isPending only updates after this click has returned).
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError(null);
    const missing: MissingOpportunityDetails = {
      location: location.trim(),
      duration: duration.trim(),
      hoursPerWeek: Number(hoursPerWeek),
      workMode,
      applicationDeadline: deadline,
      startDate,
      slots,
    };
    startTransition(async () => {
      try {
        await publishOpportunityFromReviewAction(opportunityId, missing);
        toast.success("Internship published", { description: `${role} is now live.` });
        router.push(`/company/opportunities/${opportunityId}`);
      } catch (e) {
        submittedRef.current = false;
        const message = e instanceof Error ? e.message : "Please try again.";
        setError(message);
        toast.error("Couldn't publish internship", { description: message });
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8 sm:py-10">
      <div className="overflow-hidden rounded-xl border border-navy/10 bg-white">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-navy/10 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Ready to publish</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-navy">{role}</h1>
            <p className="mt-0.5 text-sm text-navy/55">{companyName}</p>
            {shortDescription && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-navy/70">{shortDescription}</p>}
          </div>
          <Button variant="outline" size="sm" render={<Link href={`/company/opportunities/${opportunityId}/edit`} />} nativeButton={false}>
            <Pencil className="size-3.5" /> Edit details
          </Button>
        </header>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Role</p>
            <p className="mt-1.5 text-sm leading-relaxed text-navy/75">{description}</p>
          </section>

          <div className="grid gap-5 sm:grid-cols-2 sm:gap-8">
            {requirements.length > 0 && (
              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Requirements</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-relaxed text-navy/75">
                  {requirements.slice(0, 6).map((requirement) => <li key={requirement}>{requirement}</li>)}
                </ul>
              </section>
            )}

            {niceToHave.length > 0 && (
              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Nice to have</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-relaxed text-navy/75">
                  {niceToHave.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
            )}
          </div>

          {whatYouWillLearn && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">What you&apos;ll learn</p>
              <p className="mt-1.5 text-sm leading-relaxed text-navy/75">{whatYouWillLearn}</p>
            </section>
          )}
        </div>

        <section className="border-t border-navy/10 px-5 py-5 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Challenge</p>
          {challengeSummary ? (
            <div className="mt-2.5 flex flex-col gap-3 rounded-lg border border-navy/10 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <FileCheck2 className="size-4 shrink-0 text-teal-ink" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="bg-primary/10 font-normal text-primary hover:bg-primary/10">Attached</Badge>
                    <p className="truncate text-sm font-medium text-navy">{challengeSummary.title}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-navy/50">
                    {challengeSummary.taskCount} task{challengeSummary.taskCount === 1 ? "" : "s"} · {formatChallengeDuration(challengeSummary.estimatedMinutes, challengeSummary.estimatedDurationLabel)}
                  </p>
                </div>
              </div>
              <ChallengeInspector challenge={challengeSummary} opportunityId={opportunityId} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-navy/50">No challenge attached.</p>
          )}
        </section>

        <section className="border-t border-navy/10 px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Missing details</p>
            <p className="mt-1 text-sm text-navy/55">Confirm the logistics that were not part of the hiring conversation.</p>
          </div>
          <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
            <Field label="Location" error={attempted ? fieldErrors.location : null}>
              <LocationCombobox value={location} onChange={setLocation} />
            </Field>
            <Field label="Mode" error={attempted ? fieldErrors.workMode : null}>
              <Select value={workMode ?? undefined} onValueChange={(v) => setWorkMode(v as WorkMode)}>
                <SelectTrigger aria-label="Mode" className="w-full"><SelectValue placeholder="Select mode" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="onsite">On-site</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Duration" error={attempted ? fieldErrors.duration : null}>
              <div className="space-y-2">
                <Select value={durationChoice || undefined} onValueChange={(v) => setDurationChoice(v ?? "")}>
                  <SelectTrigger aria-label="Duration" className="w-full"><SelectValue placeholder="Select duration" /></SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_DURATION}>Custom</SelectItem>
                  </SelectContent>
                </Select>
                {durationChoice === CUSTOM_DURATION && (
                  <Input aria-label="Custom duration" value={customDuration} onChange={(e) => setCustomDuration(e.target.value)} placeholder="e.g. 10 weeks" />
                )}
              </div>
            </Field>
            <Field label="Hours per week" error={attempted ? fieldErrors.hoursPerWeek : null}>
              <Input aria-label="Hours per week" type="number" min={1} max={60} value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} placeholder="e.g. 20" />
            </Field>
            <Field label="Application deadline" error={attempted ? fieldErrors.deadline : null}>
              <DatePickerField ariaLabel="Application deadline" value={deadline} onChange={setDeadline} minDate={today} />
            </Field>
            <Field label="Start date" error={attempted ? fieldErrors.startDate : null}>
              <DatePickerField ariaLabel="Start date" value={startDate} onChange={setStartDate} minDate={deadline && deadline >= today ? dayAfter(deadline) : today} />
            </Field>
            <Field label="Number of interns" error={attempted ? fieldErrors.slots : null}>
              <Input aria-label="Number of interns" type="number" min={1} max={100} value={slots} onChange={(e) => setSlots(Number(e.target.value) || 1)} />
            </Field>
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-navy/10 bg-navy/[0.015] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div aria-live="polite">{error && <p className="text-sm text-destructive">{error}</p>}</div>
          <Button className="self-end bg-primary text-primary-foreground hover:bg-primary/90" disabled={isPending} onClick={handlePublish}>
            {isPending ? "Publishing…" : "Publish internship"}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function ChallengeInspector({ challenge, opportunityId }: { challenge: ChallengeSummary; opportunityId: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" />}>
        <Eye className="size-3.5" aria-hidden="true" /> View challenge
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{challenge.title}</DialogTitle>
          <DialogDescription>
            {challenge.taskCount} task{challenge.taskCount === 1 ? "" : "s"} · {formatChallengeDuration(challenge.estimatedMinutes, challenge.estimatedDurationLabel)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Scenario</p>
            <p className="mt-1.5 leading-relaxed text-navy/75">{challenge.scenario}</p>
          </section>
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Tasks</p>
            <ol className="mt-2 space-y-2">
              {challenge.tasks.map((task, index) => (
                <li key={task.id} className="grid grid-cols-[1.5rem_1fr] gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{index + 1}</span>
                  <div>
                    <p className="font-medium text-navy">{task.title}</p>
                    <p className="mt-0.5 text-navy/60">{task.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          {challenge.deliverables.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Deliverables</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-navy/70">
                {challenge.deliverables.map((deliverable) => <li key={deliverable}>{deliverable}</li>)}
              </ul>
            </section>
          )}
          <div className="flex flex-wrap gap-1.5 border-t border-navy/10 pt-3">
            {challenge.skills.map((skill) => <Badge key={skill} variant="secondary" className="font-normal">{skill}</Badge>)}
          </div>
          <div className="flex justify-end border-t border-navy/10 pt-3">
            <Button variant="outline" size="sm" render={<Link href={`/company/opportunities/${opportunityId}/setup/challenge`} />} nativeButton={false}>
              <Pencil className="size-3.5" /> Edit challenge
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-navy/60">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
