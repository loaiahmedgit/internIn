import { CompanyPageContainer } from "@/components/company/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Matches CompanyHomePage's real layout exactly (header, 4 KPI cards, a
 * 2-col pipeline/health row, a 3-col lower activity row) so nothing jumps
 * when the real data swaps in — dimensions are fixed, only the content
 * inside them appears.
 */
export default function DashboardLoading() {
  return (
    <CompanyPageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-navy/10 bg-white p-4">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="mt-3 h-6 w-16" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid items-stretch gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-navy/10 bg-white p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-1.5 h-3 w-56" />
          <Skeleton className="mt-6 h-32 w-full" />
        </div>
        <div className="rounded-xl border border-navy/10 bg-white p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-1.5 h-3 w-48" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-navy/10 bg-white p-4">
            <Skeleton className="h-4 w-28" />
            <div className="mt-4 space-y-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </CompanyPageContainer>
  );
}
