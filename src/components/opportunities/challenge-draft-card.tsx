"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft,
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { type ChallengeDraft, type ChallengeDraftMaterial } from "@/lib/ai/challenge-clarification-schemas";
import { saveChallengeDraftAction } from "@/lib/opportunities/challenge-draft-actions";
import {
  createOpportunityFromChallengeDraftAction,
  listAttachableOpportunitiesAction,
} from "@/lib/opportunities/opportunity-from-challenge-actions";
import { ChallengeDraftEditForm } from "@/components/opportunities/challenge-draft-edit-form";

/** Icon by material type/filename — CSV/XLSX, PDF/DOCX, images,
 * code/archives, generic fallback. Never a hand-drawn SVG (Lucide only,
 * per UI_IMPLEMENTATION_RULES.md). */
function materialIcon(material: Pick<ChallengeDraftMaterial, "type" | "name">): LucideIcon {
  const key = `${material.type} ${material.name}`.toLowerCase();
  if (/\.(csv|xlsx?|tsv)\b|spreadsheet|excel/.test(key)) return FileSpreadsheet;
  if (/\.(png|jpe?g|gif|svg|webp)\b|image/.test(key)) return FileImage;
  if (/\.(zip|tar|gz|rar|7z)\b|archive/.test(key)) return FileArchive;
  if (/\.(json|sql|py|js|ts|ipynb|yaml|yml)\b|code/.test(key)) return FileCode;
  if (/\.(pdf|docx?|txt|md)\b|document|pdf|doc/.test(key)) return FileText;
  return File;
}

/** "a, b, and c" — the compact, human join the Deliverables summary line
 * uses instead of a bulleted restatement of every task. */
function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function estimatedTimeLabel(draft: ChallengeDraft): string | null {
  if (draft.estimatedDurationLabel) return draft.estimatedDurationLabel;
  if (draft.durationMinutes) return `${draft.durationMinutes} minutes`;
  return null;
}

/**
 * The approved Challenge Draft surface — one compact white document
 * embedded in the Ask internIn conversation, matched pixel-for-pixel to
 * the approved reference: header (title/role/scenario/skills), a
 * Tasks | Attachments split, a Deliverables/Estimated-time summary row,
 * a compact Evaluation row, and a subtle attachment-status line. Primary
 * actions (Approve & attach / Edit draft / Start over) sit BELOW the card,
 * never inside it. No difficulty, no sidebars, no per-task menus, no
 * extra sections — this is a deliberately minimal read-state summary;
 * deeper detail lives in Edit mode.
 */
export function ChallengeDraftCard({
  draft,
  opportunityId,
  opportunityLabel,
  disabled,
  onManualSave,
  onStartOver,
}: {
  draft: ChallengeDraft;
  opportunityId: string | null;
  /** Display name of the attached internship, if any — for the compact
   * "Attached to {label}" status line. */
  opportunityLabel?: string | null;
  disabled?: boolean;
  /** Writes a manually-edited draft back into the SAME message part (via
   * useChat's setMessages in the parent) so a later chat edit still sees
   * the manual changes — manual editing isn't a dead end. */
  onManualSave: (next: ChallengeDraft) => void;
  /** Clears the conversation so the employer can describe a fresh
   * internship — only after the confirm dialog below. */
  onStartOver: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [chooseInternshipOpen, setChooseInternshipOpen] = useState(false);
  const [startOverOpen, setStartOverOpen] = useState(false);
  const [saved, setSaved] = useState<{ opportunityId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The "no internship yet" dialog has three steps: the initial choice,
  // the existing-internships list, and a confirm step before attaching —
  // never a silent attach, per the same "no write before confirmation"
  // rule as the existing-internship Approve & attach dialog above.
  const [pickerStep, setPickerStep] = useState<"choose" | "list" | "confirm">("choose");
  const [attachable, setAttachable] = useState<{ id: string; role: string; status: "draft" | "published" }[] | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<{ id: string; role: string } | null>(null);

  function resetPicker() {
    setPickerStep("choose");
    setAttachable(null);
    setSelectedTarget(null);
    setError(null);
  }

  function handleApprove() {
    if (!opportunityId) return;
    setError(null);
    startTransition(async () => {
      try {
        await saveChallengeDraftAction(opportunityId, draft);
        setSaved({ opportunityId });
        setApproveOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save this challenge — try again.");
      }
    });
  }

  /** "Create internship from this draft" — generates a real, pre-filled
   * internship draft from THIS SAME ChallengeDraft (no re-running the
   * assistant router, no re-asking clarification questions, no second
   * draft) and lands on its review-before-publish screen. Never the empty
   * manual /opportunities/new form. */
  function handleCreateFromDraft() {
    setError(null);
    startTransition(async () => {
      try {
        const { opportunityId: newOpportunityId } = await createOpportunityFromChallengeDraftAction(draft);
        setChooseInternshipOpen(false);
        router.push(`/company/opportunities/${newOpportunityId}/setup`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't create the internship draft — try again.");
      }
    });
  }

  function handleShowExistingInternships() {
    setError(null);
    setPickerStep("list");
    startTransition(async () => {
      try {
        const rows = await listAttachableOpportunitiesAction();
        setAttachable(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load your internships — try again.");
        setPickerStep("choose");
      }
    });
  }

  function handleConfirmAttachExisting() {
    if (!selectedTarget) return;
    setError(null);
    startTransition(async () => {
      try {
        await saveChallengeDraftAction(selectedTarget.id, draft);
        setChooseInternshipOpen(false);
        router.push(`/company/opportunities/${selectedTarget.id}/setup`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't attach the challenge — try again.");
      }
    });
  }

  const deliverablesLine = draft.deliverables.length ? joinWithAnd(draft.deliverables) : null;
  const timeLabel = estimatedTimeLabel(draft);

  if (isEditing) {
    return (
      <Card className="not-typeset w-full gap-0 border-border bg-card py-5 shadow-none">
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
    <div className="not-typeset w-full">
      <Card className="gap-0 border-border bg-card py-5 shadow-sm">
        <CardContent className="space-y-4">
          {/* Header: title, role, scenario, skills — no eyebrow label, no
              status badge. "Challenge draft ready" is the assistant's own
              message text above this component, not repeated in here. */}
          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold text-foreground">{draft.title}</h3>
            <p className="text-sm text-muted-foreground">{draft.role}</p>
            <p className="text-sm leading-relaxed text-foreground/80">{draft.scenario}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {draft.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="bg-primary/10 font-normal text-primary hover:bg-primary/10">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Tasks | Attachments — ~65/35, a thin vertical rule on desktop,
              stacked on mobile. No task menus, no per-task borders. */}
          <div className="grid gap-5 sm:grid-cols-[1fr_220px]">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tasks</p>
              <ol className="mt-2.5 space-y-2.5">
                {draft.tasks.map((task, i) => (
                  <li key={task.id} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                      {i + 1}
                    </span>
                    <span className="text-foreground/90">{task.title}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="min-w-0 sm:border-l sm:border-border sm:pl-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attachments</p>
              {draft.materials.length > 0 ? (
                <ul className="mt-2.5 space-y-2.5">
                  {draft.materials.map((material) => {
                    const Icon = materialIcon(material);
                    return (
                      <li key={material.id} className="flex items-start gap-2 text-sm">
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{material.name}</p>
                          {/* Every generated material is conceptual, not a
                              real stored file yet — a fake size/download
                              icon would be fabricated precision. */}
                          <p className="text-xs text-muted-foreground">Draft material</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2.5 text-sm text-muted-foreground">No materials for this challenge.</p>
              )}
            </div>
          </div>

          {(deliverablesLine || timeLabel) && (
            <>
              <div className="border-t border-border" />
              <div className="grid gap-4 sm:grid-cols-2">
                {deliverablesLine && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deliverables</p>
                    <p className="mt-1 text-sm text-foreground/80">{deliverablesLine}.</p>
                  </div>
                )}
                {timeLabel && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estimated time</p>
                    <p className="mt-1 text-sm text-foreground/80">{timeLabel}</p>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="border-t border-border" />

          {/* One compact row, wrapping only when it must — never a chart,
              never per-criterion cards. */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evaluation</p>
            <div className="mt-2.5 flex flex-wrap gap-x-8 gap-y-1.5">
              {draft.rubric.map((r) => (
                <div key={r.id} className="flex items-baseline gap-1.5 text-sm">
                  <span className="text-foreground/80">{r.criterion}</span>
                  <span className="font-medium tabular-nums text-foreground">{r.weight}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Subtle status line — never boxed in another gray panel. */}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden="true" className={`size-1.5 rounded-full ${opportunityId || saved ? "bg-primary" : "bg-muted-foreground/40"}`} />
            {saved || opportunityId
              ? `Attached to ${opportunityLabel ?? "this internship"}`
              : "Not attached to an internship yet"}
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Primary actions live BELOW the card, not inside it. */}
      {!saved && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={disabled}
            onClick={() => (opportunityId ? setApproveOpen(true) : setChooseInternshipOpen(true))}
          >
            Approve &amp; attach
          </Button>
          <Button variant="outline" size="sm" disabled={disabled} onClick={() => setIsEditing(true)}>
            Edit draft
          </Button>
        </div>
      )}
      {!saved && (
        <button
          type="button"
          disabled={disabled}
          className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-50"
          onClick={() => setStartOverOpen(true)}
        >
          Start over
        </button>
      )}
      {saved && (
        <p className="mt-2 text-sm">
          <Link href={`/company/opportunities/${saved.opportunityId}/setup`} className="font-medium text-primary hover:underline">
            Review in Challenge Builder
          </Link>
        </p>
      )}

      {/* Approve & attach — already has an internship: confirm before
          writing anything. */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="not-typeset">
          <DialogHeader>
            <DialogTitle>Use this challenge for {draft.role}?</DialogTitle>
            <DialogDescription>It will be saved as a draft challenge for this internship — still not published to candidates until you review and publish it.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={isPending} onClick={handleApprove}>
              {isPending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve & attach — no internship yet: ask which way to go, never
          silently publish. Three steps: choose, pick an existing
          internship, confirm — never an instant attach. */}
      <Dialog
        open={chooseInternshipOpen}
        onOpenChange={(open) => {
          setChooseInternshipOpen(open);
          if (!open) resetPicker();
        }}
      >
        <DialogContent className="not-typeset">
          {pickerStep === "choose" && (
            <>
              <DialogHeader>
                <DialogTitle>Attach this challenge to an internship</DialogTitle>
                <DialogDescription>This draft isn&apos;t attached to an internship yet.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Button variant="outline" className="w-full justify-start" disabled={isPending} onClick={handleShowExistingInternships}>
                  Attach to an existing internship
                </Button>
                <Button className="w-full justify-start bg-primary text-primary-foreground hover:bg-primary/90" disabled={isPending} onClick={handleCreateFromDraft}>
                  {isPending ? "Preparing internship draft…" : "Create internship from this draft"}
                </Button>
              </div>
            </>
          )}

          {pickerStep === "list" && (
            <>
              <DialogHeader>
                <DialogTitle>Choose an internship</DialogTitle>
                <DialogDescription>Attach &quot;{draft.title}&quot; to one of your existing internships.</DialogDescription>
              </DialogHeader>
              {attachable === null ? (
                <p className="py-4 text-sm text-muted-foreground">Loading your internships…</p>
              ) : attachable.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">You don&apos;t have any draft or open internships yet.</p>
              ) : (
                <ul className="max-h-72 space-y-1 overflow-y-auto">
                  {attachable.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setSelectedTarget({ id: o.id, role: o.role });
                          setPickerStep("confirm");
                        }}
                      >
                        <span className="font-medium text-foreground">{o.role}</span>
                        <Badge variant="secondary" className="font-normal capitalize">{o.status}</Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => setPickerStep("choose")}>
                  <ArrowLeft className="size-3.5" /> Back
                </Button>
              </DialogFooter>
            </>
          )}

          {pickerStep === "confirm" && selectedTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Attach &quot;{draft.title}&quot; to &quot;{selectedTarget.role}&quot;?</DialogTitle>
                <DialogDescription>This replaces any existing challenge draft on that internship — it won&apos;t create a duplicate.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPickerStep("list")}>Cancel</Button>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={isPending} onClick={handleConfirmAttachExisting}>
                  {isPending ? "Attaching…" : "Attach challenge"}
                </Button>
              </DialogFooter>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogContent>
      </Dialog>

      {/* Start over — lightweight confirmation, never a silent discard. */}
      <Dialog open={startOverOpen} onOpenChange={setStartOverOpen}>
        <DialogContent className="not-typeset">
          <DialogHeader>
            <DialogTitle>Start over with a new challenge?</DialogTitle>
            <DialogDescription>This will discard the current draft.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOverOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setStartOverOpen(false); onStartOver(); }}>Start over</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
