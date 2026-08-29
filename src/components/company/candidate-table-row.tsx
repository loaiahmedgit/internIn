"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CandidateRow } from "@/lib/company/candidates-data";
import { stageKeyOf, STAGE_LABEL, STAGE_CLASS } from "@/lib/company/candidate-stage";
import { formatRecentDate } from "@/lib/format-date";
import { MoreHorizontal, Eye, FileSearch } from "lucide-react";

function evidenceSummary(row: CandidateRow): string {
  if (!row.hasSubmission) return "Not submitted";
  if (row.artifacts.length > 0) return `${row.artifacts.length} file${row.artifacts.length === 1 ? "" : "s"}`;
  return "Submitted";
}

export function CandidateTableRow({ row }: { row: CandidateRow }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const drawerHref = (() => {
    const next = new URLSearchParams(searchParams);
    next.set("candidate", row.applicationId);
    return `${pathname}?${next.toString()}`;
  })();

  function openDrawer() {
    router.push(drawerHref, { scroll: false });
  }

  const stage = stageKeyOf(row);

  return (
    <TableRow className="cursor-pointer border-navy/8" onClick={openDrawer}>
      <TableCell className="max-w-48 pl-4">
        <Link href={drawerHref} onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal/10 text-xs font-semibold text-teal-ink">
            {row.studentName.charAt(0).toUpperCase()}
          </span>
          <span className="truncate font-medium text-navy hover:text-teal-ink">{row.studentName}</span>
        </Link>
      </TableCell>
      <TableCell className="max-w-52 truncate text-navy/65">
        <a href={`mailto:${row.studentEmail}`} onClick={(e) => e.stopPropagation()} className="hover:text-teal-ink hover:underline">
          {row.studentEmail}
        </a>
      </TableCell>
      <TableCell className="max-w-36 truncate text-navy/65">{row.role}</TableCell>
      <TableCell className="text-navy/65">{evidenceSummary(row)}</TableCell>
      <TableCell className="text-navy/65">{row.submittedAt ? formatRecentDate(row.submittedAt) : "—"}</TableCell>
      <TableCell>
        <Badge variant="secondary" className={STAGE_CLASS[stage] ?? ""}>
          {STAGE_LABEL[stage] ?? row.status}
        </Badge>
      </TableCell>
      <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.studentName}`} />}>
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={openDrawer}>
              <Eye className="size-4" aria-hidden="true" />
              Open quick view
            </DropdownMenuItem>
            {row.submissionId && (
              <DropdownMenuItem render={<Link href={`/company/submissions/${row.submissionId}`} />}>
                <FileSearch className="size-4" aria-hidden="true" />
                Open full review
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
