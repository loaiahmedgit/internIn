import { CompanyPageContainer } from "@/components/company/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

/** Matches the real Internships page: breadcrumb, header + create action,
 * status tabs + search/sort row, then an 8-column table of postings. */
export default function InternshipsLoading() {
  return (
    <CompanyPageContainer>
      <Skeleton className="h-3 w-28" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-1.5 h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>

      <Card className="mt-4 rounded-xl border border-navy/10 shadow-none ring-0">
        <CardContent className="px-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/8 px-4 py-2.5">
            <div className="flex gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-16" />
              ))}
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-52 rounded-lg" />
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
          </div>
          <Table>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-navy/8">
                  <TableCell className="max-w-56 pl-4"><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-12" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-8" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
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
