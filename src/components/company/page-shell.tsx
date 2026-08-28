/**
 * Every Company page shares this exact container and header — the biggest
 * complaint about the old UI was inconsistent widths (one route at a narrow
 * 700px column, another at full viewport). Enforcing it as a wrapper
 * component, not a copy-pasted className string, is what actually prevents
 * drift.
 */
export function CompanyPageContainer({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-screen-2xl px-6 py-8 sm:px-10 sm:py-10 lg:px-12">{children}</div>;
}

export function CompanyPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">{eyebrow}</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.03em] text-navy sm:text-4xl">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-navy/55">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
