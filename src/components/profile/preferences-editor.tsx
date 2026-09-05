"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { updateStudentPreferencesAction } from "@/lib/opportunities/student-profile-sections-actions";

const FIELD_OPTIONS = [
  "Software Engineering",
  "Data & Analytics",
  "Marketing",
  "Finance",
  "Design",
  "Business & Operations",
  "Sales",
  "Human Resources",
  "Research",
  "Product Management",
  "Customer Support",
];

const OPPORTUNITY_TYPE_OPTIONS = ["Internship", "Part-time", "Full-time", "Volunteer"];

function toList(value: string) {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function ChipMultiSelect({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  const selected = toList(value);
  const [custom, setCustom] = useState("");

  function toggle(option: string) {
    const next = selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option];
    onChange(next.join(", "));
  }

  function addCustom() {
    const trimmed = custom.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    onChange([...selected, trimmed].join(", "));
    setCustom("");
  }

  return (
    <div>
      <label className="text-sm font-medium text-navy">{label}</label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => toggle(opt)} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${selected.includes(opt) ? "border-teal bg-teal/5 text-teal" : "border-gray-cool/60 text-navy/60"}`}>
            {opt}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input placeholder="Add your own…" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
        <Button type="button" variant="outline" onClick={addCustom}>Add</Button>
      </div>
      {selected.filter((s) => !options.includes(s)).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.filter((s) => !options.includes(s)).map((s) => (
            <button key={s} type="button" onClick={() => toggle(s)} className="rounded-full border border-teal bg-teal/5 px-3 py-1.5 text-sm font-medium text-teal">{s} ×</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Preferences manages itself now — separate from Edit Profile identity. */
export function PreferencesEditor({ interests, opportunityTypes }: { interests: string[]; opportunityTypes: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [interestsDraft, setInterestsDraft] = useState(interests.join(", "));
  const [typesDraft, setTypesDraft] = useState(opportunityTypes.join(", "));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openEdit() {
    setInterestsDraft(interests.join(", "));
    setTypesDraft(opportunityTypes.join(", "));
    setError(null);
    setOpen(true);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateStudentPreferencesAction({ interests: toList(interestsDraft), opportunityTypes: toList(typesDraft) });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <section id="preferences" aria-labelledby="preferences-heading" className="scroll-mt-24 rounded-2xl border border-black/[0.05] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_16px_-4px_rgba(16,24,40,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-teal-ink" aria-hidden="true" />
            <h2 id="preferences-heading" className="text-base font-semibold text-navy">Preferences</h2>
          </div>
          <SheetTrigger onClick={openEdit} className="text-sm font-medium text-teal-ink hover:underline">Edit</SheetTrigger>
        </div>
        {interests.length > 0 || opportunityTypes.length > 0 ? (
          <div className="mt-3 space-y-3">
            {interests.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-navy/45">Interested in</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {interests.map((item) => <span key={item} className="rounded-full bg-[#f6f8f9] px-2.5 py-1 text-xs text-navy/58">{item}</span>)}
                </div>
              </div>
            )}
            {opportunityTypes.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-navy/45">Looking for</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {opportunityTypes.map((item) => <span key={item} className="rounded-full bg-[#f6f8f9] px-2.5 py-1 text-xs text-navy/58">{item}</span>)}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-navy/55">
            No preferences set yet. <SheetTrigger onClick={openEdit} className="font-medium text-teal-ink hover:underline">Add preferences →</SheetTrigger>
          </p>
        )}
      </section>

      <SheetContent className="flex flex-col gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b border-navy/8 px-5 py-4">
          <SheetTitle>Edit preferences</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-5 px-5 py-5">
          <ChipMultiSelect label="Fields / career areas you're interested in" options={FIELD_OPTIONS} value={interestsDraft} onChange={setInterestsDraft} />
          <ChipMultiSelect label="Type of opportunities you're looking for" options={OPPORTUNITY_TYPE_OPTIONS} value={typesDraft} onChange={setTypesDraft} />
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
