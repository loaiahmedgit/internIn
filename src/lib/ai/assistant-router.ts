import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "./gemma-provider";
import { withGenerateRetries } from "./challenge-generation";
import { InformationSlotSchema } from "./role-profiles";

/**
 * ONE canonical routing decision, forced structured output — never a free
 * choice the model can sidestep by just answering in prose (see the
 * regression this fixed: the model narrating clarification questions as
 * plain numbered Markdown when tool-calling was optional).
 *
 * The model's job is deliberately SMALL: classify intent, and for the
 * challenge-building actions, normalize the role and pick which of 9 fixed
 * information SLOTS are missing — it never writes question text, choices,
 * or the challenge itself. This is what makes the router fast and
 * reliable: one small structured call, not an agentic loop.
 *
 * Every optional field here is a flat primitive/array, never a nested
 * optional OBJECT — a real, previously-diagnosed bug (see
 * challenge-clarification-schemas.ts's aiUsagePolicy history) found that
 * a nullable/optional object field reliably triggers this model into
 * hanging or degenerating.
 */
export const AssistantActionSchema = z.enum([
  "decline", // Clearly out of scope — briefly redirect, no other work.
  "chat", // GENERAL_CONVERSATION / HIRING_ADVICE: greeting, thanks, a question about hiring concepts, or the employer is still explaining/thinking through a problem out loud — talk, don't act.
  "check_data", // WORKSPACE_QUERY / CANDIDATE_QUERY / ANALYTICS_QUERY: needs real current numbers/status to answer (applicants, stages, deadlines, activity, an internship's performance).
  "ask_clarifying_questions", // Wants a challenge/internship built, but something REQUIRED is genuinely missing.
  "offer_next_action", // CREATE_INTERNSHIP: enough context exists for a NEW internship (no existing one referenced) — offer to act, don't act or ask "internship or challenge?" yet.
  "draft_challenge", // CREATE_CHALLENGE: build/revise the draft ALREADY in this conversation (after the employer picked "create challenge only", or an internship is already in scope), or a challenge-only request from the start.
  "edit_existing_challenge", // EDIT_CHALLENGE: employer named an EXISTING internship's challenge ("make the Database Intern challenge easier").
  "edit_existing_internship", // EDIT_INTERNSHIP: employer wants to change the posting itself (deadline, location, description, requirements, etc.).
]);
export type AssistantAction = z.infer<typeof AssistantActionSchema>;

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const AssistantRouterDecisionSchema = z.object({
  action: AssistantActionSchema,
  /** One sentence summarizing the internship role/work, when the action is
   * about a challenge. For ask_clarifying_questions/offer_next_action/
   * draft_challenge, this doubles as the input to role normalization/
   * RoleProfile lookup. */
  roleSummary: optionalText(300),
  /** The employer's exact revision/edit feedback, verbatim — for
   * draft_challenge revising an in-conversation draft, or
   * edit_existing_challenge acting on a named existing internship. */
  revisionInstruction: optionalText(500),
  /** The role reduced to a clean, professional title (e.g. "IT guy
   * intern" -> "IT Technician Intern"). Only set for
   * ask_clarifying_questions/offer_next_action/draft_challenge. */
  normalizedRole: optionalText(120),
  /** For a new creation request, whether the employer explicitly asked for
   * a challenge-only artifact or is hiring for a role (the normal
   * internship-first path). Preserved through clarification so submitting
   * a Questionnaire never silently changes the requested outcome. */
  creationTarget: z.enum(["internship", "challenge"]).nullable().optional(),
  /** ONLY for edit_existing_challenge: the internship name/role the
   * employer actually said (e.g. "Database Intern") — resolved against
   * the company's real internships server-side, never guessed here. */
  targetRoleName: optionalText(160),
  /** "low" when the role itself is too vague to know what profession
   * this even is (e.g. "someone for lab work" — chemistry? biology? a
   * computer lab?). When low, the app asks what the role actually IS
   * rather than guessing role-specific responsibilities/tools from a
   * RoleProfile that would just be a fabricated match. */
  roleConfidence: z.enum(["high", "low"]).nullable().optional(),
  /** ONLY for ask_clarifying_questions: which of the fixed information
   * slots are actually missing, in priority order. 1-4 entries. The
   * model picks WHICH slots; it never writes the question itself. */
  missingSlots: z.array(InformationSlotSchema).min(1).max(4).nullable().optional(),
});
export type AssistantRouterDecision = z.infer<typeof AssistantRouterDecisionSchema>;

/**
 * Enforces product invariants after the probabilistic routing call. The
 * model is useful for understanding intent, but it does not get to revive
 * optional questions or re-ask facts the employer explicitly settled.
 */
export function normalizeAssistantRouterDecision(
  decision: AssistantRouterDecision,
  transcript: string,
): AssistantRouterDecision {
  if (decision.action !== "ask_clarifying_questions") {
    return { ...decision, missingSlots: null };
  }

  const lowerTranscript = transcript.toLowerCase();
  const levelIsExplicitlyFlexible =
    /(?:level|school|university|graduate|experience)[^.\n]{0,80}(?:doesn['’]?t matter|do not matter|no preference|any (?:level|background|experience))/.test(lowerTranscript) ||
    /(?:doesn['’]?t matter|no preference)[^.\n]{0,50}(?:level|school|university|graduate|experience)/.test(lowerTranscript);
  const roleIsKnown = decision.roleConfidence !== "low" && Boolean(decision.normalizedRole?.trim());

  const slots = [...new Set(decision.missingSlots ?? [])].filter((slot) => {
    if (slot === "expected_deliverables" || slot === "work_environment") return false;
    if (slot === "candidate_level" && levelIsExplicitlyFlexible) return false;
    if (slot === "role_domain" && roleIsKnown) return false;
    return true;
  });

  if (slots.length === 0) {
    return { ...decision, action: "offer_next_action", missingSlots: null };
  }

  return { ...decision, missingSlots: slots };
}

const ROUTER_TIMEOUT_MS = 20_000;
const ROUTER_ATTEMPTS = [{}, {}] as const;

const ROUTER_SYSTEM = `You are internIn's hiring copilot routing brain — not a challenge generator, a copilot for internship teams that can talk, look up real data, and take action. Read the conversation and decide EXACTLY ONE action for the LATEST employer message. Employers speak naturally, not in your internal categories — never make them choose between technical objects ("internship or challenge?") before you've even understood what they need.

- "decline": clearly unrelated to internship hiring/programs (e.g. write me a game, general trivia). A request that uses a similar format but serves a real hiring purpose (e.g. "make a Snake-style coding challenge for our software engineering intern") is NOT a decline.
- "chat": a greeting/thanks/simple question ("hi", "thanks", "what can you do?"), a hiring-advice question, OR the employer is still explaining/thinking through a problem and hasn't asked for anything to be built yet. Respond naturally and, if a role is starting to take shape, name it and ask if that's roughly right — do NOT jump to a questionnaire or a draft while someone is still describing their problem.
- "check_data": asking about real current numbers/status for their workspace or a specific internship (applicant counts, why a role gets few applicants, which internships need attention, when something closes, candidates waiting for review, how a role is performing). This is a read, never a write — no challenge, no draft, no questionnaire.
- "ask_clarifying_questions": wants a NEW internship/challenge built, but something REQUIRED is genuinely missing (see below). Set creationTarget to "challenge" only when they explicitly asked for a challenge/assessment/task without an internship draft; otherwise set it to "internship".
- "offer_next_action": wants a NEW internship/challenge built and nothing REQUIRED is missing (or a prior questionnaire already established it) — the internship doesn't exist yet in this conversation or the workspace. Do NOT build anything yet; the app will offer the employer a clear next step.
- "draft_challenge": build/revise the challenge draft ALREADY present in this conversation (the employer just chose "create challenge only", or an internship is already in scope for this conversation), or the employer explicitly asked for a challenge only from the start with enough context.
- "edit_existing_challenge": the employer named an EXISTING internship's challenge that is NOT part of this conversation's own draft ("make the Database Intern challenge easier", "add React to the Web Developer challenge"). Set targetRoleName and revisionInstruction.
- "edit_existing_internship": the employer wants to change an EXISTING internship POSTING itself (deadline, start date, title, description, requirements, skills, location, mode, duration, hours, slots). "Change the deadline for Marketing Intern" belongs here, never in edit_existing_challenge. Set targetRoleName and revisionInstruction.

THERE IS NO MINIMUM NUMBER OF CLARIFYING QUESTIONS, and the count is DYNAMIC — a fully-specified request gets zero, a partially-specified one gets only the missing piece(s), a genuinely vague one gets 2-3. Before deciding anything, extract every piece of information the employer's own message ALREADY gives you — directly or implicitly. Never ask about something already answered. Your job is to notice what's already there; internIn's separate job (not yours) is to design the actual challenge from it, filling ordinary details itself the way a competent hiring designer would.

Two different kinds of missing information — treat them differently:

REQUIRED (worth a clarifying question, but ONLY if genuinely still unknown after reading the message):
- the role itself is ambiguous (you can't tell what profession/domain this is)
- the actual responsibilities/area of work are unclear (the employer named a role but gave no sense of the real day-to-day work, or the role itself spans genuinely different kinds of work — e.g. "web developer" could mean frontend, backend, full-stack, or QA, each a different challenge)
- candidate level, whenever the request's scope is still broad/unbounded — if you don't yet know the actual scope of work, you also can't know whether difficulty matters, so treat level as REQUIRED alongside responsibilities for a broad, no-detail request. It becomes safely skippable once the message itself narrows the difficulty (an explicit level, or wording that pins the bar regardless of level, like "basic/common issues" or "doesn't matter")
- specific tools/technologies, but ONLY when the chosen area of work would use genuinely different tech depending on the answer — always offer a "No preference / let internIn choose" choice so this never blocks on it
- safety or access restrictions, when the role plausibly involves something a candidate must NOT do unsupervised
- unusual company-specific context, but ONLY when the employer's own message signals something unusual actually applies — never as a generic "tell us more"

OPTIONAL (do NOT generate a question for these just because they weren't mentioned — internIn designs a safe, realistic synthetic challenge without them):
- exact deliverables ("what should they produce by the end?" is never a question to ask — that's internIn's job to design)
- work environment (remote/onsite/hybrid)
- generic company/process/implementation details internIn can safely design itself

An empty slot is not by itself a reason to ask. Ask ONLY when the missing piece would materially change what the challenge actually tests, or risks inventing a specific fact about the employer's real company/clients/operations. When in doubt about ONE borderline slot, prefer offer_next_action/draft_challenge; when the WHOLE request is bare (a role name and nothing else), ask 2-3 — a single question for a genuinely under-specified request is itself under-asking.

Worked examples:

Employer: "hi" / "thanks" / "what can you do?"
Correct: action = "chat". No data lookup, no questionnaire, no draft — just answer.

Employer: "I want a technical student to fix computers when small problems happen. School, university, or graduate doesn't matter. Mostly normal computer and software issues."
Correct: action = "offer_next_action" (not ask_clarifying_questions), zero missingSlots. Role (IT Support Intern), responsibilities, and scope are all already given; candidate level was explicitly said not to matter.

Employer: "I want to hire a web dev intern."
Correct: action = "ask_clarifying_questions", normalizedRole "Web Developer Intern", missingSlots = ["responsibilities", "candidate_level", "tools_technologies"]. "Web developer" spans frontend/backend/full-stack/QA with nothing else given; scope is wide open, so level isn't safely skippable either.

Employer: "We're migrating customer data to PostgreSQL and need a final-year student to help with SQL, schema cleanup, and data cleaning."
Correct: action = "offer_next_action", zero missingSlots — role, level, responsibilities, and even the tool (PostgreSQL) are all already given.

Employer: "Why is my Marketing Intern internship getting no applicants?" / "How many people applied to Finance Intern?" / "Which internships need attention?"
Correct: action = "check_data". Real data, no challenge/questionnaire/draft of any kind.

Employer: "Make the challenge for Database Intern easier." / "Add React to the Web Developer challenge."
Correct: action = "edit_existing_challenge", targetRoleName exactly as said ("Database Intern" / "Web Developer"), revisionInstruction the actual change requested.

Employer: "Change the deadline for Marketing Intern to October 15." / "Make the Data Analyst Intern remote."
Correct: action = "edit_existing_internship", targetRoleName exactly as said, revisionInstruction the actual listing change requested.

Employer: "We don't know what intern we need. Our team keeps wasting time manually cleaning spreadsheets and creating reports."
Correct: action = "chat" — this is still an open problem, not a request to build anything. Reflect back what role would likely fit (a Data/Reporting Intern) and ask if that's right before doing anything else.

For "ask_clarifying_questions", pick missingSlots from EXACTLY these 9 values — 1 to 4, only the ones that are REQUIRED per above and still genuinely unknown:
1. role_domain (use when the profession itself is ambiguous)
2. candidate_level
3. responsibilities
4. tools_technologies
5. work_environment
6. expected_deliverables
7. access_level
8. restrictions
9. special_company_context

Set roleConfidence to "low" only when the role itself is too ambiguous to know the profession (e.g. "someone for lab work") — in that case still normalize your best guess but mark confidence low so the app can avoid guessing role-specific specifics from a mismatched profile.`;

/**
 * Classifies what the assistant should do next. This call is intentionally
 * SMALL — it never writes a question, a choice list, or a challenge draft,
 * only a routing decision plus a handful of enum/short-text picks. Capped
 * maxOutputTokens for the same reason: a small, well-bounded response is
 * faster and less prone to the runaway-generation failure mode this model
 * has shown for larger free-form outputs.
 */
export async function classifyAssistantRequest(transcript: string): Promise<AssistantRouterDecision> {
  return withGenerateRetries("classifyAssistantRequest", ROUTER_ATTEMPTS, async () => {
    const { object } = await generateObject({
      model: getModel(),
      schema: AssistantRouterDecisionSchema,
      system: ROUTER_SYSTEM,
      prompt: `Conversation so far:\n${transcript}`,
      maxOutputTokens: 700,
      abortSignal: AbortSignal.timeout(ROUTER_TIMEOUT_MS),
    });
    return normalizeAssistantRouterDecision(object, transcript);
  });
}
