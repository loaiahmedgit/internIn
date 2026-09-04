"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  MapPin,
  Monitor,
  Sparkles,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ApplyButton } from "@/components/opportunities/apply-button";
import { SaveButton } from "@/components/opportunities/save-button";
import { ChallengeResourcesList, type ChallengeResourceListItem } from "@/components/opportunities/challenge-resources-list";
import { Button } from "@/components/ui/button";

const WORK_MODE_LABEL: Record<"remote" | "onsite" | "hybrid", string> = {
  remote: "Remote",
  onsite: "On-site",
  hybrid: "Hybrid",
};

export interface OpportunityDetail {
  id: string;
  role: string;
  companyName: string;
  companyVerified: boolean;
  location: string;
  workMode: "remote" | "onsite" | "hybrid" | null;
  duration: string;
  hoursPerWeek: number;
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
   * is the whole point of fetching the sheet's data server-side per
   * request rather than exposing every resource's link to any visitor. */
  hasApplied: boolean;
  /** Present only when the student has already applied — drives the
   * primary CTA (continue/open) instead of "Apply now". */
  application?: { id: string; ctaLabel: string };
}

/**
 * Closable right-side detail sheet for Explore. Closed by default — it
 * only opens when `opportunity` is non-null (driven by the `?opportunity=`
 * URL param on the server). Closing it (X, overlay, Escape) navigates back
 * to `closeHref`, which strips that param so the list is what a fresh
 * visit or a share link lands on.
 */
export function OpportunityDetailSheet({
  opportunity,
  closeHref,
}: {
  opportunity: OpportunityDetail | null;
  closeHref: string;
}) {
  const router = useRouter();

  return (
    <Sheet
      open={Boolean(opportunity)}
      onOpenChange={(open) => {
        if (!open) router.push(closeHref);
      }}
    >
      <SheetContent className="flex flex-col gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md data-[side=right]:lg:max-w-lg">
        {opportunity && (
          <>
            <SheetHeader className="border-b border-navy/8 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-base font-semibold text-teal-ink" aria-hidden="true">
                  {opportunity.companyName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-navy/62">{opportunity.companyName}</p>
                    {opportunity.companyVerified && <BadgeCheck className="size-3.5 shrink-0 text-teal-ink" aria-label="Verified company" />}
                  </div>
                  <SheetTitle className="mt-0.5 text-balance text-xl font-semibold tracking-[-0.025em] text-navy">{opportunity.role}</SheetTitle>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 px-5 py-5">
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-navy/56">
                <span className="flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true" />{opportunity.location}</span>
                {opportunity.workMode && <span className="flex items-center gap-1.5"><Monitor className="size-3.5" aria-hidden="true" />{WORK_MODE_LABEL[opportunity.workMode]}</span>}
                <span className="flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" />{opportunity.duration}</span>
                <span className="flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5" aria-hidden="true" />{opportunity.hoursPerWeek}h/week</span>
              </div>

              <section aria-labelledby="about-heading">
                <h3 id="about-heading" className="sr-only">About the internship</h3>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-navy/68">{opportunity.shortDescription || opportunity.description}</p>
              </section>

              {opportunity.skills.length > 0 && (
                <section className="mt-5" aria-labelledby="key-skills-heading">
                  <h3 id="key-skills-heading" className="text-sm font-semibold text-navy">Key skills</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {opportunity.skills.map((skill) => (
                      <span key={skill} className="rounded-full border border-navy/10 bg-[#f7f9fa] px-2.5 py-1 text-xs text-navy/62">{skill}</span>
                    ))}
                  </div>
                </section>
              )}

              {opportunity.requirements.length > 0 && (
                <section className="mt-5 border-t border-navy/8 pt-5" aria-labelledby="requirements-heading">
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

              {opportunity.whatYouWillLearn && (
                <section className="mt-5 border-t border-navy/8 pt-5" aria-labelledby="learning-heading">
                  <h3 id="learning-heading" className="text-sm font-semibold text-navy">What you&apos;ll learn</h3>
                  <p className="mt-1.5 text-sm leading-6 text-navy/64">{opportunity.whatYouWillLearn}</p>
                </section>
              )}

              {opportunity.challenge && (
                <section className="mt-5 border-t border-navy/8 pt-5" aria-labelledby="work-challenge-heading">
                  <div id="work-challenge-heading" className="flex items-center gap-1.5 text-sm font-semibold text-teal-ink">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    Work challenge
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-navy">{opportunity.challenge.title}</p>
                  <p className="mt-0.5 text-xs text-navy/52">
                    {opportunity.challenge.taskCount} {opportunity.challenge.taskCount === 1 ? "task" : "tasks"}, about {opportunity.challenge.estimatedMinutes} minutes
                  </p>

                  {opportunity.resources.length > 0 && (
                    <div className="mt-4">
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
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-navy/45">Deliverables</h4>
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
                </section>
              )}
            </div>

            <div className="flex items-start gap-2 border-t border-navy/8 px-5 py-4">
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
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
