import type { Challenge } from "@/lib/ai";
import { AI_USAGE_MODE_LABEL, DELIVERABLE_TYPE_LABEL, type ChallengeDraft } from "@/lib/ai/challenge-clarification-schemas";
import { estimateMinutesFromLabel } from "@/lib/opportunities/challenge-duration";

/**
 * Maps Ask internIn's rich, authoring-time ChallengeDraft (flat typed
 * tasks, materials, weighted rubric, safety notes, assumptions — see
 * challenge-clarification-schemas.ts) onto the app's real, simpler
 * Challenge shape (src/lib/ai/schemas.ts) that the live challenge
 * pipeline, candidate submission flow, and evaluation code actually read.
 * Nothing the model wrote is dropped: fields the target schema has no
 * dedicated place for (deliverable type, AI usage policy, safety notes,
 * assumptions) are folded into each task's description or the scenario
 * text as clearly-labeled prose, so a human reviewing it in the existing
 * Challenge Builder still sees every real detail.
 *
 * Plain sync helper, deliberately kept OUT of the "use server" actions
 * file — a "use server" module may only export async functions as
 * runtime values.
 */
export function mapChallengeDraftToChallenge(draft: ChallengeDraft): Challenge {
  const tasks = draft.tasks.map((task) => ({
    id: crypto.randomUUID(),
    title: task.title,
    description: `[${DELIVERABLE_TYPE_LABEL[task.deliverableType]}] ${task.instructions}`,
  }));

  const scenarioParts = [
    draft.scenario,
    draft.aiUsagePolicyMode
      ? `AI usage policy: ${draft.aiUsagePolicyMode === "custom" && draft.aiUsagePolicyCustomText ? draft.aiUsagePolicyCustomText : AI_USAGE_MODE_LABEL[draft.aiUsagePolicyMode]}`
      : null,
    draft.safetyNotes.length ? `Safety notes: ${draft.safetyNotes.join(" ")}` : null,
    draft.assumptions.length ? `Assumptions (ask internIn to change any of these if wrong): ${draft.assumptions.join(" ")}` : null,
  ].filter((line): line is string => Boolean(line));

  return {
    title: draft.title,
    scenario: scenarioParts.join("\n\n"),
    // The human label (usually "30-60 minutes" or "60-90 minutes") is canonical and always carried
    // through untouched. estimatedMinutes only backs the database's
    // required numeric column — derived from that SAME label when the
    // model didn't also give a number, never an unrelated hardcoded
    // default (the old bug was a card showing one duration while
    // this used to silently fall back to a flat 60).
    estimatedMinutes: draft.durationMinutes ?? estimateMinutesFromLabel(draft.estimatedDurationLabel) ?? 60,
    estimatedDurationLabel: draft.estimatedDurationLabel ?? null,
    skills: draft.skills,
    tasks,
    // Prefer the model's own explicit deliverables summary; only fall
    // back to task titles for a draft generated before that field
    // existed (an older saved draft, or a manual edit that cleared it).
    deliverables: draft.deliverables.length ? draft.deliverables : tasks.map((t) => t.title),
    files: draft.materials.map((m) => ({
      name: m.name,
      description: m.description ?? m.type,
      resourceType: m.resourceType,
      artifactKind: m.artifactKind,
      externalUrl: m.externalUrl ?? null,
      contentSpec: m.contentSpec ?? null,
    })),
    rubric: draft.rubric.map((r) => ({
      criterion: r.criterion,
      weight: r.weight,
      description: r.description ?? "",
    })),
    submissionRequirements: draft.submissionRequirements.map((r) => ({
      id: r.id,
      label: r.label,
      inputMode: r.inputMode,
      artifactKind: r.artifactKind,
      required: r.required,
      acceptedFormats: r.acceptedFormats,
      providers: r.providers,
      instructions: r.instructions ?? undefined,
    })),
    status: "ai_generated",
  };
}
