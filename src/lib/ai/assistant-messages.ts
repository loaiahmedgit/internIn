import type { UIMessage } from "ai";
import type { ChallengeDraft, ClarificationQuestionsResult } from "./challenge-clarification-schemas";
import type { OpportunityEditPatch } from "./opportunity-edit";
import type { WorkNeedProfile } from "./role-intelligence-schemas";

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

/** A challenge-generation failure represented as real message state, not
 * a thrown stream error — lets the UI render a proper inline card where
 * the draft would have appeared ("Challenge generation failed... Try
 * again") instead of a generic red line near the composer. Clicking
 * "Try again" calls regenerate(), which re-sends the SAME triggering
 * message (still carrying its original questionnaire-answer metadata,
 * if any) — the questionnaire is never re-asked and no context is lost. */
export interface GenerationErrorData {
  title?: string;
  message: string;
}

/** One clarification question's answer, as submitted by the real shadcn
 * Questionnaire — never serialized into a giant chat-bubble string. A
 * `null` answer means the (optional) question was skipped; the app never
 * invents a value for it. */
export interface QuestionnaireAnswer {
  prompt: string;
  answer: string | null;
  /** The machine-readable information slot behind the question. Keeping
   * this with the submitted answer lets later workflow buttons preserve
   * the employer's selections exactly instead of re-extracting prose. */
  slot?: ClarificationQuestionsResult["questions"][number]["slot"];
  /** Individual selected labels in their original order. `answer` remains
   * the compact display string; this array is the lossless workflow value. */
  values?: string[];
}

export type QuestionnaireContinuation = "offer_next_action" | "draft_challenge";

/** The Questionnaire also carries the deterministic workflow it resumes.
 * A general hiring request returns to the internship-first action offer;
 * an explicit challenge-only request (or an internship already in URL
 * context) continues directly to ChallengeDraft generation. */
export interface AssistantQuestionnaireData extends ClarificationQuestionsResult {
  continuation: QuestionnaireContinuation;
  roleSummary: string;
}

/** Carried on the user message a UI action (not real typing) produces, so
 * the server can deterministically continue instead of asking the model
 * to re-decide what an explicit click already decided. Structured
 * UI-driven signals, never text-based intent guessing:
 * - questionnaire_answer: the Questionnaire's own submit.
 * - create_internship_draft / create_challenge_only: the offer card's two
 *   buttons (see ActionOfferData) — roleSummary carries the same context
 *   forward so generation never re-reads/re-classifies the transcript.
 * - internship_choice: the disambiguation picker's button (see
 *   InternshipChoiceData) — chosenOpportunityId + the original
 *   revisionInstruction, so the server can act on the right internship
 *   without re-asking what the employer wanted changed. */
export interface AssistantMessageMetadata {
  intent?: "questionnaire_answer" | "create_internship_draft" | "create_challenge_only" | "internship_choice" | "confirm_internship_edit";
  questionnaireAnswers?: QuestionnaireAnswer[];
  questionnaireContinuation?: QuestionnaireContinuation;
  roleSummary?: string;
  generationWorkNeed?: WorkNeedProfile;
  chosenOpportunityId?: string;
  revisionInstruction?: string;
  internshipChoiceOperation?: "edit_challenge" | "edit_internship";
  internshipEditPatch?: OpportunityEditPatch;
}

/** Written once enough context exists to act, but there's a real product
 * choice to make first (Part 4/5: never silently assume challenge-only,
 * never ask "internship or challenge?" as a cold technical question) —
 * two buttons, "Create internship draft" primary. */
export interface ActionOfferData {
  roleSummary: string;
  /** Lossless questionnaire selections carried to the next structured
   * action. Never rendered in the compact offer card. */
  generationAnswers?: QuestionnaireAnswer[];
  /** Task-first evidence behind a problem-first role recommendation. It is
   * carried through the user's click so challenge generation uses the same
   * work evidence instead of re-inferring it from a UI label. */
  generationWorkNeed?: WorkNeedProfile;
}

/** Written after an internship is actually created from a draft — the
 * conversation's own "it's ready" signal; the UI navigates to its real
 * management page as its one visible next step, not a giant success
 * screen inline in the chat. */
export interface InternshipCreatedData {
  opportunityId: string;
  role: string;
}

/** A named existing internship ("make the Database Intern challenge
 * easier") resolved to zero or several real company internships instead
 * of exactly one — shown as a real choice, never guessed silently. */
export interface InternshipChoiceData {
  options: { id: string; role: string }[];
  revisionInstruction: string;
  operation: "edit_challenge" | "edit_internship";
}

export interface InternshipEditProposalData {
  opportunityId: string;
  role: string;
  revisionInstruction: string;
  patch: OpportunityEditPatch;
  changes: { label: string; before: string; after: string }[];
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
    questionnaire: AssistantQuestionnaireData;
    challengeDraft: ChallengeDraft;
    designSummary: DesignSummaryData;
    progress: ProgressData;
    generationError: GenerationErrorData;
    actionOffer: ActionOfferData;
    internshipCreated: InternshipCreatedData;
    internshipChoice: InternshipChoiceData;
    internshipEditProposal: InternshipEditProposalData;
  }
>;
