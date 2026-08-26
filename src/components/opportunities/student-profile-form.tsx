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

// Curated from Qatar's official/current institution listings (Ministry of
// Education and Higher Education, cross-checked against Wikipedia's Qatar
// universities page), not a live scrape — this list changes rarely enough
// that a runtime scraper would be slower and more fragile than maintaining
// a static list. "Other" covers anything not listed or since renamed/closed.
const QATAR_UNIVERSITIES = [
  "Qatar University",
  "Hamad Bin Khalifa University",
  "University of Doha for Science and Technology",
  "Community College of Qatar",
  "Doha Institute for Graduate Studies",
  "Lusail University",
  "Qatar Aeronautical College",
  "University Foundation College",
  "Carnegie Mellon University in Qatar",
  "Georgetown University in Qatar",
  "Northwestern University in Qatar",
  "Texas A&M University at Qatar",
  "Virginia Commonwealth University School of the Arts in Qatar",
  "Weill Cornell Medicine - Qatar",
  "HEC Paris in Qatar",
  "Stenden University Qatar",
  "National University of Malaysia (UKM Qatar)",
  "AFG College (University of Aberdeen partnership)",
  "ARIU (University of Derby partnership)",
  "City University Qatar",
  "Arkansas State University (Qatar)",
  "Northumbria University (Qatar)",
];

// Sourced via Firecrawl from edarabia.com/schools/qatar/ (a maintained Gulf
// school directory), not memory-based — still not exhaustive (Qatar has
// 100+ K-12 schools across curricula), "Other" covers anything not listed.
const QATAR_SCHOOLS = [
  "GEMS American Academy Qatar",
  "GEMS Wellington School",
  "Swiss International School (SISQ)",
  "Arab International Academy - Doha",
  "Kings College Doha",
  "Arab International Academy - Lusail",
  "American School of Doha",
  "The Hamilton International School",
  "ACS Doha International School",
  "The Cambridge School, Doha",
  "Park House English School",
  "Doha College, Al Wajba Campus",
  "International School of London - Qatar",
  "Nord Anglia International School Al Khor",
  "Northview International School",
  "Doha Modern Indian School",
  "Blyth Academy",
  "Doha English Speaking School",
  "Sherborne Qatar",
  "Al Wataniya International School - AWIS",
  "American Academy School",
  "Birla Public School",
  "MES Indian School",
  "Michael E. DeBakey High School",
  "Qatar International School",
  "A Qatari public/government school",
];

const QATAR_CITIES = [
  "Doha",
  "Al Rayyan",
  "Al Wakrah",
  "Umm Salal",
  "Al Khor",
  "Al Daayen",
  "Al Shamal",
  "Al Shahaniya",
  "Dukhan",
  "Mesaieed",
  "Lusail",
];

const MAJORS = [
  "Computer Science",
  "Information Technology",
  "Data Science",
  "Business Administration",
  "Marketing",
  "Finance",
  "Accounting",
  "Economics",
  "Mechanical Engineering",
  "Electrical Engineering",
  "Civil Engineering",
  "Petroleum Engineering",
  "Architecture",
  "Graphic Design",
  "Communication / Media",
  "Psychology",
  "Biology",
  "Medicine",
  "Law",
  "International Relations",
  "Human Resources",
  "Education",
];

function currentYearRange() {
  const now = new Date().getFullYear();
  const years: number[] = [];
  for (let y = now - 6; y <= now + 8; y++) years.push(y);
  return years;
}

const selectClassName =
  "mt-1.5 h-8 w-full rounded-lg border border-gray-cool/60 bg-transparent px-2.5 text-sm text-navy outline-none focus-visible:border-teal";

function SelectWithOther({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [otherMode, setOtherMode] = useState(() => value !== "" && !options.includes(value));
  const selectValue = otherMode ? "Other" : value;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-navy">
        {label}
      </label>
      <select
        id={id}
        value={selectValue}
        onChange={(e) => {
          if (e.target.value === "Other") {
            setOtherMode(true);
            onChange("");
          } else {
            setOtherMode(false);
            onChange(e.target.value);
          }
        }}
        className={selectClassName}
      >
        <option value="" disabled>
          Select…
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value="Other">Other (type your own)</option>
      </select>
      {otherMode && (
        <Input
          className="mt-2"
          placeholder="Type it in"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

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
  const institutionOptions = stage === "high_school" ? QATAR_SCHOOLS : QATAR_UNIVERSITIES;
  const years = currentYearRange();

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
            <SelectWithOther
              key={`${stage}-institution`}
              id="university"
              label={stageLabels.institution}
              options={institutionOptions}
              value={values.university}
              onChange={(v) => set("university", v)}
            />
          )}
          {stageLabels.program && (
            <SelectWithOther
              key={`${stage}-program`}
              id="major"
              label={stageLabels.program}
              options={MAJORS}
              value={values.major}
              onChange={(v) => set("major", v)}
            />
          )}
          {stageLabels.year && (
            <div>
              <label htmlFor="graduation-year" className="text-sm font-medium text-navy">
                {stageLabels.year}
              </label>
              <select
                id="graduation-year"
                value={values.graduationYear}
                onChange={(e) => set("graduationYear", e.target.value)}
                className={selectClassName}
              >
                <option value="" disabled>
                  Select…
                </option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
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

      <SelectWithOther
        id="location"
        label="Location"
        options={QATAR_CITIES}
        value={values.location}
        onChange={(v) => set("location", v)}
      />

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
