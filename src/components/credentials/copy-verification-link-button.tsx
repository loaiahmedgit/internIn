"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

/** The full verification URL is computed server-side (getSiteUrl() +
 * verification code) and passed in — never hardcode localhost/a preview
 * Vercel URL, and never re-derive it from window.location here (that
 * would silently point at whatever host the viewer happens to be on). */
export function CopyVerificationLinkButton({ url }: { url: string }) {
  function copy() {
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Verification link copied"))
      .catch(() => toast.error("Couldn't copy the link"));
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-navy/12 bg-white px-3.5 text-sm font-medium text-navy transition-colors hover:border-teal/25 hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
    >
      <Copy className="size-3.5" aria-hidden="true" />
      Copy verification link
    </button>
  );
}
