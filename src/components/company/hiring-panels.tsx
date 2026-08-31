import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { percent, type hiringMetrics } from "@/lib/company/hiring-metrics";

export function HiringHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-navy">
          {title}
        </h1>
        <p className="mt-1 text-sm text-navy/60">{description}</p>
      </div>
      {actions}
    </header>
  );
}
// Icon tint (soft circular background) keyed off the same text-color class
// passed as `color` — one lookup, so every metric card's icon circle and
// icon color always come from the same hue instead of two hand-picked
// values that can drift apart.
const ICON_TINT: Record<string, string> = {
  "text-teal-ink": "bg-teal/10",
  "text-blue-600": "bg-blue-500/10",
  "text-amber-600": "bg-amber-500/10",
  "text-emerald-600": "bg-emerald-500/10",
  "text-rose-600": "bg-rose-500/10",
};

export function HiringMetric({
  icon: Icon,
  color,
  label,
  value,
  detail,
  delta,
  deltaTone = "neutral",
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  value: string | number;
  /** Plain muted caption — for a fact with no meaningful trend (e.g. "Awaiting response"). */
  detail?: string;
  /** A real period-over-period comparison — takes over from `detail` when present. */
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
}) {
  const deltaColor =
    deltaTone === "positive" ? "text-emerald-600" : deltaTone === "negative" ? "text-red-600" : "text-navy/55";
  return (
    <div className="rounded-xl border border-navy/10 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${ICON_TINT[color] ?? "bg-navy/8"}`}>
          <Icon aria-hidden="true" className={`size-4 ${color}`} />
        </span>
        <div className="min-w-0">
          <p className="text-xl leading-tight font-semibold tracking-tight text-navy tabular-nums">{value}</p>
          <p className="text-xs font-medium text-navy/70">{label}</p>
        </div>
      </div>
      {(delta ?? detail) && <p className={`mt-2 text-[11px] ${delta ? deltaColor : "text-navy/55"}`}>{delta ?? detail}</p>}
    </div>
  );
}
export function HiringPanel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-xl border border-navy/10 bg-white p-4 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-navy">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-navy/60">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function HiringFunnel({
  metrics,
}: {
  metrics: ReturnType<typeof hiringMetrics>;
}) {
  // Offers can bypass shortlisting; do not invent a sequential interview funnel.
  const steps = [
    { label: "Applicants", value: metrics.applicants, color: "fill-teal/20" },
    { label: "Offers sent", value: metrics.offers, color: "fill-emerald-100" },
    {
      label: "Offers accepted",
      value: metrics.accepted,
      color: "fill-emerald-200",
    },
  ];
  return (
    <>
      <div className="grid grid-cols-[minmax(80px,0.8fr)_1.4fr] items-center gap-4">
        <svg
          viewBox="0 0 160 210"
          className="w-full"
          role="img"
          aria-label="Hiring funnel; exact counts are listed alongside"
        >
          {steps.map((s, i) => (
            <g key={s.label}>
              <path
                d={`M${i * 18} ${i * 70} H${160 - i * 18} L${142 - i * 18} ${i * 70 + 66} H${18 + i * 18} Z`}
                className={s.color}
              />
              <text
                x="80"
                y={i * 70 + 38}
                textAnchor="middle"
                className="fill-navy text-[14px] font-semibold"
              >
                {s.value}
              </text>
            </g>
          ))}
        </svg>
        <table className="w-full text-xs">
          <thead className="text-navy/65">
            <tr>
              <th className="pb-3 text-left font-medium">Stage</th>
              <th className="pb-3 text-right font-medium">Count</th>
              <th className="pb-3 pl-2 text-right font-medium">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => (
              <tr key={s.label} className="border-t border-navy/8">
                <td className="py-4 text-navy">{s.label}</td>
                <td className="text-right tabular-nums text-navy">{s.value}</td>
                <td className="pl-2 text-right tabular-nums text-navy/70">
                  {i
                    ? percent(s.value, steps[i - 1].value)
                    : metrics.applicants
                      ? "100%"
                      : "0%"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between gap-3 rounded-md bg-gray-light px-3 py-2 text-xs text-navy/70">
        <span>Applicant-to-hire conversion</span>
        <span className="font-medium tabular-nums text-navy">
          {percent(metrics.accepted, metrics.applicants)}
        </span>
      </div>
    </>
  );
}
export function ApplicantBars({
  rows,
}: {
  rows: { id: string; role: string; count: number }[];
}) {
  const max = Math.max(
    4,
    Math.ceil(Math.max(0, ...rows.map((r) => r.count)) / 4) * 4,
  );
  if (!rows.length)
    return (
      <p className="text-sm text-navy/60">No internships in this period.</p>
    );
  return (
    <div
      className="overflow-x-auto pb-2"
      role="region"
      aria-label="Applicants by internship bar chart"
      tabIndex={0}
    >
      <div
        className="flex gap-2 pt-6"
        style={{ minWidth: Math.max(220, rows.length * 52 + 28) }}
      >
        <div
          className="relative h-36 w-6 shrink-0 text-right text-[10px] text-navy/60"
          aria-hidden="true"
        >
          {[4, 3, 2, 1, 0].map((step) => (
            <span
              key={step}
              className="absolute right-0 -translate-y-1/2 tabular-nums"
              style={{ top: `${100 - step * 25}%` }}
            >
              {(max * step) / 4}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-36"
            aria-hidden="true"
          >
            {[0, 25, 50, 75, 100].map((top) => (
              <div
                key={top}
                className="absolute inset-x-0 border-t border-navy/8"
                style={{ top: `${top}%` }}
              />
            ))}
          </div>
          <div
            className="relative grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`,
            }}
          >
            {rows.map((r) => (
              <div key={r.id} className="min-w-0 text-center">
                <div className="flex h-36 items-end justify-center px-2">
                  <div
                    className="relative w-full max-w-10 rounded-t-sm bg-teal-ink"
                    style={{ height: `${(r.count / max) * 100}%` }}
                  >
                    <span className="absolute -top-5 inset-x-0 text-xs font-medium tabular-nums text-navy">
                      {r.count}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-navy/75">
                  {r.role}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
export function StageDistribution({
  rows,
}: {
  rows: { label: string; value: number; color: string }[];
}) {
  const total = rows.reduce((n, r) => n + r.value, 0);
  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <svg
        viewBox="0 0 120 120"
        className="w-32 shrink-0"
        role="img"
        aria-label={`${total} applicants by current stage; breakdown alongside`}
      >
        <circle
          cx="60"
          cy="60"
          r="44"
          fill="none"
          stroke="#F3F5F7"
          strokeWidth="22"
        />
        {rows
          .filter((r) => r.value)
          .map((r, index, visible) => {
            const length = (r.value / total) * 100;
            const start =
              (visible
                .slice(0, index)
                .reduce((sum, item) => sum + item.value, 0) /
                total) *
              100;
            return (
              <circle
                key={r.label}
                cx="60"
                cy="60"
                r="44"
                fill="none"
                stroke={r.color}
                strokeWidth="22"
                pathLength="100"
                strokeDasharray={`${length} ${100 - length}`}
                strokeDashoffset={-start}
                transform="rotate(-90 60 60)"
              />
            );
          })}
        <text
          x="60"
          y="65"
          textAnchor="middle"
          className="fill-navy text-[18px] font-semibold"
        >
          {total}
        </text>
      </svg>
      <ul className="min-w-40 flex-1 space-y-2.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-xs">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: r.color }}
            />
            <span className="flex-1 text-navy/75">{r.label}</span>
            <span className="tabular-nums text-navy">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
export function HiringTrend({
  points,
}: {
  points: { date: string; count: number }[];
}) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const xy = points.map((p, i) => ({
    x: 32 + (i / Math.max(1, points.length - 1)) * 280,
    y: 150 - (p.count / max) * 120,
  }));
  const date = (value: string) =>
    new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(value));
  return (
    <>
      <svg
        viewBox="0 0 340 185"
        className="w-full"
        role="img"
        aria-label="Applications received over time"
      >
        <line x1="32" y1="150" x2="315" y2="150" stroke="#C7CDD3" />
        {[0, max].map((n) => (
          <text
            key={n}
            x="24"
            y={154 - (n / max) * 120}
            textAnchor="end"
            className="fill-navy/65 text-[11px]"
          >
            {n}
          </text>
        ))}
        <polyline
          points={xy.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#087F78"
          strokeWidth="2"
        />
        {points.map((p, i) => (
          <g key={p.date}>
            <circle
              cx={xy[i].x}
              cy={xy[i].y}
              r="3"
              fill="white"
              stroke="#087F78"
              strokeWidth="2"
            >
              <title>{`${date(p.date)}: ${p.count} applicants`}</title>
            </circle>
            {(i === 0 ||
              i === points.length - 1 ||
              i === Math.floor(points.length / 2)) && (
              <text
                x={xy[i].x}
                y="178"
                textAnchor="middle"
                className="fill-navy/65 text-[10px]"
              >
                {date(p.date)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <details className="mt-2 text-xs text-navy/65">
        <summary className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-teal">
          View activity data
        </summary>
        <ul className="mt-2 space-y-1">
          {points.map((p) => (
            <li key={p.date} className="flex justify-between">
              <span>From {date(p.date)}</span>
              <span>{p.count}</span>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
