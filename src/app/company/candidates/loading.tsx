import { CompanyPageContainer } from "@/components/company/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

/**
 * Matches the real Candidates page: breadcrumb, header, 4 KPI summary
 * cards, a tab bar + filters row, then a 6-column table of rows — the
 * same shape the CandidateTableRow-backed table renders once data
 * resolves, so the skeleton never causes a layout jump.
 */
export default function CandidatesLoading() {
  return (
    <CompanyPageContainer>
      <Skeleton className="h-3 w-32" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-1.5 h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-navy/10 bg-white p-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="mt-2 h-6 w-10" />
            <Skeleton className="mt-1.5 h-3 w-20" />
          </div>
        ))}
      </div>

      <Card className="mt-4 rounded-xl border border-navy/10 shadow-none ring-0">
        <CardContent className="px-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/8 px-4 py-2.5">
            <div className="flex gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-20" />
              ))}
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-56 rounded-lg" />
              <Skeleton className="h-8 w-40 rounded-lg" />
            </div>
          </div>
          <Table>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="border-navy/8">
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-8 shrink-0 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell className="pr-4 text-right"><Skeleton className="ml-auto h-4 w-4" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </CompanyPageContainer>
  );
}
