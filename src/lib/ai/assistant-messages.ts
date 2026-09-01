import type { UIMessage } from "ai";
import type { ChallengeDraft, ClarificationQuestionsResult } from "./challenge-clarification-schemas";

/**
 * Real, honest chain-of-thought progress step for the "Ask internIn"
 * streaming assistant. Every field must describe work the server actually
 * did — `description` is always a real value pulled from the computed
 * facts string, never invented flavor text (see UI_IMPLEMENTATION_RULES.md:
 * "structured progress UI may show user-visible tool calls/actions/results
 * only", never fabricated or raw hidden reasoning).
 */
export interface AssistantStepData {
  label: string;
  description?: string;
  status: "active" | "complete";
}

/** A safe, derived "why this looks the way it does" summary for a just-
 * generated challenge draft — built server-side from the real draft's own
 * fields (see challenge-generation.ts), never the model's raw hidden
 * reasoning. Rendered via the AI Elements Reasoning component. */
export interface DesignSummaryData {
  lines: string[];
}

/** A real, honest "this slow thing is happening right now" signal, written
 * the MOMENT a tool starts its slow work (before the generateObject call
 * that actually takes several seconds) — not a fabricated fake step, and
 * not raw model reasoning. Gives the Shimmer fallback a real label
 * ("Preparing a few questions…", "Designing your challenge…") instead of
 * a generic "Thinking…" for the whole wait. Superseded the instant the
 * real result (questionnaire/challengeDraft) renders. */
export interface ProgressData {
  label: string;
}

/** One clarification question's answer, as submitted by the real shadcn
 * Questionnaire — never serialized into a giant chat-bubble string. A
 * `null` answer means the (optional) question was skipped; the app never
 * invents a value for it. */
export interface QuestionnaireAnswer {
  prompt: string;
  answer: string | null;
}

/** Carried on the user message the Questionnaire's submit produces, so the
 * server can deterministically continue straight into drafting instead of
 * asking the model to re-decide what an explicit UI submit already
 * decided. This is a structured UI-driven signal, not text-based intent
 * guessing. */
export interface AssistantMessageMetadata {
  intent?: "questionnaire_answer";
  questionnaireAnswers?: QuestionnaireAnswer[];
}

/** The custom data parts this app streams. `step` is keyed by `id` so a
 * step's status can flip from "active" to "complete" via a second write
 * with the same id (AI SDK v5 data-part reconciliation). `questionnaire`,
 * `challengeDraft`, and `designSummary` are written once per generation —
 * the model only ever produces the validated structured shape; rendering
 * is entirely app-controlled (AskInternInQuestionnaire / ChallengeDraftCard
 * / Reasoning). */
export type AssistantUIMessage = UIMessage<
  AssistantMessageMetadata,
  {
    step: AssistantStepData;
    questionnaire: ClarificationQuestionsResult;
    challengeDraft: ChallengeDraft;
    designSummary: DesignSummaryData;
    progress: ProgressData;
  }
>;
