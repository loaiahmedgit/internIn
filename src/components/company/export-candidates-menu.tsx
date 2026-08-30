"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadCsv } from "@/lib/csv-export";
import { ChevronDown, Download } from "lucide-react";

export function ExportCandidatesMenu({
  headers,
  active,
  archived,
  all,
}: {
  headers: string[];
  active: (string | number)[][];
  archived: (string | number)[][];
  all: (string | number)[][];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Download className="size-3.5" aria-hidden="true" />
        Export candidates
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={active.length === 0} onClick={() => downloadCsv("candidates-active.csv", headers, active)}>
          Export active candidates
        </DropdownMenuItem>
        <DropdownMenuItem disabled={archived.length === 0} onClick={() => downloadCsv("candidates-archived.csv", headers, archived)}>
          Export archived candidates
        </DropdownMenuItem>
        <DropdownMenuItem disabled={all.length === 0} onClick={() => downloadCsv("candidates-all.csv", headers, all)}>
          Export all candidates
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
