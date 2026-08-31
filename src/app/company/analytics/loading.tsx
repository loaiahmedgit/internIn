import { CompanyPageContainer } from "@/components/company/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/** Matches the real Analytics page: header + date-range control, 4 KPI
 * cards, then 6 chart/breakdown panels in a 3-col grid. */
export default function AnalyticsLoading() {
  return (
    <CompanyPageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-navy/10 bg-white p-4">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="mt-3 h-6 w-16" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>

      <Skeleton className="mt-3 h-3 w-96 max-w-full" />

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-navy/10 bg-white p-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-1.5 h-3 w-24" />
            <div className="mt-5 space-y-2.5">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-3 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </CompanyPageContainer>
  );
}
