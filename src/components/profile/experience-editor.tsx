"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { deleteExperienceAction, upsertExperienceAction } from "@/lib/opportunities/student-profile-sections-actions";

export interface ExperienceItem {
  id: string;
  type: string;
  title: string;
  organization: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
}

const TYPE_OPTIONS = ["Job", "Internship", "Volunteering", "Freelance", "Student organization", "Research", "Leadership", "Other"];

const monthYearFormatter = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" });
function formatMonth(value: string | null): string {
  if (!value) return "";
  const date = new Date(`${value}-01`);
  return Number.isNaN(date.getTime()) ? value : monthYearFormatter.format(date);
}

function emptyDraft(): Omit<ExperienceItem, "id"> {
  return { type: "Job", title: "", organization: "", location: "", startDate: "", endDate: "", isCurrent: false, description: "" };
}

export function ExperienceEditor({ items }: { items: ExperienceItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<ExperienceItem, "id">>(emptyDraft());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    setDraft(emptyDraft());
    setError(null);
    setOpen(true);
  }

  function openEdit(item: ExperienceItem) {
    setEditingId(item.id);
    setDraft({ ...item, location: item.location ?? "", startDate: item.startDate ?? "", endDate: item.endDate ?? "", description: item.description ?? "" });
    setError(null);
    setOpen(true);
  }

  function save() {
    setError(null);
    if (!draft.title.trim() || !draft.organization.trim()) {
      setError("Title and organization are required.");
      return;
    }
    startTransition(async () => {
      try {
        await upsertExperienceAction({ id: editingId ?? undefined, ...draft, location: draft.location || undefined, startDate: draft.startDate || undefined, endDate: draft.endDate || undefined, description: draft.description || undefined });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteExperienceAction(id);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <section id="experience" className="scroll-mt-24 rounded-2xl border border-black/[0.04] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Briefcase className="size-4 text-teal-ink" aria-hidden="true" />
            <h2 className="text-base font-semibold text-navy">Experience</h2>
          </div>
          <SheetTrigger onClick={openAdd} className="flex items-center gap-1 text-sm font-medium text-teal-ink hover:underline">
            <Plus className="size-3.5" aria-hidden="true" />
            Add experience
          </SheetTrigger>
        </div>

        {items.length > 0 ? (
          <div className="mt-3 divide-y divide-navy/8">
            {items.map((item) => (
              <div key={item.id} className="group py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-navy">{item.title}</p>
                    <p className="text-sm text-navy/60">{item.organization}{item.location ? ` · ${item.location}` : ""}</p>
                    <p className="mt-0.5 text-xs text-navy/45">
                      {formatMonth(item.startDate)}{item.startDate ? " – " : ""}{item.isCurrent ? "Present" : formatMonth(item.endDate)}
                    </p>
                    {item.description && <p className="mt-1.5 text-sm leading-6 text-navy/64">{item.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button type="button" onClick={() => openEdit(item)} aria-label={`Edit ${item.title}`} className="rounded-md p-1.5 text-navy/40 hover:bg-navy/5 hover:text-teal-ink">
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => remove(item.id)} aria-label={`Remove ${item.title}`} className="rounded-md p-1.5 text-navy/40 hover:bg-navy/5 hover:text-destructive">
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-navy/55">Add work, volunteering, freelance, research, or leadership experience.</p>
        )}
      </section>

      <SheetContent className="flex flex-col gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b border-navy/8 px-5 py-4">
          <SheetTitle>{editingId ? "Edit experience" : "Add experience"}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 px-5 py-5">
          <div>
            <label className="text-sm font-medium text-navy">Type</label>
            <select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))} className="mt-1.5 h-9 w-full rounded-lg border border-gray-cool/60 bg-white px-2.5 text-sm text-navy focus-visible:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/30">
              {TYPE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="exp-title" className="text-sm font-medium text-navy">Title</label>
            <Input id="exp-title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor="exp-org" className="text-sm font-medium text-navy">Organization</label>
            <Input id="exp-org" value={draft.organization} onChange={(e) => setDraft((d) => ({ ...d, organization: e.target.value }))} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor="exp-location" className="text-sm font-medium text-navy">Location (optional)</label>
            <Input id="exp-location" value={draft.location ?? ""} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="exp-start" className="text-sm font-medium text-navy">Start</label>
              <input id="exp-start" type="month" value={draft.startDate ?? ""} onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))} className="mt-1.5 h-9 w-full rounded-lg border border-gray-cool/60 bg-white px-2.5 text-sm text-navy focus-visible:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/30" />
            </div>
            <div>
              <label htmlFor="exp-end" className="text-sm font-medium text-navy">End</label>
              <input id="exp-end" type="month" disabled={draft.isCurrent} value={draft.endDate ?? ""} onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))} className="mt-1.5 h-9 w-full rounded-lg border border-gray-cool/60 bg-white px-2.5 text-sm text-navy focus-visible:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/30 disabled:bg-navy/5 disabled:text-navy/35" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-navy/70">
            <input type="checkbox" checked={draft.isCurrent} onChange={(e) => setDraft((d) => ({ ...d, isCurrent: e.target.checked }))} className="size-3.5 rounded border-navy/30 accent-teal" />
            I currently do this
          </label>
          <div>
            <label htmlFor="exp-desc" className="text-sm font-medium text-navy">Description (optional)</label>
            <Textarea id="exp-desc" value={draft.description ?? ""} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={3} className="mt-1.5" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <Button type="button" onClick={save} disabled={isPending} className="h-9 bg-teal text-white hover:bg-teal-ink">{isPending ? "Saving…" : "Save"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending} className="h-9">Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
