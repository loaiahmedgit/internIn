"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ThinkingIndicator } from "@/components/ai/thinking-indicator";
import type { Challenge } from "@/lib/ai";
import { editChallengeAction } from "@/lib/ai/actions";
import { saveChallengeVersionAction, publishOpportunityAction } from "@/lib/opportunities/actions";
import { CheckCircle2, Sparkles, X, Plus, FileText, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ASSESSMENT_BASIS_DESCRIPTION,
  ASSESSMENT_BASIS_LABEL,
  ASSESSMENT_BASIS_VALUES,
  getChallengeSafeguardIssues,
  MAX_UNPAID_CHALLENGE_MINUTES,
  NO_FREE_LABOR_POLICY_VERSION,
  type AssessmentBasis,
} from "@/lib/challenges/no-free-labor";

const STEPS: { key: Challenge["status"]; label: string }[] = [
  { key: "ai_generated", label: "AI Generated" },
  { key: "pending_approval", label: "Needs Review" },
  { key: "approved", label: "Approved" },
  { key: "published", label: "Published" },
];

function stepIndex(status: Challenge["status"]) {
  if (status === "draft") return -1;
  return STEPS.findIndex((s) => s.key === status);
}

export function ChallengeBuilder({
  challenge,
  onChange,
  opportunityId,
  reviewMode = false,
}: {
  challenge: Challenge;
  onChange: (next: Challenge) => void;
  opportunityId: string;
  /** Draft-review mode edits the already attached challenge in place and
   * never exposes the separate approve/publish lifecycle controls. */
  reviewMode?: boolean;
}) {
  const [instruction, setInstruction] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const currentIndex = stepIndex(challenge.status);

  function markEdited(next: Challenge) {
    onChange({
      ...next,
      // Confirmation belongs to the exact immutable content a human
      // reviewed. Any edit requires a fresh acknowledgement.
      nonProductionConfirmed: false,
      status: next.status === "published" || next.status === "approved" ? "pending_approval" : next.status,
    });
  }

  async function handleAiEdit() {
    if (!instruction.trim()) return;
    setSaveError(null);
    setIsThinking(true);
    try {
      const next = await editChallengeAction(challenge, instruction);
      await saveChallengeVersionAction(opportunityId, next, "ai_generated", instruction);
      onChange(next);
      setInstruction("");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save that edit.");
    } finally {
      setIsThinking(false);
    }
  }

  async function handleApprove() {
    setSaveError(null);

    // Keep the deterministic server-side gate as the authority, but surface
    // its actionable R3 guidance before crossing the Server Action boundary.
    // Production React intentionally redacts thrown server errors, which made
    // a correctly blocked approval appear as an opaque minified error.
    const [safeguardIssue] = getChallengeSafeguardIssues({
      policyVersion: NO_FREE_LABOR_POLICY_VERSION,
      assessmentBasis: challenge.assessmentBasis,
      nonProductionConfirmed: challenge.nonProductionConfirmed === true,
      estimatedMinutes: challenge.estimatedMinutes,
      durationExceptionJustification: challenge.durationExceptionJustification,
      productionWorkRisk: challenge.productionWorkRisk,
      transformationApplied: challenge.transformationApplied,
    });
    if (safeguardIssue) {
      setSaveError(safeguardIssue.message);
      return;
    }

    setActionPending(true);
    try {
      const next: Challenge = { ...challenge, status: "approved" };
      await saveChallengeVersionAction(opportunityId, next, "approved");
      onChange(next);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save the approval.");
    } finally {
      setActionPending(false);
    }
  }

  async function handlePublish() {
    setSaveError(null);
    setActionPending(true);
    try {
      await publishOpportunityAction(opportunityId);
      onChange({ ...challenge, status: "published" });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't publish.");
    } finally {
      setActionPending(false);
    }
  }

  async function handleSaveDraft() {
    setSaveError(null);
    setActionPending(true);
    try {
      await saveChallengeVersionAction(opportunityId, challenge, "human_edited");
      toast.success("Challenge changes saved");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save the challenge.");
    } finally {
      setActionPending(false);
    }
  }

  function addSkill() {
    if (!newSkill.trim()) return;
    markEdited({ ...challenge, skills: [...challenge.skills, newSkill.trim()] });
    setNewSkill("");
  }

  function removeSkill(skill: string) {
    markEdited({ ...challenge, skills: challenge.skills.filter((s) => s !== skill) });
  }

  function updateTask(i: number, description: string) {
    const tasks = challenge.tasks.map((t, idx) => (idx === i ? { ...t, description } : t));
    markEdited({ ...challenge, tasks });
  }

  function removeTask(i: number) {
    markEdited({ ...challenge, tasks: challenge.tasks.filter((_, idx) => idx !== i) });
  }

  function addTask() {
    markEdited({
      ...challenge,
      tasks: [
        ...challenge.tasks,
        { id: crypto.randomUUID(), title: `Task ${challenge.tasks.length + 1}`, description: "" },
      ],
    });
  }

  return (
    <div className="space-y-6">
      {/* Approval stepper */}
      {!reviewMode && (
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-gray-cool/60 bg-white p-3">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium",
                  i === currentIndex
                    ? "bg-teal text-white"
                    : i < currentIndex
                      ? "bg-teal/10 text-teal"
                      : "bg-gray-light text-navy/40",
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && <span className="h-px w-4 bg-gray-cool" />}
            </div>
          ))}
        </div>
      )}

      {/* Editable challenge card */}
      <div className="rounded-xl border border-gray-cool/60 bg-white p-6">
        <Input
          value={challenge.title}
          onChange={(e) => markEdited({ ...challenge, title: e.target.value })}
          aria-label="Challenge title"
          className="rounded border-0 px-0 text-xl font-bold text-navy shadow-none focus-visible:ring-2 focus-visible:ring-teal/50 focus-visible:px-1.5"
        />
        <Textarea
          value={challenge.scenario}
          onChange={(e) => markEdited({ ...challenge, scenario: e.target.value })}
          aria-label="Challenge scenario"
          className="mt-2 min-h-20 resize-none rounded border-0 px-0 text-sm text-navy/70 shadow-none focus-visible:ring-2 focus-visible:ring-teal/50 focus-visible:px-1.5"
        />

        <div className="mt-4 flex items-center gap-4 text-xs text-navy/50">
          <label>
            Estimated:{" "}
            <input
              type="number"
              value={challenge.estimatedMinutes}
              // Hand-editing the minutes makes any existing human label
              // ("4–6 hours") stale — clear it so this field stays the
              // one true duration instead of silently disagreeing with a
              // leftover label shown elsewhere (challenge-duration.ts).
              onChange={(e) => markEdited({ ...challenge, estimatedMinutes: Number(e.target.value), estimatedDurationLabel: null })}
              aria-label="Estimated minutes"
              className="w-14 border-b border-gray-cool bg-transparent text-center font-medium text-navy"
            />{" "}
            min
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {challenge.skills.map((skill) => (
            <Badge key={skill} variant="secondary" className="gap-1 bg-gray-light text-navy hover:bg-gray-light">
              {skill}
              <button onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <div className="flex items-center gap-1">
            <Input
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSkill()}
              placeholder="Add skill"
              aria-label="Add skill"
              className="h-7 w-28 text-xs"
            />
            <Button size="icon" variant="ghost" className="size-7" onClick={addSkill} aria-label="Add skill">
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Tasks</p>
          <div className="mt-2 space-y-2">
            {challenge.tasks.map((task, i) => (
              <div key={task.id} className="flex items-start gap-2 rounded-lg border border-gray-cool/50 p-2.5">
                <span className="mt-1.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-light text-[10px] font-semibold text-navy/50">
                  {i + 1}
                </span>
                <Textarea
                  value={task.description}
                  onChange={(e) => updateTask(i, e.target.value)}
                  aria-label={`Task ${i + 1} description`}
                  className="min-h-8 flex-1 resize-none rounded border-0 p-0 text-sm text-navy shadow-none focus-visible:ring-2 focus-visible:ring-teal/50 focus-visible:px-1.5"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6 shrink-0"
                  onClick={() => removeTask(i)}
                  aria-label={`Remove task ${i + 1}`}
                >
                  <X className="size-3.5 text-navy/30" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={addTask} className="text-teal hover:text-teal">
              <Plus className="mr-1 size-3.5" /> Add task
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Deliverables</p>
            <ul className="mt-2 space-y-1.5 text-sm text-navy/70">
              {challenge.deliverables.map((d) => (
                <li key={d}>• {d}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Files provided</p>
            <ul className="mt-2 space-y-1.5 text-sm text-navy/70">
              {challenge.files.map((f) => (
                <li key={f.name} className="flex items-center gap-1.5">
                  <FileText className="size-3.5 text-navy/30" /> {f.name}
                </li>
              ))}
            </ul>
            {challenge.files.length > 0 && (
              <p className="mt-2 text-xs text-navy/40">
                Real files are generated on save — Approve will fail with the exact reason if any file isn&apos;t ready yet.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Submission requirements</p>
          <ul className="mt-2 space-y-1.5 text-sm text-navy/70">
            {challenge.submissionRequirements.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <span className={r.required ? "font-medium text-navy" : "text-navy/60"}>{r.label}</span>
                <Badge variant="secondary" className={cn("h-5 px-1.5 text-[10px]", r.required ? "bg-teal/10 text-teal" : "bg-gray-light text-navy/50")}>
                  {r.required ? "Required" : "Optional"}
                </Badge>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Rubric</p>
          <ul className="mt-2 space-y-1.5 text-sm text-navy/70">
            {challenge.rubric.map((r) => (
              <li key={r.criterion}>
                <span className="font-medium text-navy">{r.criterion}:</span> {r.description}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-gray-cool/60 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">Assessment setup</p>
            <p className="mt-1 text-sm text-navy/60">Confirm why this is an assessment—not unpaid live company work.</p>
          </div>
          <span className="shrink-0 text-xs font-medium text-navy/50">{challenge.estimatedMinutes} min active work</span>
        </div>

        {challenge.transformationApplied && challenge.productionWorkRisk !== "none" && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-sm">
            <p className="font-medium text-amber-900">Potential production-work concern converted</p>
            {challenge.originalIntentSummary && <p className="mt-1 text-amber-900/75">Original intent: {challenge.originalIntentSummary}</p>}
            {challenge.productionWorkReason && <p className="mt-1 text-amber-900/75">Why: {challenge.productionWorkReason}</p>}
          </div>
        )}

        <label className="mt-4 block">
          <span className="text-xs font-medium text-navy/60">Assessment basis</span>
          <select
            value={challenge.assessmentBasis ?? ""}
            onChange={(event) =>
              onChange({
                ...challenge,
                assessmentBasis: (event.target.value || null) as AssessmentBasis | null,
                nonProductionConfirmed: false,
                status:
                  challenge.status === "published" || challenge.status === "approved"
                    ? "pending_approval"
                    : challenge.status,
              })
            }
            className="mt-1.5 h-9 w-full rounded-lg border border-navy/15 bg-white px-2.5 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
          >
            <option value="">Select a non-production basis</option>
            {ASSESSMENT_BASIS_VALUES.map((basis) => (
              <option key={basis} value={basis}>{ASSESSMENT_BASIS_LABEL[basis]}</option>
            ))}
          </select>
          {challenge.assessmentBasis && (
            <span className="mt-1 block text-xs text-navy/45">{ASSESSMENT_BASIS_DESCRIPTION[challenge.assessmentBasis]}</span>
          )}
        </label>

        {challenge.estimatedMinutes > 90 && challenge.estimatedMinutes <= MAX_UNPAID_CHALLENGE_MINUTES && (
          <label className="mt-4 block">
            <span className="text-xs font-medium text-navy/60">Why does this need more than 90 minutes?</span>
            <Textarea
              value={challenge.durationExceptionJustification ?? ""}
              onChange={(event) =>
                onChange({
                  ...challenge,
                  durationExceptionJustification: event.target.value,
                  nonProductionConfirmed: false,
                  status:
                    challenge.status === "published" || challenge.status === "approved"
                      ? "pending_approval"
                      : challenge.status,
                })
              }
              rows={2}
              className="mt-1.5 min-h-16 resize-none"
              placeholder="Briefly explain why the role-relevant evidence cannot be assessed in a shorter exercise."
            />
          </label>
        )}

        {challenge.estimatedMinutes > MAX_UNPAID_CHALLENGE_MINUTES && (
          <p className="mt-3 text-sm font-medium text-destructive">
            Reduce active work to {MAX_UNPAID_CHALLENGE_MINUTES} minutes or less before approval.
          </p>
        )}

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-navy/75">
          <input
            type="checkbox"
            checked={challenge.nonProductionConfirmed === true}
            onChange={(event) =>
              onChange({
                ...challenge,
                nonProductionConfirmed: event.target.checked,
                status:
                  challenge.status === "published" || challenge.status === "approved"
                    ? "pending_approval"
                    : challenge.status,
              })
            }
            className="mt-0.5 size-4 shrink-0 accent-teal-ink"
          />
          <span>
            This Challenge is an assessment, uses no confidential live data, and is not intended to obtain unpaid work for company production.
          </span>
        </label>
      </div>

      {/* AI edit-by-instruction */}
      <div className="rounded-xl border border-gray-cool/60 bg-white p-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-navy/40">
          <Sparkles className="size-3.5 text-teal" /> Tell the AI what to change
        </p>
        {isThinking ? (
          <ThinkingIndicator label="Updating the challenge..." />
        ) : (
          <div className="flex gap-2">
            <Input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAiEdit()}
              placeholder='e.g. "Make it easier" or "Give them 90 minutes"'
              aria-label="Instruction for the AI"
              className="flex-1"
            />
            <Button onClick={handleAiEdit} className="bg-teal text-white hover:bg-teal/90">
              Update
            </Button>
          </div>
        )}
      </div>

      {/* Approval actions */}
      <div className="rounded-xl border border-gray-cool/60 bg-gray-light/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-navy/60">
            <Lock className="size-3.5" />
            {reviewMode ? "Changes stay attached to this draft internship." : "Nothing publishes until a human explicitly approves it."}
          </div>
          <div className="flex gap-2">
            {reviewMode ? (
              <Button onClick={handleSaveDraft} disabled={actionPending} className="bg-teal text-white hover:bg-teal/90">
                {actionPending ? "Saving..." : "Save changes"}
              </Button>
            ) : challenge.status !== "approved" && challenge.status !== "published" ? (
              <Button
                onClick={handleApprove}
                disabled={actionPending}
                variant="outline"
                className="border-teal/40 text-teal hover:bg-teal/5"
              >
                <CheckCircle2 className="mr-1.5 size-4" /> {actionPending ? "Saving..." : "Approve"}
              </Button>
            ) : null}
            {!reviewMode && challenge.status === "approved" && (
              <Button onClick={handlePublish} disabled={actionPending} className="bg-teal text-white hover:bg-teal/90">
                {actionPending ? "Publishing..." : "Publish"}
              </Button>
            )}
            {!reviewMode && challenge.status === "published" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1.5 text-sm font-medium text-teal">
                <CheckCircle2 className="size-4" /> Published — visible to students
              </span>
            )}
          </div>
        </div>
        {saveError && <p className="mt-3 text-sm text-red-600">{saveError}</p>}
      </div>
    </div>
  );
}
