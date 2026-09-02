"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
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
  challengeSummary: { title: string; taskCount: number; estimatedMinutes: number; estimatedDurationLabel: string | null } | null;
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
    deadline: !deadline ? "Required" : null,
    startDate: !startDate ? "Required" : startDate < today ? "Cannot be in the past" : deadline && startDate < deadline ? "Must be after the deadline" : null,
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

      <div className="mt-5 space-y-4">
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

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Challenge</p>
        {challengeSummary ? (
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 font-normal text-primary hover:bg-primary/10">Attached</Badge>
            <p className="text-sm text-foreground">
              {challengeSummary.title}{" "}
              <span className="text-muted-foreground">
                · {challengeSummary.taskCount} task{challengeSummary.taskCount === 1 ? "" : "s"} · {formatChallengeDuration(challengeSummary.estimatedMinutes, challengeSummary.estimatedDurationLabel)}
              </span>
            </p>
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-muted-foreground">No challenge attached.</p>
        )}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Missing details</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Location" error={attempted ? fieldErrors.location : null}>
            <LocationCombobox value={location} onChange={setLocation} />
          </Field>
          <Field label="Mode" error={attempted ? fieldErrors.workMode : null}>
            <Select value={workMode ?? undefined} onValueChange={(v) => setWorkMode(v as WorkMode)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select mode" /></SelectTrigger>
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
                <SelectTrigger className="w-full"><SelectValue placeholder="Select duration" /></SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_DURATION}>Custom</SelectItem>
                </SelectContent>
              </Select>
              {durationChoice === CUSTOM_DURATION && (
                <Input value={customDuration} onChange={(e) => setCustomDuration(e.target.value)} placeholder="e.g. 10 weeks" />
              )}
            </div>
          </Field>
          <Field label="Hours per week" error={attempted ? fieldErrors.hoursPerWeek : null}>
            <Input type="number" min={1} max={60} value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} placeholder="e.g. 20" />
          </Field>
          <Field label="Application deadline" error={attempted ? fieldErrors.deadline : null}>
            <DatePickerField value={deadline} onChange={setDeadline} minDate={today} />
          </Field>
          <Field label="Start date" error={attempted ? fieldErrors.startDate : null}>
            <DatePickerField value={startDate} onChange={setStartDate} minDate={deadline && deadline > today ? deadline : today} />
          </Field>
          <Field label="Number of interns" error={attempted ? fieldErrors.slots : null}>
            <Input type="number" min={1} max={100} value={slots} onChange={(e) => setSlots(Number(e.target.value) || 1)} />
          </Field>
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

function Field({ label, error, children }: { label: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
