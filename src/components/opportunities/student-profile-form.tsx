"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateStudentProfileAction } from "@/lib/opportunities/student-actions";

type EducationStage = "high_school" | "university" | "graduate" | "vocational" | "other";

const STAGE_OPTIONS: { value: EducationStage; label: string }[] = [
  { value: "high_school", label: "High school student" },
  { value: "university", label: "University / college student" },
  { value: "graduate", label: "Recent graduate" },
  { value: "vocational", label: "Diploma / vocational student" },
  { value: "other", label: "Other" },
];

const STAGE_FIELD_LABELS: Record<EducationStage, { institution: string; program: string; year: string }> = {
  high_school: { institution: "School", program: "", year: "Expected graduation year" },
  university: { institution: "University / institution", program: "Major / program", year: "Expected graduation year" },
  graduate: { institution: "University / institution", program: "Degree / major", year: "Graduation year" },
  vocational: { institution: "Institution", program: "Program", year: "Expected completion year" },
  other: { institution: "", program: "Current education / career stage", year: "" },
};

type ProfileValues = {
  educationStage: EducationStage | "";
  university: string;
  major: string;
  graduationYear: string;
  location: string;
  interests: string;
  opportunityTypes: string;
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

export function StudentProfileForm({
  initial,
  variant = "full",
}: {
  initial: ProfileValues;
  variant?: "full" | "onboarding";
}) {
  const router = useRouter();
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
    if (variant === "onboarding" && !values.educationStage) {
      setError("Tell us what best describes you.");
      return;
    }
    startTransition(async () => {
      try {
        await updateStudentProfileAction({
          educationStage: values.educationStage || undefined,
          university: values.university,
          major: values.major,
          graduationYear: values.graduationYear ? Number(values.graduationYear) : undefined,
          location: values.location,
          interests: toList(values.interests),
          opportunityTypes: toList(values.opportunityTypes),
          skills: toList(values.skills),
          availability: values.availability,
          cvUrl: values.cvUrl,
        });
        if (variant === "onboarding") {
          router.push("/student/dashboard");
          return;
        }
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save your profile. Try again.");
      }
    });
  }

  const stage = values.educationStage || undefined;
  const stageLabels = stage ? STAGE_FIELD_LABELS[stage] : null;

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label className="text-sm font-medium text-navy">What best describes you?</label>
        <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {STAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set("educationStage", opt.value)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                values.educationStage === opt.value
                  ? "border-teal bg-teal/5 text-teal"
                  : "border-gray-cool/60 text-navy/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {stageLabels && (
        <div className="grid gap-5 sm:grid-cols-2">
          {stageLabels.institution && (
            <div>
              <label htmlFor="university" className="text-sm font-medium text-navy">
                {stageLabels.institution}
              </label>
              <Input
                id="university"
                value={values.university}
                onChange={(e) => set("university", e.target.value)}
                className="mt-1.5"
              />
            </div>
          )}
          {stageLabels.program && (
            <div>
              <label htmlFor="major" className="text-sm font-medium text-navy">
                {stageLabels.program}
              </label>
              <Input
                id="major"
                value={values.major}
                onChange={(e) => set("major", e.target.value)}
                className="mt-1.5"
              />
            </div>
          )}
          {stageLabels.year && (
            <div>
              <label htmlFor="graduation-year" className="text-sm font-medium text-navy">
                {stageLabels.year}
              </label>
              <Input
                id="graduation-year"
                type="number"
                value={values.graduationYear}
                onChange={(e) => set("graduationYear", e.target.value)}
                className="mt-1.5"
              />
            </div>
          )}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="interests" className="text-sm font-medium text-navy">
            Fields / career areas you&apos;re interested in
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
          <label htmlFor="opportunity-types" className="text-sm font-medium text-navy">
            Type of opportunities you&apos;re looking for
          </label>
          <Input
            id="opportunity-types"
            placeholder="Internship, part-time…"
            value={values.opportunityTypes}
            onChange={(e) => set("opportunityTypes", e.target.value)}
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-navy/50">Comma-separated.</p>
        </div>
      </div>

      <div>
        <label htmlFor="location" className="text-sm font-medium text-navy">
          Location
        </label>
        <Input
          id="location"
          placeholder="Doha, Qatar"
          value={values.location}
          onChange={(e) => set("location", e.target.value)}
          className="mt-1.5"
        />
      </div>

      {variant === "full" && (
        <>
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
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : variant === "onboarding" ? "Continue" : "Save profile"}
        </Button>
        {saved && !isPending && <span className="text-sm text-teal-ink">Saved.</span>}
      </div>
    </form>
  );
}
