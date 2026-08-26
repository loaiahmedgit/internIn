const STAGES = ["Applied", "Shortlisted", "Invited"] as const;

const STAGE_INDEX: Record<string, number> = {
  applied: 0,
  shortlisted: 1,
  invited: 2,
};

/**
 * The application's real pipeline (applied -> shortlisted -> invited),
 * shown as evidence progressing rather than a status word — the product's
 * actual story is proof accumulating stage by stage, not a static label.
 */
export function StatusRail({ status }: { status: string }) {
  if (status === "declined" || status === "withdrawn") {
    return (
      <span className="rounded-full bg-gray-light px-2.5 py-1 text-xs font-medium capitalize text-navy/50">
        {status}
      </span>
    );
  }

  const current = STAGE_INDEX[status] ?? 0;

  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((label, i) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className="flex items-center gap-1">
            <span
              className={`size-1.5 rounded-full ${i <= current ? "bg-teal" : "bg-gray-cool"}`}
              aria-hidden="true"
            />
            <span className={`text-xs font-medium ${i === current ? "text-teal-ink" : "text-navy/40"}`}>
              {label}
            </span>
          </div>
          {i < STAGES.length - 1 && <span className="h-px w-4 bg-gray-cool" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}
