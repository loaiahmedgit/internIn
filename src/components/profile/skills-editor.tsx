"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SkillsCombobox } from "@/components/profile/skills-combobox";
import { PROFILE_SECTION_CLASS, ProfileSectionHeading } from "@/components/profile/profile-section";
import { updateStudentSkillsAction } from "@/lib/opportunities/student-profile-sections-actions";

/** Skills manages itself now — the old giant Edit Profile sheet no longer
 * owns this. Only the skills column is ever written here. */
export function SkillsEditor({ skills }: { skills: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(skills);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openEdit() {
    setDraft(skills);
    setError(null);
    setOpen(true);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateStudentSkillsAction(draft);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <section aria-labelledby="skills-heading" className={PROFILE_SECTION_CLASS}>
        <ProfileSectionHeading
          icon={BarChart3}
          title="Skills"
          headingId="skills-heading"
          action={<SheetTrigger onClick={openEdit} className="text-sm font-medium text-teal-ink hover:underline">Edit</SheetTrigger>}
        />
        {skills.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <span key={skill} className="rounded-full border border-navy/8 bg-white px-2.5 py-1 text-xs text-navy/62">{skill}</span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-navy/55">
            No skills added yet. <SheetTrigger onClick={openEdit} className="font-medium text-teal-ink hover:underline">Add skills →</SheetTrigger>
          </p>
        )}
      </section>

      <SheetContent className="flex flex-col gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b border-navy/8 px-5 py-4">
          <SheetTitle>Edit skills</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 px-5 py-5">
          <div>
            <label className="text-sm font-medium text-navy">Skills</label>
            <div className="mt-1.5">
              <SkillsCombobox value={draft} onChange={setDraft} />
            </div>
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
