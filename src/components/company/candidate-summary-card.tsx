import type { LucideIcon } from "lucide-react";

export function CandidateSummaryCard({
  icon: Icon,
  iconColor,
  label,
  value,
}: {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  value: number;
}) {
  return (
    <div className="h-20 rounded-xl border border-navy/10 bg-white px-5">
      <div className="flex h-full -translate-y-px items-center gap-3.5">
        <span className="flex w-7 shrink-0 items-center justify-center" aria-hidden="true">
          <Icon className={`size-5 stroke-2 ${iconColor}`} />
        </span>
        <div className="min-w-0 text-left">
          <p className="text-2xl leading-none font-semibold tabular-nums tracking-tight text-navy">{value}</p>
          <p className="mt-1 truncate text-xs leading-4 text-navy/50">{label}</p>
        </div>
      </div>
    </div>
  );
}
