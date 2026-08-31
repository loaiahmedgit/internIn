"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TagListEditor } from "@/components/opportunities/tag-list-editor";
import { saveInternshipAction, assistInternshipCopyAction, type InternshipFormInput } from "@/lib/opportunities/actions";
import { toDateInputValue } from "@/lib/format-date";
import { Sparkles, Building2, Home, Laptop } from "lucide-react";

type FormState = InternshipFormInput & { applicationDeadlineInput: string; startDateInput: string };

function toFormState(initial?: Partial<InternshipFormInput>): FormState {
  return {
    role: initial?.role ?? "",
    department: initial?.department ?? "",
    shortDescription: initial?.shortDescription ?? "",
    description: initial?.description ?? "",
    whatYouWillLearn: initial?.whatYouWillLearn ?? "",
    requirements: initial?.requirements ?? [],
    niceToHave: initial?.niceToHave ?? [],
    duration: initial?.duration ?? "8 weeks",
    hoursPerWeek: initial?.hoursPerWeek ?? 20,
    location: initial?.location ?? "",
    workMode: initial?.workMode ?? null,
    applicationDeadline: initial?.applicationDeadline ?? null,
    applicationDeadlineInput: initial?.applicationDeadline ? toDateInputValue(new Date(initial.applicationDeadline)) : "",
    startDate: initial?.startDate ?? null,
    startDateInput: initial?.startDate ? toDateInputValue(new Date(initial.startDate)) : "",
    slots: initial?.slots ?? 1,
    skills: initial?.skills ?? [],
    requireCv: initial?.requireCv ?? true,
    applicationQuestions: initial?.applicationQuestions ?? [],
  };
}

const WORK_MODE_OPTIONS: { value: "onsite" | "hybrid" | "remote"; label: string; icon: typeof Building2 }[] = [
  { value: "onsite", label: "On-site", icon: Building2 },
  { value: "hybrid", label: "Hybrid", icon: Laptop },
  { value: "remote", label: "Remote", icon: Home },
];

const SECTION_CLASS = "rounded-xl border border-navy/10 bg-white shadow-none";
const FIELD_LABEL_CLASS = "text-xs font-semibold uppercase tracking-wide text-navy/45";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      {hint && <span className="ml-2 text-xs font-normal text-navy/40">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function AssistButton({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={loading} className="h-7 gap-1.5 text-xs">
      <Sparkles className="size-3.5 text-teal-ink" />
      {loading ? "Thinking…" : label}
    </Button>
  );
}

/**
 * Manual-first: every field is a real input the recruiter fills in
 * directly. AI only ever assists one field/section at a time via an
 * explicit button — never a mandatory step, never a gate on saving.
 */
export function CreateInternshipForm({
  opportunityId,
  initial,
}: {
  opportunityId?: string;
  initial?: Partial<InternshipFormInput>;
} = {}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [assisting, setAssisting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function runAssist(task: "draft_description" | "improve_description" | "suggest_requirements" | "suggest_learning_outcomes") {
    setAssisting(task);
    setError(null);
    try {
      const result = await assistInternshipCopyAction({
        task,
        role: form.role,
        shortDescription: form.shortDescription || undefined,
        fullDescription: form.description || undefined,
        requirements: form.requirements,
      });
      if (result.description) update("description", result.description);
      if (result.items && task === "suggest_requirements") update("requirements", [...form.requirements, ...result.items]);
      if (result.items && task === "suggest_learning_outcomes") {
        const merged = [form.whatYouWillLearn, ...result.items.map((i) => `• ${i}`)].filter(Boolean).join("\n");
        update("whatYouWillLearn", merged);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI assist failed — try again, or write it by hand.");
    } finally {
      setAssisting(null);
    }
  }

  function save(publish: boolean) {
    if (!form.role.trim() || !form.description.trim() || !form.location.trim()) {
      setError("Title, description, and location are required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const payload: InternshipFormInput = {
          ...form,
          applicationDeadline: form.applicationDeadlineInput ? new Date(form.applicationDeadlineInput) : null,
          startDate: form.startDateInput ? new Date(form.startDateInput) : null,
        };
        const id = await saveInternshipAction({ opportunityId, publish, form: payload });
        router.push(`/company/opportunities/${id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save this internship.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy">{opportunityId ? "Edit internship" : "Create an internship"}</h1>
          <p className="mt-1 text-sm text-navy/55">Fill in the details yourself — AI is there to help if you want it, never required.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" disabled={isPending} onClick={() => save(false)}>
            {isPending ? "Saving…" : "Save draft"}
          </Button>
          <Button type="button" className="bg-teal text-white hover:bg-teal/90" disabled={isPending} onClick={() => save(true)}>
            {isPending ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 space-y-5">
        <Card className={SECTION_CLASS}>
          <CardHeader>
            <CardTitle>Basic information</CardTitle>
            <CardDescription>What this internship is called and what team it&apos;s on.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Internship title">
              <Input value={form.role} onChange={(e) => update("role", e.target.value)} placeholder="e.g. Data Analyst Intern" />
            </Field>
            <Field label="Department / team" hint="optional">
              <Input value={form.department ?? ""} onChange={(e) => update("department", e.target.value)} placeholder="e.g. Operations" />
            </Field>
            <Field label="Short description" hint="a one- or two-line summary, shown in lists">
              <Textarea value={form.shortDescription ?? ""} onChange={(e) => update("shortDescription", e.target.value)} className="min-h-16" placeholder="A quick summary of the role" />
            </Field>
          </CardContent>
        </Card>

        <Card className={SECTION_CLASS}>
          <CardHeader>
            <CardTitle>Role details</CardTitle>
            <CardDescription>What the intern will actually do, learn, and need.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="Full description">
              <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} className="min-h-32" placeholder="Describe the role in full — this is what applicants see." />
              <div className="mt-2 flex flex-wrap gap-2">
                <AssistButton label="Draft description with AI" loading={assisting === "draft_description"} onClick={() => runAssist("draft_description")} />
                <AssistButton label="Improve description" loading={assisting === "improve_description"} onClick={() => runAssist("improve_description")} />
              </div>
            </Field>
            <Separator />
            <Field label="What the intern will learn" hint="optional">
              <Textarea value={form.whatYouWillLearn ?? ""} onChange={(e) => update("whatYouWillLearn", e.target.value)} className="min-h-20" placeholder="Concrete skills or experience they'll walk away with" />
              <div className="mt-2">
                <AssistButton label="Suggest learning outcomes" loading={assisting === "suggest_learning_outcomes"} onClick={() => runAssist("suggest_learning_outcomes")} />
              </div>
            </Field>
            <Separator />
            <Field label="Requirements" hint="optional">
              <TagListEditor items={form.requirements} onChange={(v) => update("requirements", v)} placeholder="e.g. Comfortable with Excel" emptyHint="No requirements added yet." />
              <div className="mt-2">
                <AssistButton label="Suggest requirements" loading={assisting === "suggest_requirements"} onClick={() => runAssist("suggest_requirements")} />
              </div>
            </Field>
            <Field label="Nice-to-have" hint="optional">
              <TagListEditor items={form.niceToHave} onChange={(v) => update("niceToHave", v)} placeholder="e.g. Prior internship experience" emptyHint="No nice-to-haves added yet." />
            </Field>
            <Field label="Skills" hint="shown as tags on the listing">
              <TagListEditor items={form.skills} onChange={(v) => update("skills", v)} placeholder="e.g. SQL" emptyHint="No skills added yet." />
            </Field>
          </CardContent>
        </Card>

        <Card className={SECTION_CLASS}>
          <CardHeader>
            <CardTitle>Logistics</CardTitle>
            <CardDescription>Duration, location, and timing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Duration">
                <Input value={form.duration} onChange={(e) => update("duration", e.target.value)} placeholder="e.g. 8 weeks" />
              </Field>
              <Field label="Hours / week">
                <Input type="number" min={1} max={60} value={form.hoursPerWeek} onChange={(e) => update("hoursPerWeek", Number(e.target.value))} />
              </Field>
            </div>
            <Field label="Location">
              <Input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="e.g. Doha, Qatar" />
            </Field>
            <Field label="Mode">
              <ToggleGroup
                variant="outline"
                value={form.workMode ? [form.workMode] : []}
                onValueChange={(v) => update("workMode", (v[0] as FormState["workMode"]) ?? null)}
              >
                {WORK_MODE_OPTIONS.map((opt) => (
                  <ToggleGroupItem key={opt.value} value={opt.value} aria-label={opt.label} className="gap-1.5 px-3">
                    <opt.icon className="size-3.5" />
                    {opt.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Application deadline" hint="optional">
                <Input type="date" value={form.applicationDeadlineInput} onChange={(e) => update("applicationDeadlineInput", e.target.value)} />
              </Field>
              <Field label="Start date" hint="optional">
                <Input type="date" value={form.startDateInput} onChange={(e) => update("startDateInput", e.target.value)} />
              </Field>
            </div>
            <Field label="Number of openings">
              <Input type="number" min={1} max={100} value={form.slots} onChange={(e) => update("slots", Number(e.target.value))} className="max-w-32" />
            </Field>
          </CardContent>
        </Card>

        <Card className={SECTION_CLASS}>
          <CardHeader>
            <CardTitle>Application settings</CardTitle>
            <CardDescription>What applicants need to provide.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-navy">Require CV</p>
                <p className="text-xs text-navy/50">Applicants must attach a CV to apply.</p>
              </div>
              <Switch checked={form.requireCv} onCheckedChange={(v) => update("requireCv", v)} />
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium text-navy">Include challenge</p>
              <p className="text-xs text-navy/50">
                {opportunityId
                  ? "Add or manage the challenge from the Challenge tab after saving."
                  : "You'll be able to build a challenge from the internship's Challenge tab right after saving."}
              </p>
            </div>
            <Separator />
            <Field label="Additional application questions" hint="optional">
              <TagListEditor items={form.applicationQuestions} onChange={(v) => update("applicationQuestions", v)} placeholder="e.g. Why are you interested in this role?" emptyHint="No extra questions — applicants just submit a CV and, if included, the challenge." />
            </Field>
          </CardContent>
        </Card>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={isPending} onClick={() => save(false)}>
          {isPending ? "Saving…" : "Save draft"}
        </Button>
        <Button type="button" className="bg-teal text-white hover:bg-teal/90" disabled={isPending} onClick={() => save(true)}>
          {isPending ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </div>
  );
}
