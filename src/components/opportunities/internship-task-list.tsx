"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addInternshipTaskAction, updateInternshipTaskStatusAction } from "@/lib/opportunities/program-actions";

type Task = { id: string; title: string; description: string | null; status: "pending" | "in_progress" | "done" };

const NEXT_STATUS: Record<Task["status"], Task["status"]> = {
  pending: "in_progress",
  in_progress: "done",
  done: "pending",
};

const STATUS_LABEL: Record<Task["status"], string> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Done",
};

export function InternshipTaskList({ weekId, tasks }: { weekId: string; tasks: Task[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    if (!title.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addInternshipTaskAction(weekId, title.trim());
        setTitle("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add the task.");
      }
    });
  }

  function handleCycle(task: Task) {
    setError(null);
    startTransition(async () => {
      try {
        await updateInternshipTaskStatusAction(task.id, NEXT_STATUS[task.status]);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update the task.");
      }
    });
  }

  return (
    <div className="mt-3">
      {tasks.length > 0 && (
        <ul className="space-y-1.5">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
              <span className={t.status === "done" ? "text-navy/40 line-through" : "text-navy/80"}>{t.title}</span>
              <button
                type="button"
                onClick={() => handleCycle(t)}
                disabled={isPending}
                className="shrink-0 rounded-full bg-gray-light px-2.5 py-1 text-xs font-medium text-navy/68 hover:bg-gray-cool/40"
              >
                {STATUS_LABEL[t.status]}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          aria-label="New task title"
          className="h-8 text-sm"
        />
        <Button size="sm" variant="outline" onClick={handleAdd} disabled={isPending || !title.trim()}>
          Add
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
