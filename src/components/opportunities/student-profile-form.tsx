"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateStudentProfileAction } from "@/lib/opportunities/student-actions";

type ProfileValues = {
  university: string;
  major: string;
  graduationYear: string;
  interests: string;
  skills: string;
  availability: string;
  cvUrl: string;
};

function toList(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function StudentProfileForm({ initial }: { initial: ProfileValues }) {
  const [values, setValues] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof ProfileValues>(key: K, value: string) {
    setSaved(false);
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updateStudentProfileAction({
          university: values.university,
          major: values.major,
          graduationYear: values.graduationYear ? Number(values.graduationYear) : undefined,
          interests: toList(values.interests),
          skills: toList(values.skills),
          availability: values.availability,
          cvUrl: values.cvUrl,
        });
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save your profile. Try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="university" className="text-sm font-medium text-navy">
            University
          </label>
          <Input
            id="university"
            value={values.university}
            onChange={(e) => set("university", e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <label htmlFor="major" className="text-sm font-medium text-navy">
            Major
          </label>
          <Input id="major" value={values.major} onChange={(e) => set("major", e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <label htmlFor="graduation-year" className="text-sm font-medium text-navy">
            Graduation year
          </label>
          <Input
            id="graduation-year"
            type="number"
            value={values.graduationYear}
            onChange={(e) => set("graduationYear", e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <label htmlFor="availability" className="text-sm font-medium text-navy">
            Availability
          </label>
          <Input
            id="availability"
            placeholder="e.g. 20 hours/week, starting June"
            value={values.availability}
            onChange={(e) => set("availability", e.target.value)}
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <label htmlFor="skills" className="text-sm font-medium text-navy">
          Skills
        </label>
        <Input
          id="skills"
          placeholder="Excel, SQL, Figma…"
          value={values.skills}
          onChange={(e) => set("skills", e.target.value)}
          className="mt-1.5"
        />
        <p className="mt-1 text-xs text-navy/50">Comma-separated.</p>
      </div>

      <div>
        <label htmlFor="interests" className="text-sm font-medium text-navy">
          Interests
        </label>
        <Input
          id="interests"
          placeholder="Data analysis, marketing, product…"
          value={values.interests}
          onChange={(e) => set("interests", e.target.value)}
          className="mt-1.5"
        />
        <p className="mt-1 text-xs text-navy/50">Comma-separated.</p>
      </div>

      <div>
        <label htmlFor="cv-url" className="text-sm font-medium text-navy">
          CV link (optional)
        </label>
        <Input
          id="cv-url"
          type="url"
          placeholder="https://…"
          value={values.cvUrl}
          onChange={(e) => set("cvUrl", e.target.value)}
          className="mt-1.5"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save profile"}
        </Button>
        {saved && !isPending && <span className="text-sm text-teal-ink">Saved.</span>}
      </div>
    </form>
  );
}
