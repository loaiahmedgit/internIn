"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ListChecks,
  MapPin,
  Monitor,
  Share2,
  Sparkles,
} from "lucide-react";
import { ApplyButton } from "@/components/opportunities/apply-button";
import { SaveButton } from "@/components/opportunities/save-button";
import { ChallengeResourcesList, type ChallengeResourceListItem } from "@/components/opportunities/challenge-resources-list";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const WORK_MODE_LABEL: Record<"remote" | "onsite" | "hybrid", string> = {
  remote: "Remote",
  onsite: "On-site",
  hybrid: "Hybrid",
};

const deadlineFormatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

export interface OpportunityDetail {
  id: string;
  role: string;
  companyName: string;
  companyVerified: boolean;
  companyIndustry: string | null;
  companySize: string | null;
  location: string;
  workMode: "remote" | "onsite" | "hybrid" | null;
  duration: string;
  hoursPerWeek: number;
  applicationDeadline: Date | null;
  description: string;
  shortDescription: string | null;
  skills: string[];
  requirements: string[];
  whatYouWillLearn: string | null;
  /** Real, derived from createdAt — never a hand-set flag. */
  isNew: boolean;
  saved: boolean;
  challenge?: {
    title: string;
    taskCount: number;
    estimatedMinutes: number;
    tasks: { id: string; title: string; description: string }[];
    rubric: { criterion: string; description: string; weight: number }[];
  };
  /** Real resources for this challenge's current version — name/kind
   * always shown; a download link only renders once `hasApplied` (see
   * ChallengeResourcesList, which itself only ever links a `ready` row). */
  resources: ChallengeResourceListItem[];
  /** Real submission-requirement labels, shown as a plain deliverables list. */
  deliverables: string[];
  /** Before applying: resource names/kinds only, no download links. */
  hasApplied: boolean;
  /** Present only when the student has already applied — drives the
   * primary CTA (continue/open) instead of "Apply now". */
  application?: { id: string; ctaLabel: string };
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-black/[0.04] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
      {children}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <PanelShell>
      <div className="animate-pulse space-y-5 p-6">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-navy/8" />
          <div className="space-y-2">
            <div className="h-3 w-32 rounded bg-navy/8" />
            <div className="h-2.5 w-24 rounded bg-navy/6" />
          </div>
        </div>
        <div className="h-7 w-2/3 rounded bg-navy/8" />
        <div className="flex gap-3">
          <div className="h-3 w-20 rounded bg-navy/6" />
          <div className="h-3 w-20 rounded bg-navy/6" />
          <div className="h-3 w-20 rounded bg-navy/6" />
        </div>
        <div className="space-y-2 pt-4">
          <div className="h-3 w-full rounded bg-navy/6" />
          <div className="h-3 w-full rounded bg-navy/6" />
          <div className="h-3 w-4/5 rounded bg-navy/6" />
        </div>
      </div>
    </PanelShell>
  );
}

function EmptyPanel() {
  return (
    <PanelShell>
      <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center">
        <Sparkles className="size-6 text-navy/25" aria-hidden="true" />
        <p className="text-sm font-medium text-navy/60">Select an internship to see details</p>
        <p className="max-w-xs text-xs text-navy/40">Pick a result from the list to view the role, the work challenge, and how to apply.</p>
      </div>
    </PanelShell>
  );
}

export function ExploreDetailPanel({ detail, loading }: { detail: OpportunityDetail | null; loading: boolean }) {
  const [tab, setTab] = useState("overview");

  if (loading) return <DetailSkeleton />;
  if (!detail) return <EmptyPanel />;

  function share() {
    const url = `${window.location.origin}/student/opportunities?opportunity=${detail!.id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Link copied to clipboard"))
      .catch(() => toast.error("Couldn't copy the link"));
  }

  return (
    <PanelShell>
      <Tabs key={detail.id} value={tab} onValueChange={(value) => setTab(String(value))} className="flex h-full min-h-0 flex-col gap-0">
        <div className="shrink-0 border-b border-navy/8 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-base font-semibold text-teal-ink" aria-hidden="true">
                {detail.companyName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-navy">{detail.companyName}</p>
                  {detail.companyVerified && <BadgeCheck className="size-3.5 shrink-0 text-teal-ink" aria-label="Verified company" />}
                </div>
                {(detail.companyIndustry || detail.companySize) && (
                  <p className="truncate text-xs text-navy/50">{[detail.companyIndustry, detail.companySize].filter(Boolean).join(" · ")}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={share}
              aria-label="Copy link to this internship"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-navy/45 transition-colors hover:bg-navy/5 hover:text-navy"
            >
              <Share2 className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-balance text-xl font-semibold tracking-[-0.02em] text-navy sm:text-2xl">{detail.role}</h2>
              {detail.isNew && <span className="shrink-0 rounded-full bg-teal/10 px-2 py-0.5 text-[11px] font-semibold text-teal-ink">New</span>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <SaveButton opportunityId={detail.id} initialSaved={detail.saved} showLabel className="h-9 border border-navy/12 bg-white hover:border-teal/25 hover:bg-teal/5" />
              {detail.application ? (
                <Button render={<Link href={`/student/applications/${detail.application.id}`} />} nativeButton={false} className="h-9 bg-teal px-4 text-white hover:bg-teal-ink">
                  {detail.application.ctaLabel}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              ) : (
                <ApplyButton opportunityId={detail.id} label="Open application" className="h-9 bg-teal px-4 text-white hover:bg-teal-ink" />
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-navy/56">
            <span className="flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true" />{detail.location}</span>
            {detail.workMode && <span className="flex items-center gap-1.5"><Monitor className="size-3.5" aria-hidden="true" />{WORK_MODE_LABEL[detail.workMode]}</span>}
            <span className="flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" />{detail.duration}</span>
            <span className="flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5" aria-hidden="true" />{detail.hoursPerWeek}h/week</span>
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              {detail.applicationDeadline ? `Apply by ${deadlineFormatter.format(detail.applicationDeadline)}` : "No deadline set"}
            </span>
          </div>

          <TabsList variant="line" className="mt-4 h-auto w-full justify-start gap-4 p-0">
            <TabsTrigger value="overview" className="h-9 flex-none px-0.5 text-sm data-active:font-medium data-active:text-teal-ink">Overview</TabsTrigger>
            {detail.challenge && <TabsTrigger value="challenge" className="h-9 flex-none px-0.5 text-sm data-active:font-medium data-active:text-teal-ink">Challenge</TabsTrigger>}
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="overview" className="p-5 sm:p-6">
            <div className={`grid grid-cols-1 gap-6 ${detail.requirements.length > 0 ? "sm:grid-cols-2" : ""}`}>
              <section aria-labelledby="about-heading">
                <h3 id="about-heading" className="text-sm font-semibold text-navy">About the role</h3>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-navy/68">{detail.shortDescription || detail.description}</p>
                {detail.shortDescription && detail.description && detail.description !== detail.shortDescription && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-navy/56">{detail.description}</p>
                )}
              </section>
              {detail.requirements.length > 0 && (
                <section aria-labelledby="requirements-heading">
                  <h3 id="requirements-heading" className="text-sm font-semibold text-navy">What you&apos;ll do</h3>
                  <ul className="mt-2 space-y-1.5">
                    {detail.requirements.map((requirement) => (
                      <li key={requirement} className="flex items-start gap-2 text-sm leading-6 text-navy/64">
                        <CheckCircle2 className="mt-1 size-3.5 shrink-0 text-teal-ink" aria-hidden="true" />
                        <span>{requirement}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {(detail.whatYouWillLearn || detail.skills.length > 0) && (
              <div className="mt-6 grid grid-cols-1 gap-6 border-t border-navy/8 pt-6 sm:grid-cols-2">
                {detail.whatYouWillLearn && (
                  <section aria-labelledby="learn-inline-heading">
                    <h3 id="learn-inline-heading" className="text-sm font-semibold text-navy">What you&apos;ll learn</h3>
                    <p className="mt-1.5 text-sm leading-6 text-navy/64">{detail.whatYouWillLearn}</p>
                  </section>
                )}
                {detail.skills.length > 0 && (
                  <section aria-labelledby="key-skills-heading">
                    <h3 id="key-skills-heading" className="text-sm font-semibold text-navy">Skills</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {detail.skills.map((skill) => (
                        <span key={skill} className="rounded-full border border-navy/10 bg-[#f7f9fa] px-2.5 py-1 text-xs text-navy/62">{skill}</span>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {(detail.companyIndustry || detail.companySize || detail.companyVerified) && (
              <div className="mt-6 border-t border-navy/8 pt-6">
                <h3 className="text-sm font-semibold text-navy">About {detail.companyName}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-navy/62">
                  {detail.companyIndustry && <span className="rounded-full border border-navy/10 bg-[#f7f9fa] px-2.5 py-1">{detail.companyIndustry}</span>}
                  {detail.companySize && <span className="rounded-full border border-navy/10 bg-[#f7f9fa] px-2.5 py-1">{detail.companySize}</span>}
                  {detail.companyVerified && (
                    <span className="flex items-center gap-1 rounded-full border border-teal/20 bg-teal/5 px-2.5 py-1 text-teal-ink">
                      <BadgeCheck className="size-3.5" aria-hidden="true" />
                      Verified company
                    </span>
                  )}
                </div>
              </div>
            )}

            {detail.challenge && (
              <div className="mt-6 rounded-xl border border-black/[0.04] bg-[#f9fbfb] p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-navy/45">
                  <Sparkles className="size-3.5 text-teal-ink" aria-hidden="true" />
                  Work challenge
                </div>
                <p className="mt-1.5 text-sm font-semibold text-navy">{detail.challenge.title}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy/56">
                  <span>~{detail.challenge.estimatedMinutes} min</span>
                  <span>{detail.challenge.taskCount} {detail.challenge.taskCount === 1 ? "task" : "tasks"}</span>
                  <span>{detail.resources.length} {detail.resources.length === 1 ? "resource" : "resources"}</span>
                  <span>{detail.deliverables.length} {detail.deliverables.length === 1 ? "deliverable" : "deliverables"}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-navy/60">
                  This challenge simulates real work you&apos;d do as a {detail.role} at {detail.companyName}. It helps us both see how you think through a real problem, not just what&apos;s on your CV.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("challenge")}
                  className="mt-3 flex items-center gap-1 text-xs font-semibold text-teal-ink hover:underline"
                >
                  View challenge details
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </TabsContent>

          {detail.challenge && (
            <TabsContent value="challenge" className="p-5 sm:p-6">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-teal-ink">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Work Challenge
                <span className="ml-auto flex items-center gap-1 rounded-full bg-teal/8 px-2 py-0.5 text-xs font-medium text-teal-ink">
                  <Clock3 className="size-3" aria-hidden="true" />
                  ~{detail.challenge.estimatedMinutes} minutes
                </span>
              </div>
              <p className="mt-2 text-base font-semibold text-navy">{detail.challenge.title}</p>
              <p className="mt-1 text-sm leading-6 text-navy/64">{detail.shortDescription || detail.description}</p>

              <div className="mt-4 rounded-xl bg-teal/5 p-3.5">
                <p className="text-xs font-semibold text-teal-ink">Why this challenge?</p>
                <p className="mt-1 text-xs leading-5 text-navy/60">
                  This challenge simulates real work you&apos;d do as a {detail.role} at {detail.companyName}
                  {detail.skills.length > 0 ? ` — using ${detail.skills.slice(0, 2).join(" and ")}` : ""}. It helps us both see how you think through a real problem, not just what&apos;s on your CV.
                </p>
              </div>

              {detail.challenge.tasks.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Tasks ({detail.challenge.tasks.length})</h4>
                  <ol className="mt-2 space-y-1.5">
                    {detail.challenge.tasks.map((task, index) => (
                      <li key={task.id} className="flex items-start gap-2.5 rounded-lg border border-black/[0.04] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-teal/10 text-[11px] font-semibold text-teal-ink">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-navy">{task.title}</p>
                          {task.description && <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-navy/56">{task.description}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
                {detail.resources.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Resources provided</h4>
                    {detail.hasApplied ? (
                      <ChallengeResourcesList resources={detail.resources} />
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {detail.resources.map((resource) => (
                          <span key={resource.id} className="rounded-full border border-navy/10 bg-[#f7f9fa] px-2.5 py-1 text-xs text-navy/62">
                            {resource.name} · {resource.artifactKind.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}
                    {!detail.hasApplied && <p className="mt-1.5 text-xs text-navy/45">Apply to download these materials.</p>}
                  </div>
                )}

                {detail.deliverables.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Submission requirements</h4>
                    <ul className="mt-2 space-y-1">
                      {detail.deliverables.map((deliverable) => (
                        <li key={deliverable} className="flex items-start gap-2 text-sm leading-6 text-navy/64">
                          <CheckCircle2 className="mt-1 size-3.5 shrink-0 text-teal-ink" aria-hidden="true" />
                          <span>{deliverable}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {detail.challenge.rubric.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Evaluation preview</h4>
                  <div className="mt-2 divide-y divide-navy/8 overflow-hidden rounded-xl border border-black/[0.04] bg-white">
                    {detail.challenge.rubric.map((criterion) => (
                      <div key={criterion.criterion} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-navy">{criterion.criterion}</p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-navy/50">{criterion.description}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-gray-light px-2 py-0.5 text-[11px] font-medium text-navy/60">{criterion.weight}%</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-navy/40">
                    <ListChecks className="size-3 shrink-0" aria-hidden="true" />
                    A person at {detail.companyName} makes the final hiring decision — not this rubric.
                  </p>
                </div>
              )}
            </TabsContent>
          )}
        </div>
      </Tabs>
    </PanelShell>
  );
}
