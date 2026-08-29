"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateOpportunityDetailsAction } from "@/lib/opportunities/actions";
import type { InternshipDraft } from "@/lib/ai";

const WORK_MODE_OPTIONS: { value: "" | "remote" | "onsite" | "hybrid"; label: string }[] = [
  { value: "", label: "Not specified" },
  { value: "remote", label: "Remote" },
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
];

export function EditInternshipDialog({
  opportunityId,
  initial,
  open,
  onOpenChange,
}: {
  opportunityId: string;
  initial: InternshipDraft;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(initial);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updateOpportunityDetailsAction(opportunityId, form);
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save these changes.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Edit internship details</DialogTitle>
            <DialogDescription>
              Fix the location, work mode, or any other listing detail — works for internships at any stage,
              published ones included.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-role">Role</Label>
              <Input
                id="edit-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Doha, Qatar"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-work-mode">Work mode</Label>
                <select
                  id="edit-work-mode"
                  value={form.workMode ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, workMode: (e.target.value || null) as InternshipDraft["workMode"] })
                  }
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {WORK_MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-duration">Duration</Label>
                <Input
                  id="edit-duration"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-hours">Hours/week</Label>
                <Input
                  id="edit-hours"
                  type="number"
                  min={1}
                  max={60}
                  value={form.hoursPerWeek}
                  onChange={(e) => setForm({ ...form, hoursPerWeek: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-slots">Slots</Label>
                <Input
                  id="edit-slots"
                  type="number"
                  min={1}
                  max={100}
                  value={form.slots}
                  onChange={(e) => setForm({ ...form, slots: Number(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                required
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" className="bg-teal text-white hover:bg-teal/90" disabled={isPending}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
