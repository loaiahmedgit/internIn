"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";

/**
 * There's no zip-bundling service behind this — each real file gets its own
 * real link. A single "download all" button would either fake a bundle or
 * silently only grab one file, so this lists them honestly instead.
 */
export function DownloadFilesMenu({ files }: { files: { name: string; url: string }[] }) {
  if (files.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Download className="size-3.5" aria-hidden="true" />
        Download files
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Download className="size-3.5" aria-hidden="true" />
        Download files
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {files.map((f) => (
          <DropdownMenuItem key={f.url} render={<a href={f.url} target="_blank" rel="noopener noreferrer" />}>
            {f.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
