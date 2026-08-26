"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  updateStudentProfileAction,
  getCvUploadUrlAction,
  extractCvAction,
} from "@/lib/opportunities/student-actions";

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

// Sourced via Firecrawl from the Ministry of Education and Higher
// Education's official page (edu.gov.qa/en/Content/HigherEducationinQatar)
// and cross-verified against MOEHE's own official university-list PDF
// (dated Jan 2026). Still a static list, not a live scrape at request
// time — "Other" covers anything renamed/closed since.
const QATAR_UNIVERSITIES = [
  // Public
  "Qatar University",
  "Community College of Qatar",
  "Qatar Aeronautical Academy",
  "University of Doha for Science and Technology",
  "Qatar Finance and Business Academy (with Northumbria University)",
  "Qatar Leadership Centre (with Georgetown University)",
  "Qatar Olympic Academy (with the University of Lleida, Spain)",
  // Security and military
  "Ahmed Bin Mohammed Military College",
  "Al Zaeem Mohamed Bin Abdullah Al Attiyah Air College (with Aix-Marseille University, France)",
  "Joaan Bin Jassim Academy for Defense Studies",
  "Police Academy",
  "Mohammed Bin Ghanem Al Ghanem Maritime Academy (with the University of Western Brittany, France)",
  "The Cyber Security Academy",
  // Qatar Foundation, Education City
  "Hamad Bin Khalifa University",
  "Georgetown University in Qatar",
  "Northwestern University in Qatar",
  "Virginia Commonwealth University School of Design in Qatar",
  "Texas A&M University at Qatar",
  "Carnegie Mellon University in Qatar",
  "HEC Paris, Doha",
  "Weill Cornell Medicine - Qatar",
  "Qatar Center for Professional Development",
  // Private
  "Al Rayyan International University College (with the University of Derby, UK)",
  "Doha Institute for Graduate Studies",
  "AFG College (with the University of Aberdeen, UK)",
  "University Foundation College",
  "City University Qatar (with Ulster University, UK)",
  "Oryx University (with Liverpool John Moores University, UK)",
  "Lusail University",
  "Global Studies Institute (with Arkansas State University, USA)",
  "MIE (with Savitribai Phule Pune University, India)",
  "The National University of Malaysia (UKM) in Qatar",
  "Barzan University College (with Swinburne University of Technology, Australia)",
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

const selectClassName =
  "mt-1.5 h-8 w-full rounded-lg border border-gray-cool/60 bg-transparent px-2.5 text-sm text-navy outline-none focus-visible:border-teal";

function MultiChipSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const selected = toList(value);
  const [customValue, setCustomValue] = useState("");

  function toggle(option: string) {
    const next = selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option];
    onChange(next.join(", "));
  }

  function addCustom() {
    const trimmed = customValue.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    onChange([...selected, trimmed].join(", "));
    setCustomValue("");
  }

  return (
    <div>
      <label className="text-sm font-medium text-navy">{label}</label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              selected.includes(opt) ? "border-teal bg-teal/5 text-teal" : "border-gray-cool/60 text-navy/60"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          placeholder="Add your own…"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addCustom}>
          Add
        </Button>
      </div>
      {selected.filter((s) => !options.includes(s)).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected
            .filter((s) => !options.includes(s))
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                className="rounded-full border border-teal bg-teal/5 px-3 py-1.5 text-sm font-medium text-teal"
              >
                {s} ×
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// Native browser calendar/month picker (icon + popup with month/year
// navigation) — we only need the year, so it's stored as "YYYY-01" and the
// year is pulled out on submit.
function YearMonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="month"
      value={value ? `${value}-01` : ""}
      onChange={(e) => onChange(e.target.value ? e.target.value.split("-")[0] : "")}
      className={selectClassName}
    />
  );
}

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
  cvFileKey: string;
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
  variant?: "full" | "onboarding" | "preferences";
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [cvBusy, setCvBusy] = useState(false);
  const [cvMessage, setCvMessage] = useState<string | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);

  function set<K extends keyof ProfileValues>(key: K, value: string) {
    setSaved(false);
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleCvUpload(file: File) {
    setCvBusy(true);
    setCvError(null);
    setCvMessage(null);
    try {
      const { token, path } = await getCvUploadUrlAction(file.name);
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from("student-cvs").uploadToSignedUrl(path, token, file);
      if (uploadError) throw new Error(`Couldn't upload the file: ${uploadError.message}`);

      const extracted = await extractCvAction(path);
      const mergedSkills = Array.from(new Set([...toList(values.skills), ...extracted.skills]));
      const mergedInterests = Array.from(new Set([...toList(values.interests), ...extracted.interests]));
      setValues((v) => ({
        ...v,
        skills: mergedSkills.join(", "),
        interests: mergedInterests.join(", "),
        cvFileKey: path,
      }));
      setCvMessage(
        `Found ${extracted.skills.length} skill(s) and ${extracted.interests.length} interest area(s) — review below, then Save profile to keep them.`,
      );
    } catch (err) {
      setCvError(err instanceof Error ? err.message : "Couldn't process that file.");
    } finally {
      setCvBusy(false);
    }
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
          cvFileKey: values.cvFileKey || undefined,
        });
        if (variant === "onboarding") {
          router.push("/student/preferences");
          return;
        }
        if (variant === "preferences") {
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

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      {variant !== "preferences" && (
        <>
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
                  <YearMonthPicker value={values.graduationYear} onChange={(v) => set("graduationYear", v)} />
                </div>
              )}
            </div>
          )}

          <SelectWithOther
            id="location"
            label="Location"
            options={QATAR_CITIES}
            value={values.location}
            onChange={(v) => set("location", v)}
          />
        </>
      )}

      {variant !== "onboarding" && (
        <>
          <MultiChipSelect
            label="Fields / career areas you're interested in"
            options={FIELD_OPTIONS}
            value={values.interests}
            onChange={(v) => set("interests", v)}
          />
          <MultiChipSelect
            label="Type of opportunities you're looking for"
            options={OPPORTUNITY_TYPE_OPTIONS}
            value={values.opportunityTypes}
            onChange={(v) => set("opportunityTypes", v)}
          />
        </>
      )}

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

          <div>
            <label htmlFor="cv-upload" className="text-sm font-medium text-navy">
              Or upload your CV (optional)
            </label>
            <p className="mt-1 text-xs text-navy/50">
              PDF only. We'll pull out skills and interest areas for you to review — nothing saves automatically.
            </p>
            <input
              id="cv-upload"
              type="file"
              accept="application/pdf"
              disabled={cvBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCvUpload(file);
                e.target.value = "";
              }}
              className="mt-1.5 text-sm text-navy/70"
            />
            {cvBusy && <p className="mt-1 text-xs text-navy/50">Reading your CV…</p>}
            {cvMessage && <p className="mt-1 text-xs text-teal-ink">{cvMessage}</p>}
            {cvError && <p className="mt-1 text-xs text-destructive">{cvError}</p>}
            {values.cvFileKey && !cvBusy && !cvMessage && (
              <p className="mt-1 text-xs text-navy/50">A CV is on file.</p>
            )}
          </div>
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : variant !== "full" ? "Continue" : "Save profile"}
        </Button>
        {saved && !isPending && <span className="text-sm text-teal-ink">Saved.</span>}
      </div>
    </form>
  );
}
