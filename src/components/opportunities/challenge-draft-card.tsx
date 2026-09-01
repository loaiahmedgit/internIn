"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { CheckCircle2, Clock, FileText, MoreHorizontal, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { AI_USAGE_MODE_LABEL, DELIVERABLE_TYPE_LABEL, type ChallengeDraft } from "@/lib/ai/challenge-clarification-schemas";
import { saveChallengeDraftAction } from "@/lib/opportunities/challenge-draft-actions";
import { ChallengeDraftEditForm } from "@/components/opportunities/challenge-draft-edit-form";

/**
 * Displays a real, structured ChallengeDraft inline in the Ask internIn
 * conversation — a genuine internIn object with an edit/regenerate/use
 * lifecycle, never a giant markdown dump or a one-shot AI message.
 * Opts out of typeset (not-typeset) throughout.
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
   * existing draftOrReviseChallenge tool updates this SAME draft (see
   * challenge-generation.ts's attachDraftIdentity), never a disconnected
   * new one. This is a UI shortcut for a chat edit, not a separate
   * mutation path. */
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

  if (isEditing) {
    return (
      <Card className="not-typeset gap-4 rounded-xl border-navy/10 py-4 shadow-none">
        <CardHeader className="gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-ink">Editing challenge draft</p>
        </CardHeader>
        <CardContent>
          <ChallengeDraftEditForm
            draft={draft}
            onCancel={() => setIsEditing(false)}
            onSave={(next) => {
              onManualSave(next);
              setIsEditing(false);
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="not-typeset gap-4 rounded-xl border-navy/10 py-4 shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div className="gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-ink">Challenge draft</p>
          <CardTitle className="text-lg text-navy">{draft.title}</CardTitle>
          <p className="text-sm text-navy/60">{draft.role}</p>
        </div>
        <Badge variant={draft.status === "approved" ? "default" : "secondary"} className="shrink-0">
          {draft.status === "approved" ? "Used" : "Draft"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Scenario</p>
          <p className="mt-1 text-sm text-navy/80">{draft.scenario}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Skills assessed</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {draft.skills.map((skill) => (
              <Badge key={skill} variant="secondary">{skill}</Badge>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Tasks</p>
          <ol className="space-y-3">
            {draft.tasks.map((task, i) => (
              <li key={task.id} className="flex gap-3 text-sm">
                <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-navy/40">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-navy">{task.title}</p>
                  <p className="text-navy/70">{task.instructions}</p>
                  <p className="mt-0.5 text-xs text-navy/45">{DELIVERABLE_TYPE_LABEL[task.deliverableType]}</p>
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
        </div>

        {draft.materials.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Materials</p>
            <ul className="mt-1.5 space-y-1">
              {draft.materials.map((m) => (
                <li key={m.id} className="flex items-start gap-1.5 text-sm text-navy/75">
                  <FileText className="mt-0.5 size-3.5 shrink-0 text-navy/40" aria-hidden="true" />
                  <span>
                    <span className="font-medium text-navy">{m.name}</span>
                    {m.description ? ` — ${m.description}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-navy/70">
          {draft.durationMinutes && (
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-navy/40" aria-hidden="true" />
              {draft.durationMinutes} minutes
            </span>
          )}
          {draft.aiUsagePolicyMode && (
            <span>{draft.aiUsagePolicyMode === "custom" && draft.aiUsagePolicyCustomText ? draft.aiUsagePolicyCustomText : AI_USAGE_MODE_LABEL[draft.aiUsagePolicyMode]}</span>
          )}
        </div>

        <Separator />

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/45">Evaluation</p>
          <ul className="mt-1.5 space-y-1.5">
            {draft.rubric.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-navy/80" title={r.description ?? undefined}>{r.criterion}</span>
                <span className="shrink-0 font-medium tabular-nums text-navy">{r.weight}%</span>
              </li>
            ))}
          </ul>
        </div>

        {draft.assumptions.length > 0 && (
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
            <Link href={`/company/opportunities/${saved.opportunityId}/setup`} className="underline">
              Review in Challenge Builder
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 border-t border-navy/10 pt-4">
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => onRequestAiEdit("Regenerate this challenge with a different approach.")}>
              <RefreshCw className="size-3.5" /> Regenerate
            </Button>
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => setIsEditing(true)}>
              <Pencil className="size-3.5" /> Edit draft
            </Button>
            {opportunityId ? (
              <Button size="sm" className="bg-teal text-white hover:bg-teal/90" disabled={disabled} onClick={() => setConfirmOpen(true)}>
                Use challenge
              </Button>
            ) : null}
          </div>
        )}

        {!saved && !opportunityId && (
          <div className="rounded-lg bg-gray-light px-3 py-2.5 text-sm text-navy/70">
            <p>This challenge isn&apos;t attached to an internship yet.</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link href="/company/opportunities/new" className="text-xs font-medium text-teal-ink hover:underline">
                Create internship from this
              </Link>
              <Link href="/company/internships" className="text-xs font-medium text-teal-ink hover:underline">
                Choose internship
              </Link>
            </div>
          </div>
        )}
      </CardContent>

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
    </Card>
  );
}
