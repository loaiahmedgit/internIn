import { APPLICATION_STAGES, getApplicationStageIndex } from "@/lib/opportunities/application-stage";

/**
 * The application's real hiring funnel, shown as named stages rather than a
 * percentage — percentages are reserved for things with real measurable
 * completion (challenge tasks, profile fields), not for a hiring pipeline.
 */
export function StatusRail({
  status,
  hasSubmission = false,
  hasOffer = false,
}: {
  status: string;
  hasSubmission?: boolean;
  hasOffer?: boolean;
}) {
  if (status === "declined" || status === "withdrawn") {
    return (
      <span className="rounded-full bg-gray-light px-2.5 py-1 text-xs font-medium capitalize text-navy/50">
        {status}
      </span>
    );
  }

  const current = getApplicationStageIndex({ status, hasSubmission, hasOffer });

  return (
    <div className="flex flex-wrap items-center gap-y-1.5">
      {APPLICATION_STAGES.map((label, i) => (
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
          {i < APPLICATION_STAGES.length - 1 && <span className="h-px w-4 bg-gray-cool" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}
