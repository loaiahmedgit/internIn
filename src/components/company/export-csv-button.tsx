"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

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
  function handleExport() {
    const csv = toCsv(headers, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
      <Download className="size-3.5" aria-hidden="true" />
      {label}
    </Button>
  );
}
