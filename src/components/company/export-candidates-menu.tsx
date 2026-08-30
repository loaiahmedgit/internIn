"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadCsv } from "@/lib/csv-export";
import { Archive, ChevronDown, Download, Users } from "lucide-react";

export function ExportCandidatesMenu({
  headers,
  active,
  archived,
  all,
  archivedCount,
  archiveHref,
  activeHref,
  isArchiveView,
}: {
  headers: string[];
  active: (string | number)[][];
  archived: (string | number)[][];
  all: (string | number)[][];
  archivedCount: number;
  archiveHref: string;
  activeHref: string;
  isArchiveView: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Download className="size-3.5" aria-hidden="true" />
        Export candidates
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem disabled={active.length === 0} onClick={() => downloadCsv("candidates-active.csv", headers, active)}>
          Export active candidates
        </DropdownMenuItem>
        <DropdownMenuItem disabled={archived.length === 0} onClick={() => downloadCsv("candidates-archived.csv", headers, archived)}>
          Export archived candidates
        </DropdownMenuItem>
        <DropdownMenuItem disabled={all.length === 0} onClick={() => downloadCsv("candidates-all.csv", headers, all)}>
          Export all candidates
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={isArchiveView ? activeHref : archiveHref} />}>
          {isArchiveView ? <Users aria-hidden="true" /> : <Archive aria-hidden="true" />}
          <span className="flex min-w-0 flex-1 items-center justify-between gap-4">
            {isArchiveView ? "Back to active candidates" : "View archived candidates"}
            {!isArchiveView && <span className="tabular-nums text-navy/45">{archivedCount}</span>}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
