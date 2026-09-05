"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { deleteEducationAction, upsertEducationAction } from "@/lib/opportunities/student-profile-sections-actions";
import { STAGE_OPTIONS, type EducationStage } from "@/lib/education-stages";

export interface EducationItem {
  id: string;
  level: EducationStage | null;
  institution: string;
  fieldOfStudy: string | null;
  graduationYear: number | null;
  location: string | null;
}

function emptyDraft(): Omit<EducationItem, "id"> {
  return { level: null, institution: "", fieldOfStudy: "", graduationYear: null, location: "" };
}

export function EducationEditor({ items }: { items: EducationItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<EducationItem, "id">>(emptyDraft());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    setDraft(emptyDraft());
    setError(null);
    setOpen(true);
  }

  function openEdit(item: EducationItem) {
    setEditingId(item.id);
    setDraft({ ...item, fieldOfStudy: item.fieldOfStudy ?? "", location: item.location ?? "" });
    setError(null);
    setOpen(true);
  }

  function save() {
    setError(null);
    if (!draft.institution.trim()) {
      setError("Institution is required.");
      return;
    }
    startTransition(async () => {
      try {
        await upsertEducationAction({
          id: editingId ?? undefined,
          level: draft.level ?? undefined,
          institution: draft.institution,
          fieldOfStudy: draft.fieldOfStudy || undefined,
          graduationYear: draft.graduationYear ?? undefined,
          location: draft.location || undefined,
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteEducationAction(id);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <section id="education" className="scroll-mt-24 rounded-2xl border border-black/[0.04] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-4 text-teal-ink" aria-hidden="true" />
            <h2 className="text-base font-semibold text-navy">Education</h2>
          </div>
          <SheetTrigger onClick={openAdd} className="flex items-center gap-1 text-sm font-medium text-teal-ink hover:underline">
            <Plus className="size-3.5" aria-hidden="true" />
            Add education
          </SheetTrigger>
        </div>

        {items.length > 0 ? (
          <div className="mt-3 divide-y divide-navy/8">
            {items.map((item) => (
              <div key={item.id} className="group flex items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-start gap-2.5 min-w-0">
                  <GraduationCap className="mt-0.5 size-4 shrink-0 text-navy/35" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-medium text-navy">{item.institution}</p>
                    <p className="text-sm text-navy/60">
                      {[item.fieldOfStudy, item.graduationYear ? `Expected ${item.graduationYear}` : null].filter(Boolean).join(" · ")}
                    </p>
                    {item.location && <p className="mt-0.5 flex items-center gap-1 text-xs text-navy/45"><MapPin className="size-3" aria-hidden="true" />{item.location}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button type="button" onClick={() => openEdit(item)} aria-label={`Edit ${item.institution}`} className="rounded-md p-1.5 text-navy/40 hover:bg-navy/5 hover:text-teal-ink">
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => remove(item.id)} aria-label={`Remove ${item.institution}`} className="rounded-md p-1.5 text-navy/40 hover:bg-navy/5 hover:text-destructive">
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-navy/55">Add your education so companies know your background.</p>
        )}
      </section>

      <SheetContent className="flex flex-col gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b border-navy/8 px-5 py-4">
          <SheetTitle>{editingId ? "Edit education" : "Add education"}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 px-5 py-5">
          <div>
            <label className="text-sm font-medium text-navy">Level</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {STAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, level: opt.value }))}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${draft.level === opt.value ? "border-teal bg-teal/5 text-teal" : "border-gray-cool/60 text-navy/60"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="edu-institution" className="text-sm font-medium text-navy">Institution</label>
            <Input id="edu-institution" value={draft.institution} onChange={(e) => setDraft((d) => ({ ...d, institution: e.target.value }))} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor="edu-field" className="text-sm font-medium text-navy">Field of study (optional)</label>
            <Input id="edu-field" value={draft.fieldOfStudy ?? ""} onChange={(e) => setDraft((d) => ({ ...d, fieldOfStudy: e.target.value }))} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor="edu-year" className="text-sm font-medium text-navy">Graduation year (optional)</label>
            <Input id="edu-year" type="number" value={draft.graduationYear ?? ""} onChange={(e) => setDraft((d) => ({ ...d, graduationYear: e.target.value ? Number(e.target.value) : null }))} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor="edu-location" className="text-sm font-medium text-navy">Location (optional)</label>
            <Input id="edu-location" value={draft.location ?? ""} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} className="mt-1.5" />
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
