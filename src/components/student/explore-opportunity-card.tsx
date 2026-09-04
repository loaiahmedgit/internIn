import Link from "next/link";
import { BadgeCheck, BriefcaseBusiness, Clock3, MapPin, Monitor, Sparkles } from "lucide-react";
import { SaveButton } from "@/components/opportunities/save-button";
import { cn } from "@/lib/utils";

const WORK_MODE_LABEL: Record<"remote" | "onsite" | "hybrid", string> = {
  remote: "Remote",
  onsite: "On-site",
  hybrid: "Hybrid",
};

export function ExploreOpportunityCard({
  opportunity,
  href,
  selected,
  saved,
  estimatedMinutes,
  matchScore,
}: {
  opportunity: {
    id: string;
    role: string;
    companyName: string;
    companyVerified: boolean;
    shortDescription: string | null;
    description: string;
    location: string;
    workMode: "remote" | "onsite" | "hybrid" | null;
    duration: string;
    hoursPerWeek: number;
    skills: string[];
  };
  href: string;
  selected: boolean;
  saved: boolean;
  estimatedMinutes?: number;
  matchScore?: number;
}) {
  const description = opportunity.shortDescription || opportunity.description;

  return (
    <article
      className={cn(
        "relative rounded-xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)] transition-shadow duration-150",
        selected ? "border-teal/45 bg-teal/[0.028]" : "border-black/[0.04] hover:shadow-[0_2px_4px_rgba(16,24,40,0.05),0_14px_32px_-6px_rgba(16,24,40,0.14)]",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-xs font-semibold text-teal-ink" aria-hidden="true">
          {opportunity.companyName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-xs font-medium text-navy/62">{opportunity.companyName}</p>
            {opportunity.companyVerified ? <BadgeCheck className="size-3.5 shrink-0 text-teal-ink" aria-label="Verified company" /> : null}
            {typeof matchScore === "number" && matchScore >= 45 ? (
              <span className="rounded-full bg-teal/9 px-1.5 py-0.5 text-[10px] font-medium text-teal-ink">Strong match</span>
            ) : null}
          </div>
          <Link
            href={href}
            aria-current={selected ? "true" : undefined}
            className="block truncate text-base font-semibold tracking-[-0.015em] text-navy hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
          >
            {opportunity.role}
          </Link>
        </div>
        <SaveButton opportunityId={opportunity.id} initialSaved={saved} className="border border-navy/10 bg-white hover:border-teal/25 hover:bg-teal/5" />
      </div>

      {description ? <p className="mt-1.5 line-clamp-1 text-xs leading-5 text-navy/56">{description}</p> : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy/56">
        <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{opportunity.location}</span>
        {opportunity.workMode ? <span className="flex items-center gap-1"><Monitor className="size-3.5" aria-hidden="true" />{WORK_MODE_LABEL[opportunity.workMode]}</span> : null}
        <span className="flex items-center gap-1"><Clock3 className="size-3.5" aria-hidden="true" />{opportunity.duration}</span>
        <span className="flex items-center gap-1"><BriefcaseBusiness className="size-3.5" aria-hidden="true" />{opportunity.hoursPerWeek}h/week</span>
      </div>

      {opportunity.skills.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {opportunity.skills.slice(0, 3).map((skill) => (
            <span key={skill} className="rounded-full border border-navy/8 bg-[#f7f9fa] px-2 py-0.5 text-[11px] text-navy/58">{skill}</span>
          ))}
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-navy/8 pt-2.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-teal-ink">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {typeof estimatedMinutes === "number" ? `Challenge, ~${estimatedMinutes} min` : "Opportunity details"}
        </span>
        <Link href={href} className="shrink-0 rounded-md text-xs font-medium text-teal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
          View details
        </Link>
      </div>
    </article>
  );
}
