export function StudentPageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">{eyebrow}</p>
      <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm text-navy/60">{description}</p>}
    </div>
  );
}
