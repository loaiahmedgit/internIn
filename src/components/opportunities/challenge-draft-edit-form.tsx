"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import {
  DELIVERABLE_TYPE_LABEL,
  AI_USAGE_MODE_LABEL,
  type ChallengeDraft,
  type ChallengeAiUsagePolicyMode,
  type ChallengeTaskDeliverableType,
} from "@/lib/ai/challenge-clarification-schemas";

const DELIVERABLE_TYPES = Object.keys(DELIVERABLE_TYPE_LABEL) as ChallengeTaskDeliverableType[];
const AI_USAGE_MODES = Object.keys(AI_USAGE_MODE_LABEL) as ChallengeAiUsagePolicyMode[];

/**
 * Direct manual editing of every field a generated ChallengeDraft has —
 * "Do not require chat for every change." Local, uncontrolled-by-the-
 * server state until "Save changes"; the parent (ChallengeDraftCard)
 * decides what happens to the result (writing it back into the message
 * stream via useChat's setMessages, so a later chat edit still sees it).
 */
export function ChallengeDraftEditForm({
  draft,
  onSave,
  onCancel,
}: {
  draft: ChallengeDraft;
  onSave: (next: ChallengeDraft) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ChallengeDraft>(draft);

  function updateTask(index: number, patch: Partial<ChallengeDraft["tasks"][number]>) {
    setForm((prev) => ({ ...prev, tasks: prev.tasks.map((t, i) => (i === index ? { ...t, ...patch } : t)) }));
  }
  function removeTask(index: number) {
    setForm((prev) => ({ ...prev, tasks: prev.tasks.filter((_, i) => i !== index) }));
  }
  function addTask() {
    setForm((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { id: crypto.randomUUID(), title: "New task", instructions: "", deliverableType: "written" }],
    }));
  }

  function updateMaterial(index: number, patch: Partial<ChallengeDraft["materials"][number]>) {
    setForm((prev) => ({ ...prev, materials: prev.materials.map((m, i) => (i === index ? { ...m, ...patch } : m)) }));
  }
  function removeMaterial(index: number) {
    setForm((prev) => ({ ...prev, materials: prev.materials.filter((_, i) => i !== index) }));
  }
  function addMaterial() {
    setForm((prev) => ({ ...prev, materials: [...prev.materials, { id: crypto.randomUUID(), name: "New material", type: "file", description: "" }] }));
  }

  function updateRubricRow(index: number, patch: Partial<ChallengeDraft["rubric"][number]>) {
    setForm((prev) => ({ ...prev, rubric: prev.rubric.map((r, i) => (i === index ? { ...r, ...patch } : r)) }));
  }
  function removeRubricRow(index: number) {
    setForm((prev) => ({ ...prev, rubric: prev.rubric.filter((_, i) => i !== index) }));
  }
  function addRubricRow() {
    setForm((prev) => ({ ...prev, rubric: [...prev.rubric, { id: crypto.randomUUID(), criterion: "New criterion", weight: 0, description: "" }] }));
  }

  return (
    <div className="not-typeset space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="draft-title">Title</Label>
        <Input id="draft-title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="draft-scenario">Scenario</Label>
        <Textarea id="draft-scenario" rows={4} value={form.scenario} onChange={(e) => setForm((p) => ({ ...p, scenario: e.target.value }))} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="draft-skills">Skills assessed (comma-separated)</Label>
        <Input
          id="draft-skills"
          value={form.skills.join(", ")}
          onChange={(e) => setForm((p) => ({ ...p, skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))}
        />
      </div>

      <div className="space-y-3">
        <Label>Tasks</Label>
        {form.tasks.map((task, i) => (
          <div key={task.id} className="space-y-2 rounded-lg border border-navy/10 p-3">
            <div className="flex items-center gap-2">
              <Input value={task.title} onChange={(e) => updateTask(i, { title: e.target.value })} placeholder="Task title" className="flex-1" />
              <Select value={task.deliverableType} onValueChange={(v) => updateTask(i, { deliverableType: v as ChallengeTaskDeliverableType })}>
                <SelectTrigger className="w-40 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DELIVERABLE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{DELIVERABLE_TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeTask(i)} aria-label="Remove task">
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
            <Textarea rows={2} value={task.instructions} onChange={(e) => updateTask(i, { instructions: e.target.value })} placeholder="Instructions" />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addTask}>
          <Plus className="size-3.5" /> Add task
        </Button>
      </div>

      <div className="space-y-3">
        <Label>Materials</Label>
        {form.materials.map((material, i) => (
          <div key={material.id} className="flex items-center gap-2">
            <Input value={material.name} onChange={(e) => updateMaterial(i, { name: e.target.value })} placeholder="File name" className="flex-1" />
            <Input value={material.type} onChange={(e) => updateMaterial(i, { type: e.target.value })} placeholder="Type" className="w-28" />
            <Button type="button" variant="ghost" size="icon" onClick={() => removeMaterial(i)} aria-label="Remove material">
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addMaterial}>
          <Plus className="size-3.5" /> Add material
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="draft-duration">Duration (minutes)</Label>
        <Input
          id="draft-duration"
          type="number"
          value={form.durationMinutes ?? ""}
          onChange={(e) => setForm((p) => ({ ...p, durationMinutes: e.target.value ? Number(e.target.value) : null }))}
          className="w-32"
        />
      </div>

      <div className="space-y-3">
        <Label>Evaluation</Label>
        {form.rubric.map((row, i) => (
          <div key={row.id} className="flex items-center gap-2">
            <Input value={row.criterion} onChange={(e) => updateRubricRow(i, { criterion: e.target.value })} placeholder="Criterion" className="flex-1" />
            <Input
              type="number"
              value={row.weight}
              onChange={(e) => updateRubricRow(i, { weight: Number(e.target.value) })}
              className="w-20"
              aria-label="Weight percent"
            />
            <span className="text-sm text-navy/50">%</span>
            <Button type="button" variant="ghost" size="icon" onClick={() => removeRubricRow(i)} aria-label="Remove criterion">
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addRubricRow}>
          <Plus className="size-3.5" /> Add criterion
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="draft-ai-usage">AI usage policy</Label>
        <Select
          value={form.aiUsagePolicyMode ?? "not_allowed"}
          onValueChange={(v) => setForm((p) => ({ ...p, aiUsagePolicyMode: v as ChallengeAiUsagePolicyMode }))}
        >
          <SelectTrigger id="draft-ai-usage" className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AI_USAGE_MODES.map((m) => (
              <SelectItem key={m} value={m}>{AI_USAGE_MODE_LABEL[m]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.aiUsagePolicyMode === "custom" && (
          <Textarea
            rows={2}
            value={form.aiUsagePolicyCustomText ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, aiUsagePolicyCustomText: e.target.value }))}
            placeholder="Describe the custom AI usage policy…"
          />
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="draft-assumptions">Assumptions (one per line)</Label>
        <Textarea
          id="draft-assumptions"
          rows={2}
          value={form.assumptions.join("\n")}
          onChange={(e) => setForm((p) => ({ ...p, assumptions: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean) }))}
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-navy/10 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="button" className="bg-teal text-white hover:bg-teal/90" onClick={() => onSave(form)}>Save changes</Button>
      </div>
    </div>
  );
}
