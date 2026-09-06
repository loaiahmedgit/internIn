import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared inner-section treatment for the continuous profile canvas (Phase 1
 * Deploy 2 — "remove the card soup"). Each profile section used to be its
 * own independently rounded+shadowed+bordered card; now every section below
 * the hero shares ONE outer boundary (applied once, in page.tsx) and each
 * section is just a heading + content block separated by a thin border.
 */
export const PROFILE_SECTION_CLASS = "border-b border-navy/8 px-5 py-6 last:border-b-0 sm:px-7";

export function ProfileSectionHeading({
  icon: Icon,
  title,
  headingId,
  action,
}: {
  icon: LucideIcon;
  title: string;
  headingId?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-teal-ink" aria-hidden="true" />
        <h2 id={headingId} className="text-base font-semibold text-navy">{title}</h2>
      </div>
      {action}
    </div>
  );
}
