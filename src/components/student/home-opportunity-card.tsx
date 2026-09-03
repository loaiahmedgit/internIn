import Link from "next/link";
import { BadgeCheck, BriefcaseBusiness, Clock3, MapPin, Monitor, Zap } from "lucide-react";
import { SaveButton } from "@/components/opportunities/save-button";

const WORK_MODE_LABEL: Record<"remote" | "onsite" | "hybrid", string> = {
  remote: "Remote",
  onsite: "On-site",
  hybrid: "Hybrid",
};

const VISIBLE_SKILLS = 3;

/**
 * Compact Home "Recommended for you" card — deliberately lighter than the
 * shared OpportunityCard (no description, capped skill row): three of
 * these sit side by side and must stay the same height regardless of
 * content, so every card is a flex column with the footer pinned via
 * `mt-auto`. Home-only; Explore/Challenges keep the shared card.
 */
export function HomeOpportunityCard({
  opportunity,
  href,
  saved,
  estimatedMinutes,
}: {
  opportunity: {
    id: string;
    role: string;
    companyName: string;
    companyVerified: boolean;
    location: string;
    workMode: "remote" | "onsite" | "hybrid" | null;
    duration: string;
    hoursPerWeek: number;
    skills: string[];
  };
  href: string;
  saved: boolean;
  estimatedMinutes?: number;
}) {
  const visibleSkills = opportunity.skills.slice(0, VISIBLE_SKILLS);
  const extraSkillCount = opportunity.skills.length - visibleSkills.length;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-black/[0.04] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)] transition-shadow duration-200 hover:shadow-[0_2px_4px_rgba(16,24,40,0.05),0_14px_32px_-6px_rgba(16,24,40,0.14)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-xs font-semibold text-teal-ink" aria-hidden="true">
            {opportunity.companyName.charAt(0).toUpperCase()}
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <p className="truncate text-sm text-navy/62">{opportunity.companyName}</p>
            {opportunity.companyVerified && <BadgeCheck className="size-3.5 shrink-0 text-teal-ink" aria-label="Verified company" />}
          </div>
        </div>
        <SaveButton opportunityId={opportunity.id} initialSaved={saved} />
      </div>

      <Link
        href={href}
        className="mt-2 block text-base font-semibold tracking-[-0.015em] text-navy hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
      >
        {opportunity.role}
      </Link>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy/56">
        <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{opportunity.location}</span>
        {opportunity.workMode && <span className="flex items-center gap-1"><Monitor className="size-3.5" aria-hidden="true" />{WORK_MODE_LABEL[opportunity.workMode]}</span>}
        <span className="flex items-center gap-1"><Clock3 className="size-3.5" aria-hidden="true" />{opportunity.duration}</span>
        <span className="flex items-center gap-1"><BriefcaseBusiness className="size-3.5" aria-hidden="true" />{opportunity.hoursPerWeek}h/week</span>
      </div>

      {visibleSkills.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {visibleSkills.map((skill) => (
            <span key={skill} className="rounded-full border border-navy/7 bg-[#f6f8f9] px-2.5 py-1 text-xs text-navy/58">{skill}</span>
          ))}
          {extraSkillCount > 0 && (
            <span className="rounded-full border border-navy/7 bg-[#f6f8f9] px-2.5 py-1 text-xs text-navy/58">+{extraSkillCount}</span>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-navy/8 pt-3.5">
        {typeof estimatedMinutes === "number" ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-teal-ink">
            <Zap className="size-4 shrink-0" aria-hidden="true" />
            Challenge ~{estimatedMinutes} min
          </span>
        ) : (
          <span />
        )}
        <Link href={href} className="shrink-0 text-sm font-medium text-teal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
          View details →
        </Link>
      </div>
    </article>
  );
}
