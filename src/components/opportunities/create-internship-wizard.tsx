"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThinkingIndicator } from "@/components/ai/thinking-indicator";
import { ChallengeBuilder } from "@/components/challenges/challenge-builder";
import type { Challenge, InternshipDraft } from "@/lib/ai";
import { generateInternshipAction, generateChallengeAction } from "@/lib/ai/actions";
import { createOpportunityAction, saveChallengeVersionAction, publishOpportunityAction } from "@/lib/opportunities/actions";
import { toDateInputValue } from "@/lib/format-date";
import { APPLICATION_MODE_LABEL, APPLICATION_MODE_COMPANY_DESCRIPTION, type ApplicationMode } from "@/lib/opportunities/application-mode";
import { ArrowRight, ArrowLeft, Sparkles, X, Plus } from "lucide-react";

const APPLICATION_MODE_OPTIONS: ApplicationMode[] = ["quick_apply", "optional_challenge", "challenge_required"];

type Step = "describe-role" | "review-internship" | "describe-work" | "challenge" | "quick-apply-done";

/** Minimum viable Challenge per ChallengeSchema — obvious "replace me"
 * placeholder text in every required field, so a company can reach
 * ChallengeBuilder and fill in the real thing with zero AI calls. */
function buildBlankChallenge(role: string): Challenge {
  return {
    title: `${role} challenge`,
    scenario: "Describe the scenario the candidate will work through — replace this placeholder with real context about the task.",
    estimatedMinutes: 60,
    estimatedDurationLabel: "45-75 minutes",
    skills: [],
    tasks: [{ id: "task-1", title: "First task", description: "Describe what the candidate needs to do." }],
    deliverables: ["Describe what the candidate must submit."],
    files: [],
    rubric: [{ criterion: "Quality of work", description: "Describe what a strong submission looks like.", weight: 100 }],
    submissionRequirements: [
      { id: "submission-1", label: "Written response", inputMode: "text", artifactKind: "text_response", required: true },
    ],
    status: "draft",
  };
}

const EXAMPLE_PROMPTS = [
  "We need a university student who can clean sales data, use basic SQL and explain insights clearly.",
  "Looking for a marketing intern to help with campaign analysis and competitor research.",
  "A software engineering intern who can help fix bugs and write small features, beginner is okay.",
];

/**
 * `initial` resumes an existing draft instead of starting a fresh wizard —
 * used by /company/opportunities/[id]/setup. The wizard is otherwise
 * entirely client-state with no partial save, so a draft with no challenge
 * yet (or an unpublished challenge already generated) had nowhere to
 * continue from before this; "Continue setup" just landed on the empty
 * candidates page.
 */
export function CreateInternshipWizard({
  initial,
}: {
  initial?: { opportunityId: string; internship: InternshipDraft; challenge?: Challenge };
} = {}) {
  const isResuming = !!initial;
  const [step, setStep] = useState<Step>(() =>
    initial?.challenge ? "challenge" : initial ? "describe-work" : "describe-role",
  );
  const [roleDescription, setRoleDescription] = useState("");
  const [internship, setInternship] = useState<InternshipDraft | null>(() => initial?.internship ?? null);
  const [workDescription, setWorkDescription] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(() => initial?.challenge ?? null);
  const [loading, setLoading] = useState(false);
  const [opportunityId, setOpportunityId] = useState<string | null>(() => initial?.opportunityId ?? null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [applicationMode, setApplicationMode] = useState<ApplicationMode>("optional_challenge");

  async function handleGenerateInternship() {
    if (!roleDescription.trim()) return;
    setLoading(true);
    try {
      const draft = await generateInternshipAction({ description: roleDescription });
      setInternship(draft);
      setStep("review-internship");
    } finally {
      setLoading(false);
    }
  }

  async function handleContinueToChallengeBuilder() {
    if (!internship) return;
    setSaveError(null);
    setLoading(true);
    try {
      const id = await createOpportunityAction(internship, applicationMode);
      setOpportunityId(id);
      // R2 §6/§9 — quick_apply never forces Challenge configuration; publish
      // immediately (the shared publish gate skips the challenge check
      // entirely for this mode) instead of routing through the wizard's
      // Challenge steps.
      if (applicationMode === "quick_apply") {
        await publishOpportunityAction(id);
        setStep("quick-apply-done");
      } else {
        setStep("describe-work");
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save this internship listing.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateChallenge() {
    if (!internship || !workDescription.trim() || !opportunityId) return;
    setSaveError(null);
    setLoading(true);
    try {
      const c = await generateChallengeAction({ internship, workDescription });
      await saveChallengeVersionAction(opportunityId, c, "ai_generated");
      setChallenge(c);
      setStep("challenge");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Generated, but couldn't save it to the database.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Manual path — the challenge-creation flow must never hard-depend on the
   * AI provider being up (Phase 5 §8; reproduced this session: an
   * OpenRouter outage left "Generate Challenge" as the only way in, with no
   * way to reach ChallengeBuilder at all). Seeds the minimum a real
   * challenge needs (ChallengeSchema requires >=1 task/deliverable/rubric
   * row/submission requirement to save at all) as obvious placeholder text,
   * saved as "human_edited" — no model call — then hands off straight to
   * ChallengeBuilder, where every field is a normal editable input.
   */
  async function handleStartManualChallenge() {
    if (!internship || !opportunityId) return;
    setSaveError(null);
    setLoading(true);
    try {
      const template = buildBlankChallenge(internship.role);
      await saveChallengeVersionAction(opportunityId, template, "human_edited");
      setChallenge(template);
      setStep("challenge");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't start the challenge.");
    } finally {
      setLoading(false);
    }
  }

  function updateInternship<K extends keyof InternshipDraft>(key: K, value: InternshipDraft[K]) {
    if (!internship) return;
    setInternship({ ...internship, [key]: value });
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      {step !== "quick-apply-done" && <Stepper step={step} />}

      {step === "describe-role" && (
        <div className="mt-10">
          <h1 className="text-2xl font-bold text-navy">Create an internship</h1>
          <p className="mt-2 text-sm text-navy/60">
            Describe the role in plain language — internIn&apos;s AI will turn it into a
            structured listing.
          </p>
          <Textarea
            value={roleDescription}
            onChange={(e) => setRoleDescription(e.target.value)}
            placeholder="e.g. We need a university student who can clean sales data, use basic SQL and explain insights clearly."
            className="mt-6 min-h-32"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => setRoleDescription(p)}
                className="rounded-full border border-gray-cool/60 px-3 py-1 text-xs text-navy/60 hover:border-teal/40 hover:text-teal"
              >
                {p.length > 40 ? p.slice(0, 40) + "…" : p}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="mt-6">
              <ThinkingIndicator label="Generating internship listing..." />
            </div>
          ) : (
            <Button
              onClick={handleGenerateInternship}
              disabled={!roleDescription.trim()}
              size="lg"
              className="mt-6 bg-teal text-white hover:bg-teal/90"
            >
              <Sparkles className="mr-1.5 size-4" /> Generate with AI
            </Button>
          )}
        </div>
      )}

      {step === "review-internship" && internship && (
        <div className="mt-10">
          <h1 className="text-2xl font-bold text-navy">Review the listing</h1>
          <p className="mt-2 text-sm text-navy/60">AI proposed this — edit anything before continuing.</p>

          <div className="mt-6 space-y-4 rounded-xl border border-gray-cool/60 bg-white p-6">
            <Field label="Role">
              <Input value={internship.role} onChange={(e) => updateInternship("role", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Duration">
                <Input value={internship.duration} onChange={(e) => updateInternship("duration", e.target.value)} />
              </Field>
              <Field label="Hours / week">
                <Input
                  type="number"
                  value={internship.hoursPerWeek}
                  onChange={(e) => updateInternship("hoursPerWeek", Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Location">
                <Input value={internship.location} onChange={(e) => updateInternship("location", e.target.value)} />
              </Field>
              <Field label="Work mode">
                <select
                  value={internship.workMode ?? ""}
                  onChange={(e) =>
                    updateInternship("workMode", (e.target.value || null) as InternshipDraft["workMode"])
                  }
                  className="h-9 w-full rounded-lg border border-navy/15 bg-white px-2.5 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                >
                  <option value="">Not specified</option>
                  <option value="remote">Remote</option>
                  <option value="onsite">On-site</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Openings">
                <Input
                  type="number"
                  value={internship.slots}
                  onChange={(e) => updateInternship("slots", Number(e.target.value))}
                />
              </Field>
              <Field label="Application deadline (optional)">
                <Input
                  type="date"
                  value={internship.applicationDeadline ? toDateInputValue(internship.applicationDeadline) : ""}
                  onChange={(e) =>
                    updateInternship("applicationDeadline", e.target.value ? new Date(e.target.value) : null)
                  }
                />
              </Field>
            </div>
            <Field label="Skills">
              <SkillEditor
                skills={internship.skills}
                onChange={(skills) => updateInternship("skills", skills)}
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={internship.description}
                onChange={(e) => updateInternship("description", e.target.value)}
                className="min-h-20"
              />
            </Field>
          </div>

          <div className="mt-4 rounded-xl border border-gray-cool/60 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">How should students apply?</p>
            <div className="mt-2.5 space-y-2">
              {APPLICATION_MODE_OPTIONS.map((mode) => (
                <label key={mode} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${applicationMode === mode ? "border-teal/40 bg-teal/5" : "border-navy/10"}`}>
                  <input type="radio" name="applicationMode" value={mode} checked={applicationMode === mode} onChange={() => setApplicationMode(mode)} className="mt-1 size-4 shrink-0 accent-teal-ink" />
                  <span>
                    <span className="block text-sm font-medium text-navy">{APPLICATION_MODE_LABEL[mode]}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-navy/60">{APPLICATION_MODE_COMPANY_DESCRIPTION[mode]}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {saveError && <p className="mt-4 text-sm text-red-600">{saveError}</p>}

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep("describe-role")}>
              <ArrowLeft className="mr-1.5 size-4" /> Back
            </Button>
            <Button
              onClick={handleContinueToChallengeBuilder}
              disabled={loading}
              className="bg-teal text-white hover:bg-teal/90"
            >
              {loading
                ? applicationMode === "quick_apply"
                  ? "Publishing..."
                  : "Saving..."
                : applicationMode === "quick_apply"
                  ? "Publish"
                  : "Continue to Challenge Builder"}
              {!loading && <ArrowRight className="ml-1.5 size-4" />}
            </Button>
          </div>
        </div>
      )}

      {step === "quick-apply-done" && opportunityId && (
        <div className="mt-10">
          <h1 className="text-2xl font-bold text-navy">Published</h1>
          <p className="mt-2 text-sm text-navy/60">
            {internship?.role} is live with Quick Apply — students can apply now with their internIn profile, no Challenge required.
          </p>
          <Button
            className="mt-6 bg-teal text-white hover:bg-teal/90"
            render={<Link href={`/company/opportunities/${opportunityId}`} />}
            nativeButton={false}
          >
            View internship
          </Button>
        </div>
      )}

      {step === "describe-work" && (
        <div className="mt-10">
          <h1 className="text-2xl font-bold text-navy">Create the work challenge</h1>
          <p className="mt-2 text-sm text-navy/60">
            What would this intern actually do day to day? internIn will build a safe,
            simulated version — synthetic data, fictional company, no real internal
            information exposed.
          </p>
          <Textarea
            value={workDescription}
            onChange={(e) => setWorkDescription(e.target.value)}
            placeholder="e.g. Our analysts receive sales files and have to figure out why certain product categories perform badly."
            className="mt-6 min-h-32"
          />

          {saveError && <p className="mt-4 text-sm text-red-600">{saveError}</p>}

          {loading ? (
            <div className="mt-6">
              <ThinkingIndicator label="Building a realistic challenge..." />
            </div>
          ) : (
            <div className={`mt-6 flex items-center ${isResuming ? "justify-end" : "justify-between"}`}>
              {!isResuming && (
                <Button variant="ghost" onClick={() => setStep("review-internship")}>
                  <ArrowLeft className="mr-1.5 size-4" /> Back
                </Button>
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleStartManualChallenge}>
                  Start from scratch
                </Button>
                <Button
                  onClick={handleGenerateChallenge}
                  disabled={!workDescription.trim()}
                  size="lg"
                  className="bg-teal text-white hover:bg-teal/90"
                >
                  <Sparkles className="mr-1.5 size-4" /> Generate Challenge
                </Button>
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-navy/45">
            &quot;Start from scratch&quot; skips AI entirely — you&apos;ll write every field yourself in the challenge editor.
          </p>
        </div>
      )}

      {step === "challenge" && challenge && opportunityId && (
        <div className="mt-10">
          <h1 className="text-2xl font-bold text-navy">{internship?.role} Challenge</h1>
          <p className="mt-2 text-sm text-navy/60">
            Edit anything by hand, or tell the AI what to change. Nothing publishes until you
            explicitly approve it.
          </p>
          <div className="mt-6">
            <ChallengeBuilder challenge={challenge} onChange={setChallenge} opportunityId={opportunityId} />
          </div>
          <Button variant="ghost" onClick={() => setStep("describe-work")} className="mt-6">
            <ArrowLeft className="mr-1.5 size-4" /> Back
          </Button>
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "describe-role", label: "Describe role" },
    { key: "review-internship", label: "Review listing" },
    { key: "describe-work", label: "Describe work" },
    { key: "challenge", label: "Challenge" },
  ];
  const currentIndex = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-2 text-xs text-navy/40">
      {steps.map((s, i) => (
        <span key={s.key} className={i <= currentIndex ? "font-medium text-teal" : ""}>
          {s.label}
          {i < steps.length - 1 && <span className="mx-2 text-gray-cool">→</span>}
        </span>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-navy/40">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function SkillEditor({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((s) => (
        <Badge key={s} variant="secondary" className="gap-1 bg-gray-light text-navy hover:bg-gray-light">
          {s}
          <button onClick={() => onChange(skills.filter((x) => x !== s))} aria-label={`Remove ${s}`}>
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <div className="flex items-center gap-1">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) {
              onChange([...skills, value.trim()]);
              setValue("");
            }
          }}
          placeholder="Add skill"
          aria-label="Add skill"
          className="h-7 w-28 text-xs"
        />
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label="Add skill"
          onClick={() => {
            if (value.trim()) {
              onChange([...skills, value.trim()]);
              setValue("");
            }
          }}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
