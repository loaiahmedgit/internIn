"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MapPin,
  Monitor,
  Sparkles,
  XIcon,
} from "lucide-react";
import { ApplyButton } from "@/components/opportunities/apply-button";
import { SaveButton } from "@/components/opportunities/save-button";
import { ChallengeResourcesList, type ChallengeResourceListItem } from "@/components/opportunities/challenge-resources-list";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveScrollPosition, useRestoreScrollPosition } from "@/lib/scroll-preservation";

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
  saved: boolean;
  challenge?: { title: string; taskCount: number; estimatedMinutes: number };
  /** Real resources for this challenge's current version — name/kind
   * always shown; a download link only renders once `hasApplied` (see
   * ChallengeResourcesList, which itself only ever links a `ready` row). */
  resources: ChallengeResourceListItem[];
  /** Real submission-requirement labels, shown as a plain deliverables list. */
  deliverables: string[];
  /** Before applying: resource names/kinds only, no download links — this
   * is the whole point of fetching the dialog's data server-side per
   * request rather than exposing every resource's link to any visitor. */
  hasApplied: boolean;
  /** Present only when the student has already applied — drives the
   * primary CTA (continue/open) instead of "Apply now". */
  application?: { id: string; ctaLabel: string };
}

/**
 * Large centered Dialog for the Explore opportunity detail. Content is
 * split into tabs (Overview / Challenge / What you'll learn) matching the
 * approved design reference — only real fields get a tab; there's no
 * "Company" tab since there's no real company-profile data to put in it.
 * Closed by default — it only opens when `opportunity` is non-null (driven
 * by the `?opportunity=` URL param on the server). Closing it (X, overlay,
 * Escape) navigates back to `closeHref`, which strips that param.
 */
export function OpportunityDetailSheet({
  opportunity,
  closeHref,
}: {
  opportunity: OpportunityDetail | null;
  closeHref: string;
}) {
  const router = useRouter();
  useRestoreScrollPosition();

  return (
    <DialogPrimitive.Root
      open={Boolean(opportunity)}
      onOpenChange={(open) => {
        if (!open) {
          saveScrollPosition();
          router.push(closeHref, { scroll: false });
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 duration-150 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white text-navy shadow-2xl outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 sm:h-auto sm:max-h-[88vh] sm:w-[900px] lg:w-[1100px]">
          {opportunity && (
            <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col gap-0">
              <div className="relative shrink-0 border-b border-navy/8 px-5 pt-4 sm:px-7 sm:pt-5">
                <div className="flex items-start gap-3 pr-9">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-base font-semibold text-teal-ink" aria-hidden="true">
                    {opportunity.companyName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-navy/62">{opportunity.companyName}</p>
                      {opportunity.companyVerified && <BadgeCheck className="size-3.5 shrink-0 text-teal-ink" aria-label="Verified company" />}
                    </div>
                    <DialogPrimitive.Title className="mt-0.5 text-balance text-xl font-semibold tracking-[-0.025em] text-navy sm:text-2xl">
                      {opportunity.role}
                    </DialogPrimitive.Title>
                  </div>
                  <SaveButton opportunityId={opportunity.id} initialSaved={opportunity.saved} className="hover:bg-teal/5" />
                </div>

                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-navy/56">
                  <span className="flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true" />{opportunity.location}</span>
                  {opportunity.workMode && <span className="flex items-center gap-1.5"><Monitor className="size-3.5" aria-hidden="true" />{WORK_MODE_LABEL[opportunity.workMode]}</span>}
                  <span className="flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" />{opportunity.duration}</span>
                  <span className="flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5" aria-hidden="true" />{opportunity.hoursPerWeek}h/week</span>
                  <span className="flex items-center gap-1.5">
                    <CalendarClock className="size-3.5" aria-hidden="true" />
                    {opportunity.applicationDeadline ? `Apply by ${deadlineFormatter.format(opportunity.applicationDeadline)}` : "No deadline set"}
                  </span>
                </div>

                <DialogPrimitive.Close
                  render={<Button variant="ghost" size="icon-sm" className="absolute top-3 right-3 sm:top-4 sm:right-4" />}
                >
                  <XIcon aria-hidden="true" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>

                <TabsList variant="line" className="h-auto w-full justify-start gap-4 p-0">
                  <TabsTrigger value="overview" className="h-9 flex-none px-0.5 text-sm data-active:font-medium data-active:text-teal-ink">Overview</TabsTrigger>
                  {opportunity.challenge && <TabsTrigger value="challenge" className="h-9 flex-none px-0.5 text-sm data-active:font-medium data-active:text-teal-ink">Challenge</TabsTrigger>}
                  {opportunity.whatYouWillLearn && <TabsTrigger value="learn" className="h-9 flex-none px-0.5 text-sm data-active:font-medium data-active:text-teal-ink">What you&apos;ll learn</TabsTrigger>}
                </TabsList>
              </div>

              <div className="min-h-0 flex-1">
                <TabsContent value="overview" className="h-full overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                  <section aria-labelledby="about-heading">
                    <h3 id="about-heading" className="text-sm font-semibold text-navy">About</h3>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-navy/68">{opportunity.shortDescription || opportunity.description}</p>
                  </section>

                  {opportunity.requirements.length > 0 && (
                    <section className="mt-6 border-t border-navy/8 pt-6" aria-labelledby="requirements-heading">
                      <h3 id="requirements-heading" className="text-sm font-semibold text-navy">What you&apos;ll do</h3>
                      <ul className="mt-2 space-y-1.5">
                        {opportunity.requirements.map((requirement) => (
                          <li key={requirement} className="flex items-start gap-2 text-sm leading-6 text-navy/64">
                            <CheckCircle2 className="mt-1 size-3.5 shrink-0 text-teal-ink" aria-hidden="true" />
                            <span>{requirement}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {opportunity.skills.length > 0 && (
                    <section className="mt-6 border-t border-navy/8 pt-6" aria-labelledby="key-skills-heading">
                      <h3 id="key-skills-heading" className="text-sm font-semibold text-navy">Skills</h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {opportunity.skills.map((skill) => (
                          <span key={skill} className="rounded-full border border-navy/10 bg-[#f7f9fa] px-2.5 py-1 text-xs text-navy/62">{skill}</span>
                        ))}
                      </div>
                    </section>
                  )}
                </TabsContent>

                {opportunity.challenge && (
                  <TabsContent value="challenge" className="h-full overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-teal-ink">
                      <Sparkles className="size-3.5" aria-hidden="true" />
                      Work Challenge
                      <span className="ml-auto flex items-center gap-1 rounded-full bg-teal/8 px-2 py-0.5 text-xs font-medium text-teal-ink">
                        <Clock3 className="size-3" aria-hidden="true" />
                        ~{opportunity.challenge.estimatedMinutes} minutes
                      </span>
                    </div>
                    <p className="mt-2 text-base font-semibold text-navy">{opportunity.challenge.title}</p>
                    <p className="mt-1 text-sm leading-6 text-navy/64">{opportunity.shortDescription || opportunity.description}</p>

                    <div className="mt-4 rounded-xl bg-teal/5 p-3.5">
                      <p className="text-xs font-semibold text-teal-ink">Why this challenge?</p>
                      <p className="mt-1 text-xs leading-5 text-navy/60">
                        This challenge simulates real work you&apos;d do as a {opportunity.role} at {opportunity.companyName}
                        {opportunity.skills.length > 0 ? ` — using ${opportunity.skills.slice(0, 2).join(" and ")}` : ""}. It helps us both see how you think through a real problem, not just what&apos;s on your CV.
                      </p>
                    </div>

                    {opportunity.resources.length > 0 && (
                      <div className="mt-5">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Resources provided</h4>
                        {opportunity.hasApplied ? (
                          <ChallengeResourcesList resources={opportunity.resources} />
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {opportunity.resources.map((resource) => (
                              <span key={resource.id} className="rounded-full border border-navy/10 bg-[#f7f9fa] px-2.5 py-1 text-xs text-navy/62">
                                {resource.name} · {resource.artifactKind.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        )}
                        {!opportunity.hasApplied && (
                          <p className="mt-1.5 text-xs text-navy/45">Apply to download these materials.</p>
                        )}
                      </div>
                    )}

                    {opportunity.deliverables.length > 0 && (
                      <div className="mt-5">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Submission requirements</h4>
                        <ul className="mt-2 space-y-1">
                          {opportunity.deliverables.map((deliverable) => (
                            <li key={deliverable} className="flex items-start gap-2 text-sm leading-6 text-navy/64">
                              <CheckCircle2 className="mt-1 size-3.5 shrink-0 text-teal-ink" aria-hidden="true" />
                              <span>{deliverable}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </TabsContent>
                )}

                {opportunity.whatYouWillLearn && (
                  <TabsContent value="learn" className="h-full overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                    <h3 className="text-sm font-semibold text-navy">What you&apos;ll learn</h3>
                    <p className="mt-1.5 text-sm leading-6 text-navy/64">{opportunity.whatYouWillLearn}</p>
                  </TabsContent>
                )}
              </div>
            </Tabs>
          )}
          {opportunity && (
            <div className="flex shrink-0 items-center gap-2 border-t border-navy/8 px-5 py-4 sm:px-7">
              <div className="min-w-0 flex-1">
                {opportunity.application ? (
                  <Button render={<Link href={`/student/applications/${opportunity.application.id}`} />} nativeButton={false} className="h-10 w-full bg-teal px-4 text-white hover:bg-teal-ink">
                    {opportunity.application.ctaLabel}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                ) : (
                  <ApplyButton opportunityId={opportunity.id} label="Apply now" className="h-10 w-full bg-teal px-4 text-white hover:bg-teal-ink" />
                )}
              </div>
              <SaveButton opportunityId={opportunity.id} initialSaved={opportunity.saved} showLabel className="h-10 border border-navy/12 bg-white hover:border-teal/25 hover:bg-teal/5" />
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
