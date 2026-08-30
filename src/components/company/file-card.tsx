import { FileText } from "lucide-react";

/** One uploaded file, shown as a clean card — real name + a real link, nothing invented (no fake size/type unless it's actually in the name). */
export function FileCard({ name, url, kind }: { name: string; url: string; kind?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 rounded-lg border border-navy/10 bg-white px-3 py-2.5 transition-colors hover:border-teal/30 hover:bg-teal/5"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-navy/5 text-navy/50">
        <FileText className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-navy">{name}</span>
        {kind && <span className="block text-xs text-navy/45">{kind}</span>}
      </span>
    </a>
  );
}
