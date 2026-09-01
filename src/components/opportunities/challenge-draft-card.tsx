"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { CheckCircle2, ChevronRight, Clock, FileText, MoreHorizontal, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { AI_USAGE_MODE_LABEL, DELIVERABLE_TYPE_LABEL, type ChallengeDraft } from "@/lib/ai/challenge-clarification-schemas";
import { saveChallengeDraftAction } from "@/lib/opportunities/challenge-draft-actions";
import { ChallengeDraftEditForm } from "@/components/opportunities/challenge-draft-edit-form";

/**
 * A real, structured ChallengeDraft rendered as a wide document — not an
 * AI message card. Deliberately minimal outer chrome (a thin border, no
 * shadow, no giant rounded panel): hierarchy comes from typography,
 * whitespace, and thin dividers, the same way a Notion/Linear document
 * reads. Two columns on desktop (main content ~65%, summary rail ~35%),
 * collapsing to one column below `md`. Opts out of typeset throughout.
 */
export function ChallengeDraftCard({
  draft,
  opportunityId,
  disabled,
  onRequestAiEdit,
  onManualSave,
}: {
  draft: ChallengeDraft;
  opportunityId: string | null;
  disabled?: boolean;
  /** Dispatches a natural-language revision instruction through the same
   * chat pipeline a typed edit would use ("make task 2 easier") — the
   * server reuses this SAME draft's id (see challenge-generation.ts's
   * attachDraftIdentity), never starting a disconnected new one. */
  onRequestAiEdit: (instruction: string) => void;
  /** Writes a manually-edited draft back into the SAME message part (via
   * useChat's setMessages in the parent) so a later chat edit still sees
   * the manual changes — manual editing isn't a dead end. */
  onManualSave: (next: ChallengeDraft) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saved, setSaved] = useState<{ opportunityId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleUseChallenge() {
    if (!opportunityId) return;
    setError(null);
    startTransition(async () => {
      try {
        await saveChallengeDraftAction(opportunityId, draft);
        setSaved({ opportunityId });
        setConfirmOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save this challenge — try again.");
      }
    });
  }

  return (
    <div className="not-typeset w-full rounded-lg border border-navy/10 bg-white">
      {/* Header: identity + attachment status + primary actions, all in one
          compact strip — never a separate giant gray attachment panel. */}
      <div className="border-b border-navy/10 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-teal-ink">Challenge draft</p>
              <Badge variant={draft.status === "approved" ? "default" : "secondary"} className="h-5 px-1.5 text-[10px]">
                {draft.status === "approved" ? "Used" : "Draft"}
              </Badge>
            </div>
            <h3 className="mt-1 truncate text-xl font-semibold text-navy">{draft.title}</h3>
            <p className="text-sm text-navy/55">{draft.role}</p>
          </div>
          {/* Attachment status: one compact line, never a large panel. */}
          <p className="shrink-0 text-xs text-navy/50">
            {saved ? (
              <Link href={`/company/opportunities/${saved.opportunityId}/setup`} className="font-medium text-teal-ink hover:underline">
                Saved · Review in Challenge Builder
              </Link>
            ) : opportunityId ? (
              "Will attach to this internship"
            ) : (
              <>
                Not attached ·{" "}
                <Link href="/company/internships" className="font-medium text-teal-ink hover:underline">
                  Choose internship
                </Link>
              </>
            )}
          </p>
        </div>

        {!isEditing && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => setIsEditing(true)}>
              <Pencil className="size-3.5" /> Edit
            </Button>
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => onRequestAiEdit("Regenerate this challenge with a different approach.")}>
              <RefreshCw className="size-3.5" /> Regenerate
            </Button>
            <div className="flex-1" />
            {!saved &&
              (opportunityId ? (
                <Button size="sm" className="bg-teal text-white hover:bg-teal/90" disabled={disabled} onClick={() => setConfirmOpen(true)}>
                  Use challenge
                </Button>
              ) : (
                <Link href="/company/opportunities/new">
                  <Button size="sm" className="bg-teal text-white hover:bg-teal/90" disabled={disabled}>
                    Create internship from draft
                  </Button>
                </Link>
              ))}
          </div>
        )}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>

      {isEditing ? (
        <div className="px-5 py-5 sm:px-6">
          <ChallengeDraftEditForm
            draft={draft}
            onCancel={() => setIsEditing(false)}
            onSave={(next) => {
              onManualSave(next);
              setIsEditing(false);
            }}
          />
        </div>
      ) : (
        <div className="grid gap-8 px-5 py-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_280px] lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main column (~65-70%): the work itself. */}
          <div className="min-w-0 space-y-6">
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Scenario</p>
              <p className="mt-1.5 text-sm leading-relaxed text-navy/80">{draft.scenario}</p>
            </section>

            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Tasks</p>
              {/* Compact numbered rows separated by a thin divider — never
                  nested cards. Each row stays a single flowing block:
                  number, title, instructions, deliverable tag, then the
                  per-task action menu. */}
              <ol className="mt-1.5 divide-y divide-navy/10">
                {draft.tasks.map((task, i) => (
                  <li key={task.id} className="flex gap-3 py-3 text-sm first:pt-0 last:pb-0">
                    <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-navy/40">{String(i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-navy">{task.title}</p>
                      <p className="mt-0.5 text-navy/70">{task.instructions}</p>
                      <p className="mt-1 text-xs text-navy/45">Deliverable: {DELIVERABLE_TYPE_LABEL[task.deliverableType]}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        disabled={disabled}
                        aria-label={`Options for ${task.title}`}
                        className="flex size-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-gray-light disabled:pointer-events-none disabled:opacity-50"
                      >
                        <MoreHorizontal className="size-4 text-navy/50" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onRequestAiEdit(`Rewrite task ${i + 1} ("${task.title}") to be clearer.`)}>
                          <Sparkles className="size-3.5" /> Rewrite with AI
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRequestAiEdit(`Make task ${i + 1} ("${task.title}") easier.`)}>Make easier</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRequestAiEdit(`Make task ${i + 1} ("${task.title}") harder.`)}>Make harder</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onRequestAiEdit(`Remove task ${i + 1} ("${task.title}").`)}
                          className="text-destructive focus:text-destructive"
                        >
                          Remove task
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ol>
            </section>

            {draft.materials.length > 0 && (
              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Materials</p>
                {/* File-asset rows — a real filename, not a description. */}
                <ul className="mt-1.5 divide-y divide-navy/10">
                  {draft.materials.map((m) => (
                    <li key={m.id} className="flex items-start gap-2 py-2 text-sm">
                      <FileText className="mt-0.5 size-4 shrink-0 text-navy/40" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="font-medium text-navy">{m.name}</span>
                        {m.description ? <span className="text-navy/60"> — {m.description}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Summary rail (~30-35%): everything an employer scans once,
              never re-reads line by line. */}
          <aside className="min-w-0 space-y-5 md:border-l md:border-navy/10 md:pl-6">
            <div className="space-y-1.5 text-sm text-navy/70">
              {draft.durationMinutes && (
                <p className="flex items-center gap-1.5">
                  <Clock className="size-3.5 text-navy/40" aria-hidden="true" />
                  {draft.durationMinutes} minutes
                </p>
              )}
              {draft.aiUsagePolicyMode && (
                <p className="text-xs text-navy/55">
                  {draft.aiUsagePolicyMode === "custom" && draft.aiUsagePolicyCustomText ? draft.aiUsagePolicyCustomText : AI_USAGE_MODE_LABEL[draft.aiUsagePolicyMode]}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Skills assessed</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {draft.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="font-normal">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Evaluation</p>
              <ul className="mt-1.5 space-y-1.5">
                {draft.rubric.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-navy/80" title={r.description ?? undefined}>
                      {r.criterion}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-navy">{r.weight}%</span>
                  </li>
                ))}
              </ul>
            </div>

            {draft.assumptions.length > 0 && (
              <details className="group rounded-md border border-navy/10 open:bg-gray-light/50">
                <summary className="flex cursor-pointer list-none items-center gap-1 px-2.5 py-2 text-xs font-medium text-navy/60 select-none">
                  <ChevronRight className="size-3 shrink-0 text-navy/40 transition-transform group-open:rotate-90" aria-hidden="true" />
                  Assumptions &amp; constraints
                </summary>
                <div className="space-y-2 px-2.5 pb-2.5">
                  <ul className="list-disc space-y-1 pl-4 text-xs text-navy/60">
                    {draft.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={disabled}
                    className="text-xs font-medium text-teal-ink hover:underline disabled:pointer-events-none disabled:opacity-50"
                    onClick={() => onRequestAiEdit("Review and update the assumptions for this challenge.")}
                  >
                    Edit assumptions
                  </button>
                </div>
              </details>
            )}
          </aside>
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 border-t border-navy/10 px-5 py-3 text-sm font-medium text-teal-ink sm:px-6">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Saved as a draft challenge.
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="not-typeset">
          <DialogHeader>
            <DialogTitle>Use this challenge for {draft.role}?</DialogTitle>
            <DialogDescription>It will be saved as a draft challenge for this internship — still not published to candidates until you review and publish it.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button className="bg-teal text-white hover:bg-teal/90" disabled={isPending} onClick={handleUseChallenge}>
              {isPending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
