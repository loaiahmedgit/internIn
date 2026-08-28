"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThinkingIndicator } from "@/components/ai/thinking-indicator";
import { ChallengeBuilder } from "@/components/challenges/challenge-builder";
import type { Challenge, InternshipDraft } from "@/lib/ai";
import { generateInternshipAction, generateChallengeAction } from "@/lib/ai/actions";
import { createOpportunityAction, saveChallengeVersionAction } from "@/lib/opportunities/actions";
import { ArrowRight, ArrowLeft, Sparkles, X, Plus } from "lucide-react";

type Step = "describe-role" | "review-internship" | "describe-work" | "challenge";

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
      const id = await createOpportunityAction(internship);
      setOpportunityId(id);
      setStep("describe-work");
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

  function updateInternship<K extends keyof InternshipDraft>(key: K, value: InternshipDraft[K]) {
    if (!internship) return;
    setInternship({ ...internship, [key]: value });
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Stepper step={step} />

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
              <Field label="Slots">
                <Input
                  type="number"
                  value={internship.slots}
                  onChange={(e) => updateInternship("slots", Number(e.target.value))}
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
              {loading ? "Saving..." : "Continue to Challenge Builder"}
              {!loading && <ArrowRight className="ml-1.5 size-4" />}
            </Button>
          </div>
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
              <Button
                onClick={handleGenerateChallenge}
                disabled={!workDescription.trim()}
                size="lg"
                className="bg-teal text-white hover:bg-teal/90"
              >
                <Sparkles className="mr-1.5 size-4" /> Generate Challenge
              </Button>
            </div>
          )}
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
