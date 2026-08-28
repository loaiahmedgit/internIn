import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

/**
 * No secondary "+N vs last 30 days" line — that would need a real
 * historical-delta computation (event_log has the raw events, but nothing
 * derives a trend from it yet) and a rushed version would look fabricated.
 * Omitted rather than guessed, per the brief.
 */
export function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <Card className="rounded-xl border border-navy/10 shadow-none ring-0">
      <CardContent className="flex items-start gap-3 px-4">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-teal/10">
          <Icon className="size-4 text-teal-ink" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-navy/55">{label}</p>
          <p className="text-2xl font-semibold tracking-[-0.02em] text-navy">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
