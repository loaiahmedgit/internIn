"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { updateStudentTaskStatusAction, updateStudentTaskEvidenceAction } from "@/lib/opportunities/student-program-actions";

export type StudentTask = {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "blocked" | "done";
  blockerNote: string | null;
  evidenceNote: string | null;
  evidenceUrl: string | null;
};

const STATUS_LABEL: Record<StudentTask["status"], string> = {
  pending: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

const STATUS_CLASS: Record<StudentTask["status"], string> = {
  pending: "bg-gray-light text-navy/60",
  in_progress: "bg-teal/10 text-teal-ink",
  blocked: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-700",
};

/**
 * Read-only when `readOnly` (completed program — §22: retains history,
 * no further editing). Never offers a "Verify" action — task-level
 * verification isn't a student capability this phase builds (§9).
 */
export function StudentTaskItem({ task, readOnly }: { task: StudentTask; readOnly: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [blockerDraft, setBlockerDraft] = useState("");
  const [showBlockerForm, setShowBlockerForm] = useState(false);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [evidenceNoteDraft, setEvidenceNoteDraft] = useState(task.evidenceNote ?? "");
  const [evidenceUrlDraft, setEvidenceUrlDraft] = useState(task.evidenceUrl ?? "");

  function setStatus(status: StudentTask["status"], blockerNote?: string) {
    setError(null);
    startTransition(async () => {
      try {
        await updateStudentTaskStatusAction(task.id, status, blockerNote);
        setShowBlockerForm(false);
        setBlockerDraft("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update this task.");
      }
    });
  }

  function saveEvidence() {
    setError(null);
    startTransition(async () => {
      try {
        await updateStudentTaskEvidenceAction(task.id, { evidenceNote: evidenceNoteDraft, evidenceUrl: evidenceUrlDraft });
        setShowEvidenceForm(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save evidence.");
      }
    });
  }

  const hasEvidence = !!(task.evidenceNote || task.evidenceUrl);

  return (
    <li className="border-t border-navy/8 py-3 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={task.status === "done" ? "text-navy/50 line-through" : "font-medium text-navy"}>{task.title}</p>
          {task.description && <p className="mt-0.5 text-sm text-navy/60">{task.description}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[task.status]}`}>{STATUS_LABEL[task.status]}</span>
      </div>

      {task.status === "blocked" && task.blockerNote && (
        <p className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {task.blockerNote}
        </p>
      )}

      {hasEvidence && !showEvidenceForm && (
        <div className="mt-2 space-y-1 rounded-md bg-gray-light/60 px-2.5 py-1.5 text-xs text-navy/70">
          {task.evidenceNote && <p>{task.evidenceNote}</p>}
          {task.evidenceUrl && (
            <a href={task.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal-ink hover:underline">
              <Link2 className="size-3" aria-hidden="true" />
              {task.evidenceUrl}
            </a>
          )}
        </div>
      )}

      {!readOnly && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {task.status === "pending" && (
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => setStatus("in_progress")}>
              Start work
            </Button>
          )}
          {(task.status === "pending" || task.status === "in_progress") && (
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => setShowBlockerForm((v) => !v)}>
              Mark blocked
            </Button>
          )}
          {task.status === "blocked" && (
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => setStatus("in_progress")}>
              Resolve blocker
            </Button>
          )}
          {(task.status === "in_progress" || task.status === "blocked") && (
            <Button size="sm" disabled={isPending} onClick={() => setStatus("done")}>
              Mark complete
            </Button>
          )}
          {task.status === "done" && (
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => setStatus("in_progress")}>
              Reopen
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setShowEvidenceForm((v) => !v)}>
            {hasEvidence ? "Edit evidence" : "Add evidence"}
          </Button>
        </div>
      )}

      {showBlockerForm && !readOnly && (
        <div className="mt-2.5 space-y-2">
          <Textarea
            value={blockerDraft}
            onChange={(e) => setBlockerDraft(e.target.value)}
            placeholder="I'm blocked because…"
            className="min-h-16 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={isPending || !blockerDraft.trim()} onClick={() => setStatus("blocked", blockerDraft.trim())}>
              Save
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setShowBlockerForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {showEvidenceForm && !readOnly && (
        <div className="mt-2.5 space-y-2">
          <Textarea
            value={evidenceNoteDraft}
            onChange={(e) => setEvidenceNoteDraft(e.target.value)}
            placeholder="A short update on what you did…"
            className="min-h-16 text-sm"
          />
          <Input
            value={evidenceUrlDraft}
            onChange={(e) => setEvidenceUrlDraft(e.target.value)}
            placeholder="https://… (repo, doc, deployed link — optional)"
            className="h-9 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={isPending} onClick={saveEvidence}>
              Save
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setShowEvidenceForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </li>
  );
}
