"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const profileHref = `/company/candidates/${row.applicationId}`;
  const stage = stageKeyOf(row);

  return (
    <TableRow className="cursor-pointer border-navy/8" onClick={() => router.push(profileHref)}>
      <TableCell className="max-w-48 pl-4">
        <Link href={profileHref} onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center gap-2">
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
      <TableCell className="text-navy/65">{formatRecentDate(row.appliedAt)}</TableCell>
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
            <DropdownMenuItem render={<Link href={profileHref} />}>
              <User className="size-4" aria-hidden="true" />
              Open profile
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
