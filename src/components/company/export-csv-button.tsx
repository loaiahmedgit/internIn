"use client";

import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv-export";
import { Download } from "lucide-react";

/**
 * Real client-side export of exactly the rows currently rendered — no
 * server round-trip, no fields beyond what's already on screen.
 */
export function ExportCsvButton({
  filename,
  headers,
  rows,
  label = "Export",
}: {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  label?: string;
}) {
  return (
    <Button variant="outline" size="sm" onClick={() => downloadCsv(filename, headers, rows)} disabled={rows.length === 0}>
      <Download className="size-3.5" aria-hidden="true" />
      {label}
    </Button>
  );
}
