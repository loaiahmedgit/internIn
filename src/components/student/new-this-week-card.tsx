import Link from "next/link";
import { MapPin, Monitor } from "lucide-react";

const WORK_MODE_LABEL: Record<"remote" | "onsite" | "hybrid", string> = {
  remote: "Remote",
  onsite: "On-site",
  hybrid: "Hybrid",
};

const VISIBLE_SKILLS = 3;

/**
 * "New this week" discovery card — deliberately lighter-weight than
 * HomeOpportunityCard (thin border, no elevation, smaller radius/type) so
 * the two sections read as distinct: Recommended is "best matches" and
 * earns the heavier treatment, New this week is a quieter fresh-list.
 */
export function NewThisWeekCard({
  opportunity,
  href,
}: {
  opportunity: {
    id: string;
    role: string;
    companyName: string;
    location: string;
    workMode: "remote" | "onsite" | "hybrid" | null;
    skills: string[];
  };
  href: string;
}) {
  const visibleSkills = opportunity.skills.slice(0, VISIBLE_SKILLS);

  return (
    <article className="rounded-xl border border-navy/8 bg-white p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-xs font-semibold text-navy/65" aria-hidden="true">
            {opportunity.companyName.charAt(0).toUpperCase()}
          </div>
          <p className="truncate text-xs text-navy/58">{opportunity.companyName}</p>
        </div>
        <span className="shrink-0 rounded-full bg-teal/10 px-2 py-0.5 text-[10px] font-medium text-teal-ink">New</span>
      </div>

      <Link href={href} className="mt-2 block truncate text-sm font-semibold text-navy hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
        {opportunity.role}
      </Link>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-navy/50">
        <span className="flex items-center gap-1"><MapPin className="size-3" aria-hidden="true" />{opportunity.location}</span>
        {opportunity.workMode && <span className="flex items-center gap-1"><Monitor className="size-3" aria-hidden="true" />{WORK_MODE_LABEL[opportunity.workMode]}</span>}
      </div>

      {visibleSkills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {visibleSkills.map((skill) => (
            <span key={skill} className="rounded-full bg-[#f6f8f9] px-2 py-0.5 text-[11px] text-navy/55">{skill}</span>
          ))}
        </div>
      )}

      <Link href={href} className="mt-2.5 block text-xs font-medium text-teal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
        View details →
      </Link>
    </article>
  );
}
