"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SheetClose } from "@/components/ui/sheet";
import { updateStudentIdentityAction } from "@/lib/opportunities/student-profile-sections-actions";

/**
 * The Edit Profile sheet's ONLY content — about/location/availability.
 * Photo and banner are edited in place on the hero itself (ProfileHeroMedia).
 * Education, skills, portfolio, preferences, and CV each manage themselves
 * elsewhere on the page — this is deliberately small.
 */
export function IdentityEditorFields({ bio: initialBio, location: initialLocation, availability: initialAvailability }: { bio: string; location: string; availability: string }) {
  const router = useRouter();
  const [bio, setBio] = useState(initialBio);
  const [location, setLocation] = useState(initialLocation);
  const [availability, setAvailability] = useState(initialAvailability);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateStudentIdentityAction({ bio, location, availability });
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
        <Input id="identity-location" value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1.5" />
      </div>
      <div>
        <label htmlFor="identity-availability" className="text-sm font-medium text-navy">Availability</label>
        <Input id="identity-availability" placeholder="20 hours/week, starting June…" value={availability} onChange={(e) => setAvailability(e.target.value)} className="mt-1.5" />
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
