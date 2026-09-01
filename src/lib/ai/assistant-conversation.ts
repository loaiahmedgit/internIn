import type { AssistantUIMessage } from "./assistant-messages";
import type { ChallengeDraft } from "./challenge-clarification-schemas";

/** Every text part across the conversation, in order — the raw material
 * the clarification/drafting tools reason over. Kept separate from
 * convertToModelMessages() because those two inner calls want plain text
 * context, not the full ModelMessage/tool-call structure the outer call
 * needs. */
export function transcriptOf(messages: AssistantUIMessage[]): string {
  return messages
    .map((m) => {
      const text = m.parts
        .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
        .map((p) => p.text)
        .join(" ")
        .trim();
      return text ? `${m.role === "user" ? "Employer" : "Assistant"}: ${text}` : null;
    })
    .filter((line): line is string => line !== null)
    .join("\n");
}

/** The most recent challenge draft already produced in this conversation,
 * if any — so a revision request ("make it easier") edits the SAME draft
 * instead of starting a disconnected new one. */
export function latestChallengeDraft(messages: AssistantUIMessage[]): ChallengeDraft | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const part = messages[i].parts.find((p): p is Extract<typeof p, { type: "data-challengeDraft" }> => p.type === "data-challengeDraft");
    if (part) return part.data;
  }
  return null;
}

/** True only when the LAST message is a real, structured questionnaire
 * submission (the Questionnaire's own submit sets this on `sendMessage`'s
 * `metadata`) — never inferred from the message text. When present, the
 * server skips model-driven tool routing entirely for this turn: the
 * employer's submit click already made the decision, asking the model to
 * re-decide is redundant risk, not restraint. */
export function latestQuestionnaireAnswers(messages: AssistantUIMessage[]) {
  const last = messages.at(-1);
  if (last?.role !== "user" || last.metadata?.intent !== "questionnaire_answer") return null;
  return last.metadata.questionnaireAnswers ?? [];
}
