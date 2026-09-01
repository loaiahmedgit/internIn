import type { Challenge } from "@/lib/ai";
import { CHALLENGE_ITEM_KIND_LABEL, type ChallengeDraft } from "@/lib/ai/challenge-clarification-schemas";

/**
 * Maps Ask internIn's rich, authoring-time ChallengeDraft (sections of
 * typed items, competencies, safety notes, assumptions — see
 * challenge-clarification-schemas.ts) onto the app's real, simpler
 * Challenge shape (src/lib/ai/schemas.ts) that the live challenge
 * pipeline, candidate submission flow, and evaluation code actually read.
 * Nothing the model wrote is dropped: fields the target schema has no
 * dedicated place for (objective, safety notes, assumptions) are folded
 * into the scenario text as clearly-labeled prose, so a human reviewing
 * it in the existing Challenge Builder still sees every real detail.
 *
 * Plain sync helper, deliberately kept OUT of the "use server" actions
 * file — a "use server" module may only export async functions as
 * runtime values.
 */
export function mapChallengeDraftToChallenge(draft: ChallengeDraft): Challenge {
  const tasks = draft.sections.flatMap((section) =>
    section.items.map((item) => ({
      id: crypto.randomUUID(),
      title: item.title,
      description: [
        `[${CHALLENGE_ITEM_KIND_LABEL[item.kind]} — ${section.title}] ${item.prompt}`,
        item.choices?.length ? `Choices: ${item.choices.join(" | ")}` : null,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
    })),
  );

  const scenarioParts = [
    draft.scenario,
    `Objective: ${draft.objective}`,
    `Candidate instructions: ${draft.candidateInstructions}`,
    draft.aiUsagePolicy ? `AI usage policy: ${draft.aiUsagePolicy.replaceAll("_", " ")}` : null,
    draft.safetyNotes?.length ? `Safety notes: ${draft.safetyNotes.join(" ")}` : null,
    draft.assumptions?.length ? `Assumptions (ask internIn to change any of these if wrong): ${draft.assumptions.join(" ")}` : null,
  ].filter((line): line is string => Boolean(line));

  return {
    title: draft.title,
    scenario: scenarioParts.join("\n\n"),
    estimatedMinutes: draft.estimatedMinutes,
    skills: draft.competencies.map((c) => c.name),
    tasks,
    deliverables: draft.deliverables,
    files: draft.materials,
    rubric: draft.evaluationRubric.map((r) => ({
      criterion: `${r.criterion} (${r.weightPercent}%)`,
      description: r.description,
    })),
    status: "ai_generated",
  };
}
