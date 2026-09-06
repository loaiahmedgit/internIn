"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SheetClose } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateStudentIdentityAction } from "@/lib/opportunities/student-profile-sections-actions";
import { MUNICIPALITY_OPTIONS, isMunicipality, type Municipality } from "@/lib/qatar-municipalities";

/**
 * The Edit Profile sheet's ONLY content — about + location. Availability
 * removed (was free text that went stale — structured intent lives in
 * Preferences' opportunityTypes instead). Photo and banner are edited in
 * place on the hero itself (ProfileHeroMedia). Education, skills, portfolio,
 * preferences, and CV each manage themselves elsewhere on the page — this
 * is deliberately small.
 */
export function IdentityEditorFields({ bio: initialBio, location: initialLocation }: { bio: string; location: string }) {
  const router = useRouter();
  const [bio, setBio] = useState(initialBio);
  // Only pre-select the municipality Select when the stored value is
  // already one of the 8 canonical values — a legacy/free-text value never
  // gets forced into the control, and saving About-me alone never sends a
  // location the server would reject.
  const [location, setLocation] = useState<Municipality | "">(isMunicipality(initialLocation) ? initialLocation : "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateStudentIdentityAction({ bio, ...(location ? { location } : {}) });
        closeRef.current?.click();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="identity-bio" className="text-sm font-medium text-navy">About me</label>
        <Textarea id="identity-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={600} className="mt-1.5" />
        <p className="mt-1 text-xs text-navy/50">{bio.length}/600</p>
      </div>
      <div>
        <label htmlFor="identity-location" className="text-sm font-medium text-navy">Location</label>
        <Select value={location} onValueChange={(v) => setLocation((v as Municipality) || "")}>
          <SelectTrigger id="identity-location" className="mt-1.5 h-9 w-full">
            <SelectValue placeholder="Select municipality" />
          </SelectTrigger>
          <SelectContent>
            {MUNICIPALITY_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <Button type="button" onClick={save} disabled={isPending} className="h-9 bg-teal text-white hover:bg-teal-ink">{isPending ? "Saving…" : "Save"}</Button>
        <SheetClose
          disabled={isPending}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-navy/12 bg-white px-4 text-sm font-medium text-navy transition-colors hover:bg-navy/4 disabled:opacity-50"
        >
          Cancel
        </SheetClose>
      </div>
      <SheetClose ref={closeRef} className="hidden" aria-hidden="true" />
    </div>
  );
}
