import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * One consistent shape for every empty student surface: icon, title, one
 * explanation line, one CTA. Deliberately not a giant centered illustration
 * card — restrained, so it reads as "here's what happens here" rather than
 * a placeholder.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="mt-8 max-w-lg rounded-xl border border-navy/10 bg-white px-6 py-8">
      <div className="flex size-10 items-center justify-center rounded-lg bg-teal/10">
        <Icon className="size-5 text-teal-ink" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-navy">{title}</h2>
      <p className="mt-1.5 text-sm text-navy/60">{description}</p>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-5 inline-flex items-center rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal/90"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
