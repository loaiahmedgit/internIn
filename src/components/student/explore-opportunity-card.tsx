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
        "relative rounded-2xl border bg-white p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(33,50,72,0.07)]",
        selected ? "border-teal shadow-[0_12px_32px_rgba(27,165,156,0.08)]" : "border-navy/10",
      )}
    >
      <div className="flex items-start gap-3.5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-sm font-semibold text-teal-ink" aria-hidden="true">
          {opportunity.companyName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium text-navy/64">{opportunity.companyName}</p>
            {opportunity.companyVerified ? <BadgeCheck className="size-3.5 shrink-0 text-teal-ink" aria-label="Verified company" /> : null}
            {typeof matchScore === "number" && matchScore >= 45 ? (
              <span className="ml-1 rounded-full bg-teal/9 px-2 py-0.5 text-[11px] font-medium text-teal-ink">Strong match</span>
            ) : null}
          </div>
          <Link
            href={href}
            aria-current={selected ? "true" : undefined}
            className="mt-1 block text-lg font-semibold tracking-[-0.025em] text-navy hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
          >
            {opportunity.role}
          </Link>
        </div>
        <SaveButton opportunityId={opportunity.id} initialSaved={saved} className="border border-navy/10 bg-white hover:border-teal/25 hover:bg-teal/5" />
      </div>

      {description ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-navy/58">{description}</p> : null}

      <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-navy/56">
        <span className="flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true" />{opportunity.location}</span>
        {opportunity.workMode ? <span className="flex items-center gap-1.5"><Monitor className="size-3.5" aria-hidden="true" />{WORK_MODE_LABEL[opportunity.workMode]}</span> : null}
        <span className="flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" />{opportunity.duration}</span>
        <span className="flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5" aria-hidden="true" />{opportunity.hoursPerWeek}h/week</span>
      </div>

      {opportunity.skills.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {opportunity.skills.slice(0, 4).map((skill) => (
            <span key={skill} className="rounded-full border border-navy/8 bg-[#f7f9fa] px-2.5 py-1 text-xs text-navy/58">{skill}</span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-navy/8 pt-4">
        <span className="flex items-center gap-1.5 text-xs font-medium text-teal-ink">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {typeof estimatedMinutes === "number" ? `Work challenge, about ${estimatedMinutes} min` : "Opportunity details"}
        </span>
        <Link href={href} className="shrink-0 rounded-md text-sm font-medium text-teal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
          View details
        </Link>
      </div>
    </article>
  );
}
