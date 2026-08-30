import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

function pageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("ellipsis");
    result.push(sorted[i]);
  }
  return result;
}

export function Pagination({
  page,
  pageSize,
  totalCount,
  buildHref,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  buildHref: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalCount === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <p className="text-xs text-navy/45">
        Showing {start}-{end} of {totalCount}
      </p>
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <Link
            href={buildHref(Math.max(1, page - 1))}
            aria-label="Previous page"
            aria-disabled={page <= 1}
            className={`flex size-8 items-center justify-center rounded-md text-navy/50 transition-colors hover:bg-gray-light hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 ${
              page <= 1 ? "pointer-events-none opacity-40" : ""
            }`}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Link>
          {pageNumbers(page, totalPages).map((p, i) =>
            p === "ellipsis" ? (
              <span key={`e${i}`} className="px-1 text-xs text-navy/40">
                …
              </span>
            ) : (
              <Link
                key={p}
                href={buildHref(p)}
                aria-current={p === page ? "page" : undefined}
                className={`flex size-8 items-center justify-center rounded-md text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 ${
                  p === page ? "bg-teal/10 text-teal-ink" : "text-navy/60 hover:bg-gray-light hover:text-navy"
                }`}
              >
                {p}
              </Link>
            ),
          )}
          <Link
            href={buildHref(Math.min(totalPages, page + 1))}
            aria-label="Next page"
            aria-disabled={page >= totalPages}
            className={`flex size-8 items-center justify-center rounded-md text-navy/50 transition-colors hover:bg-gray-light hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 ${
              page >= totalPages ? "pointer-events-none opacity-40" : ""
            }`}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </nav>
      )}
    </div>
  );
}
