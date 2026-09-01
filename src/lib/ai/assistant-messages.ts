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

/** The custom data parts this app streams. `step` is keyed by `id` so a
 * step's status can flip from "active" to "complete" via a second write
 * with the same id (AI SDK v5 data-part reconciliation). `questionnaire`
 * and `challengeDraft` are written once per tool call — the model only
 * ever produces the validated structured shape; rendering is entirely
 * app-controlled (AskInternInQuestionnaire / ChallengeDraftCard). */
export type AssistantUIMessage = UIMessage<
  never,
  {
    step: AssistantStepData;
    questionnaire: ClarificationQuestionsResult;
    challengeDraft: ChallengeDraft;
  }
>;
