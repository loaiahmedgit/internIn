"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Clock, FileText, ExternalLink } from "lucide-react";
import { CHALLENGE_ITEM_KIND_LABEL, type ChallengeDraft } from "@/lib/ai/challenge-clarification-schemas";
import { saveChallengeDraftAction } from "@/lib/opportunities/challenge-draft-actions";

const AI_USAGE_LABEL: Record<NonNullable<ChallengeDraft["aiUsagePolicy"]>, string> = {
  not_allowed: "AI not allowed",
  research_only: "AI allowed for research only",
  allowed_disclose: "AI allowed, must disclose",
  fully_allowed: "AI fully allowed",
};

/**
 * Displays a real, structured ChallengeDraft inline in the Ask internIn
 * conversation — never a giant markdown dump. Opts out of typeset
 * (not-typeset) since it's a real interactive component, not narrative
 * prose. "Save as challenge draft" is the one write/consequent action
 * here, and it's always an explicit click — never automatic — matching
 * the app's draft-first, human-approves policy.
 */
export function ChallengeDraftCard({ draft, opportunityId }: { draft: ChallengeDraft; opportunityId: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState<{ opportunityId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Numbered globally across every section (01, 02, 03…) — a Map built
  // from the flattened item list, never a mutated counter inside render.
  const stepNumberByItem = new Map(draft.sections.flatMap((s) => s.items).map((item, i) => [item, i + 1]));

  function handleSave() {
    if (!opportunityId) return;
    setError(null);
    startTransition(async () => {
      try {
        await saveChallengeDraftAction(opportunityId, draft);
        setSaved({ opportunityId });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save this draft — try again.");
      }
    });
  }

  return (
    <Card className="not-typeset gap-4 rounded-xl border-navy/10 py-4 shadow-none">
      <CardHeader className="gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-teal-ink">Challenge draft</p>
        <CardTitle className="text-lg text-navy">{draft.title}</CardTitle>
        <p className="text-sm text-navy/60">{draft.role}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Scenario</p>
          <p className="mt-1 text-sm text-navy/80">{draft.scenario}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Skills assessed</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {draft.competencies.map((c) => (
              <Badge key={c.name} variant="secondary" title={c.reason}>
                {c.name}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Challenge</p>
          {draft.sections.map((section) => (
            <div key={section.title} className="space-y-2">
              {draft.sections.length > 1 && <p className="text-sm font-medium text-navy">{section.title}</p>}
              <ol className="space-y-2">
                {section.items.map((item) => (
                  <li key={`${section.title}-${item.title}`} className="flex gap-3 text-sm">
                    <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-navy/40">
                      {String(stepNumberByItem.get(item)).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-navy">{item.title}</p>
                      <p className="text-navy/70">{item.prompt}</p>
                      <p className="mt-0.5 text-xs text-navy/45">{CHALLENGE_ITEM_KIND_LABEL[item.kind]}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        {draft.materials.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Materials</p>
            <ul className="mt-1.5 space-y-1">
              {draft.materials.map((m) => (
                <li key={m.name} className="flex items-start gap-1.5 text-sm text-navy/75">
                  <FileText className="mt-0.5 size-3.5 shrink-0 text-navy/40" aria-hidden="true" />
                  <span>
                    <span className="font-medium text-navy">{m.name}</span> — {m.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-navy/70">
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-navy/40" aria-hidden="true" />
            {draft.estimatedMinutes} minutes
          </span>
          {draft.aiUsagePolicy && <span>{AI_USAGE_LABEL[draft.aiUsagePolicy]}</span>}
        </div>

        <Separator />

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Evaluation</p>
          <ul className="mt-1.5 space-y-1.5">
            {draft.evaluationRubric.map((r) => (
              <li key={r.criterion} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-navy/80" title={r.description}>
                  {r.criterion}
                </span>
                <span className="shrink-0 font-medium tabular-nums text-navy">{r.weightPercent}%</span>
              </li>
            ))}
          </ul>
        </div>

        {draft.assumptions && draft.assumptions.length > 0 && (
          <p className="rounded-lg bg-gray-light px-3 py-2 text-xs text-navy/60">
            <span className="font-medium text-navy/70">Assumptions: </span>
            {draft.assumptions.join(" ")} Ask internIn to change any of these if they&apos;re wrong.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {saved ? (
          <div className="flex items-center gap-2 text-sm font-medium text-teal-ink">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Saved as a draft challenge.
            <Link href={`/company/opportunities/${saved.opportunityId}/setup`} className="inline-flex items-center gap-1 underline">
              Review in Challenge Builder <ExternalLink className="size-3" aria-hidden="true" />
            </Link>
          </div>
        ) : opportunityId ? (
          <Button size="sm" onClick={handleSave} disabled={isPending} className="bg-teal text-white hover:bg-teal/90">
            {isPending ? "Saving…" : "Save as challenge draft"}
          </Button>
        ) : (
          <p className="text-xs text-navy/50">Select an internship above to save this as a real challenge draft for it.</p>
        )}
      </CardContent>
    </Card>
  );
}
