import { CompanyPageContainer } from "@/components/company/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/** Matches the real Settings page: header, a left tab nav (5 items), and
 * a right content pane of field-shaped rows. */
export default function SettingsLoading() {
  return (
    <CompanyPageContainer>
      <div>
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>

      <div className="mt-9 grid gap-7 lg:grid-cols-[200px_minmax(0,1fr)]">
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
        <div className="min-w-0 lg:border-l lg:border-navy/8 lg:pl-7">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-2 mb-7 h-4 w-72 max-w-full" />
          <div className="space-y-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-2 h-9 w-full max-w-md rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </CompanyPageContainer>
  );
}
