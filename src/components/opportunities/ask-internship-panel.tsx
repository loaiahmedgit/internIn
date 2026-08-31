import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

/**
 * Ask internIn is now a real main workspace page (/company/assistant), not
 * a per-page popover — this button just deep-links into it pre-scoped to
 * the internship being viewed, so the same single assistant surface
 * handles both entry points instead of two divergent implementations.
 */
export function AskInternshipPanel({ opportunityId }: { opportunityId: string; role: string }) {
  return (
    <Button variant="outline" size="sm" className="gap-1.5" render={<Link href={`/company/assistant?opportunity=${opportunityId}`} />} nativeButton={false}>
      <Sparkles className="size-3.5 text-teal-ink" aria-hidden="true" />
      Ask internIn
    </Button>
  );
}
