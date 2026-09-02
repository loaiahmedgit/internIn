import type { AssistantUIMessage, QuestionnaireAnswer, QuestionnaireContinuation } from "./assistant-messages";
import type { ChallengeDraft } from "./challenge-clarification-schemas";
import type { WorkNeedProfile } from "./role-intelligence-schemas";

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
export function latestQuestionnaireSubmission(messages: AssistantUIMessage[]): {
  answers: QuestionnaireAnswer[];
  continuation: QuestionnaireContinuation;
  roleSummary: string;
} | null {
  const last = messages.at(-1);
  if (last?.role !== "user" || last.metadata?.intent !== "questionnaire_answer") return null;
  return {
    answers: last.metadata.questionnaireAnswers ?? [],
    continuation: last.metadata.questionnaireContinuation ?? "offer_next_action",
    roleSummary: last.metadata.roleSummary ?? "the described role",
  };
}

/** Backwards-compatible answer-only selector used by focused unit tests
 * and any older caller that does not need continuation metadata. */
export function latestQuestionnaireAnswers(messages: AssistantUIMessage[]): QuestionnaireAnswer[] | null {
  return latestQuestionnaireSubmission(messages)?.answers ?? null;
}

/** True only when the LAST message is a real click on the action-offer
 * card's "Create internship draft" / "Create challenge only" button —
 * never inferred from message text (an employer could plausibly type
 * those exact words too; the metadata is what makes this deterministic). */
export function latestActionOfferChoice(messages: AssistantUIMessage[]): {
  kind: "create_internship_draft" | "create_challenge_only";
  roleSummary: string;
  answers: QuestionnaireAnswer[];
  workNeed: WorkNeedProfile | null;
} | null {
  const last = messages.at(-1);
  if (last?.role !== "user") return null;
  if (last.metadata?.intent !== "create_internship_draft" && last.metadata?.intent !== "create_challenge_only") return null;
  return {
    kind: last.metadata.intent,
    roleSummary: last.metadata.roleSummary ?? "",
    answers: last.metadata.questionnaireAnswers ?? [],
    workNeed: last.metadata.generationWorkNeed ?? null,
  };
}

/** True only when the LAST message is a real click on the internship
 * disambiguation picker — the employer's own explicit selection, never a
 * guessed match. */
export function latestInternshipChoice(messages: AssistantUIMessage[]): {
  opportunityId: string;
  revisionInstruction: string;
  operation: "edit_challenge" | "edit_internship";
} | null {
  const last = messages.at(-1);
  if (last?.role !== "user" || last.metadata?.intent !== "internship_choice" || !last.metadata.chosenOpportunityId) return null;
  return {
    opportunityId: last.metadata.chosenOpportunityId,
    revisionInstruction: last.metadata.revisionInstruction ?? "",
    operation: last.metadata.internshipChoiceOperation ?? "edit_challenge",
  };
}

export function latestInternshipEditConfirmation(messages: AssistantUIMessage[]) {
  const last = messages.at(-1);
  if (
    last?.role !== "user" ||
    last.metadata?.intent !== "confirm_internship_edit" ||
    !last.metadata.chosenOpportunityId ||
    !last.metadata.internshipEditPatch
  ) return null;
  return {
    opportunityId: last.metadata.chosenOpportunityId,
    revisionInstruction: last.metadata.revisionInstruction ?? "Update the internship.",
    patch: last.metadata.internshipEditPatch,
  };
}
