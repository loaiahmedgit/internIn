"use client";

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
import { MoreHorizontal, User, FileSearch } from "lucide-react";

export function CandidateTableRow({ row }: { row: CandidateRow }) {
  const profileHref = `/company/candidates/${row.applicationId}`;
  const stage = stageKeyOf(row);

  return (
    <TableRow className="border-navy/8">
      <TableCell className="max-w-48 pl-4">
        {/* prefetch={false}: up to PAGE_SIZE (10) of these render per page,
            and each target is a real authenticated dynamic render (auth +
            company lookup + full candidate detail fetch) — default viewport
            prefetch was firing all 10 as background requests the instant
            this list rendered, queuing behind the serverless instance's
            2-connection DB pool and starving the next real navigation.
            Measured: this was the actual cause of multi-second sidebar
            navigation delays, not query latency. */}
        <Link href={profileHref} prefetch={false} className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal/10 text-xs font-semibold text-teal-ink">
            {row.studentName.charAt(0).toUpperCase()}
          </span>
          <span className="truncate font-medium text-navy hover:text-teal-ink">{row.studentName}</span>
        </Link>
      </TableCell>
      <TableCell className="max-w-52 truncate text-navy/65">
        <a href={`mailto:${row.studentEmail}`} className="hover:text-teal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40">
          {row.studentEmail}
        </a>
      </TableCell>
      <TableCell className="max-w-36 text-navy/65">
        <span className="block truncate" title={row.role}>
          {row.role}
        </span>
      </TableCell>
      <TableCell className="text-navy/65">{formatRecentDate(row.appliedAt)}</TableCell>
      <TableCell>
        <Badge variant="secondary" className={STAGE_CLASS[stage] ?? ""}>
          {STAGE_LABEL[stage] ?? row.status}
        </Badge>
      </TableCell>
      <TableCell className="pr-4 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.studentName}`} />}>
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href={profileHref} prefetch={false} />}>
              <User className="size-4" aria-hidden="true" />
              Open profile
            </DropdownMenuItem>
            {row.submissionId && (
              <DropdownMenuItem render={<Link href={`/company/submissions/${row.submissionId}`} prefetch={false} />}>
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
