import { generateObject } from "ai";
import { getModel } from "./gemma-provider";
import { withGenerateRetries } from "./challenge-generation";
import { WorkNeedProfileSchema, isGenericRoleTitle, type WorkNeedProfile } from "./role-intelligence-schemas";

const WORK_NEED_TIMEOUT_MS = 20_000;
const WORK_NEED_ATTEMPTS = [{}, {}] as const;

const PROTECTED_CHARACTERISTIC_PATTERN =
  /\b(age|aged|young|old|gender|male|female|man|woman|race|racial|ethnicity|ethnic|religion|religious|nationality|national origin|disability|disabled|pregnan|marital|married|sexual orientation)\b/iu;

function removeProtectedCharacteristics(values: string[]): string[] {
  return values.filter((value) => !PROTECTED_CHARACTERISTIC_PATTERN.test(value));
}

const GROUNDING_STOP_WORDS = new Set([
  "a", "an", "and", "for", "from", "help", "in", "intern", "need", "of", "on", "or", "our", "someone", "the", "to", "we", "with",
]);

function groundingTokens(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase("en")
      .replace(/[^\p{L}\p{N}+#./-]+/gu, " ")
      .split(/\s+/u)
      .map((token) => token.replace(/ies$/u, "y").replace(/ations?$/u, "ate").replace(/ing$/u, "").replace(/ed$/u, "").replace(/s$/u, ""))
      .map((token) => (token.endsWith("at") ? `${token}e` : token))
      .filter((token) => token.length > 1 && !GROUNDING_STOP_WORDS.has(token)),
  );
}

function hasTwoGroundedActivities(profile: WorkNeedProfile, originalRequest: string): boolean {
  const requestTokens = groundingTokens(originalRequest);
  const toolTokens = groundingTokens(profile.systemsOrTools.join(" "));
  const grounded = profile.activities.filter((activity) =>
    [...groundingTokens(activity)].some((token) => requestTokens.has(token) && !toolTokens.has(token)),
  );
  return grounded.length >= 2;
}

function hasGroundedEvidence(values: string[], profile: WorkNeedProfile, originalRequest: string): boolean {
  const requestTokens = groundingTokens(originalRequest);
  const toolTokens = groundingTokens(profile.systemsOrTools.join(" "));
  return values.some((value) =>
    [...groundingTokens(value)].some((token) => requestTokens.has(token) && !toolTokens.has(token)),
  );
}

/**
 * Protects the exact employer request and drops protected-characteristic
 * constraints even if a model emitted one despite the extraction policy.
 */
export function normalizeWorkNeedProfile(profile: WorkNeedProfile, originalRequest: string): WorkNeedProfile {
  // Small models can be overly cautious even when the employer explicitly
  // named two different activities (for example cleaning spreadsheets and
  // creating dashboards). Upgrade only when those activity words are
  // actually grounded in the employer's own sentence, excluding a shared
  // platform/tool token. This cannot turn a bare "help with our system"
  // request into a confident role merely because the model invented tasks.
  const activityClarity =
    profile.activityClarity === "ambiguous" && (
      hasTwoGroundedActivities(profile, originalRequest) ||
      (
        profile.domainClarity === "clear" &&
        hasGroundedEvidence(profile.activities, profile, originalRequest) &&
        hasGroundedEvidence(profile.desiredOutcomes, profile, originalRequest)
      ) ||
      (
        profile.domainClarity === "clear" &&
        profile.problems.length > 0 &&
        profile.desiredOutcomes.length > 0 &&
        (profile.problems.length >= 2 || profile.desiredOutcomes.length >= 2) &&
        hasGroundedEvidence(profile.problems, profile, originalRequest) &&
        hasGroundedEvidence(profile.desiredOutcomes, profile, originalRequest)
      )
    )
      ? "clear"
      : profile.activityClarity;
  return WorkNeedProfileSchema.parse({
    ...profile,
    originalRequest,
    activityClarity,
    // A bare employment-status word ("intern", "student", ...) is not a
    // role the employer named — a weak model sometimes echoes it here
    // anyway. Treat it as not given so downstream retrieval runs instead
    // of preserving a title with zero role information.
    explicitRoleTitle: profile.explicitRoleTitle && !isGenericRoleTitle(profile.explicitRoleTitle) ? profile.explicitRoleTitle : null,
    constraints: removeProtectedCharacteristics(profile.constraints),
  });
}

/**
 * Extracts work before occupation. This call is only needed for problem-first
 * hiring requests; employers who explicitly name a role stay on the existing
 * fast path and retain their title.
 */
export async function extractWorkNeedProfile(originalRequest: string, transcript: string): Promise<WorkNeedProfile> {
  return withGenerateRetries("extractWorkNeedProfile", WORK_NEED_ATTEMPTS, async () => {
    const { object } = await generateObject({
      model: getModel(),
      temperature: 0,
      schema: WorkNeedProfileSchema,
      system: `Extract a task-first description of what an employer needs from an internship hiring conversation.

Rules:
- This is EXTRACTION, not a job-description generator. Keep only the work the employer actually describes. Do not expand it into a standard list of duties for the profession.
- For directly stated activities, retain the employer's verbs and objects in concise phrases (usually 3–10 words). Two stated activities normally produce two items, not eight related duties. Do not add testing, documentation, collaboration, tools, workflows, or best practices unless the employer actually mentioned them.
- When the employer describes an unambiguous problem/outcome, include the smallest directly implied activity rather than leaving activities empty. Preserve its original work nouns so retrieval stays grounded.
- systemsOrTools must retain EVERY explicitly named tool/system exactly as named (including names embedded inside activities), and ONLY those names. Do not add languages, platforms, Git, or frameworks merely because they are common for this work.
- explicitRoleTitle is ONLY a role the employer actually named. Preserve their wording; never put your inferred recommendation there.
- problems are the business/work problems described.
- activities are the concrete work needed to address those problems. Convert passively worded problems into the minimum concrete day-to-day activities logically required to reach the stated outcome when that implication is unambiguous. If multiple materially different kinds of work could solve the problem, do not choose a branch. Activities may make safe, direct implications explicit, but must not invent company facts.
- Keep activities atomic: one responsibility per array item rather than bundling several activities into one string.
- If an explicit role title conflicts with the described duties, keep the title only in explicitRoleTitle. domainSignals and domainClarity describe the actual duties, never the title. A contradictory title does not make otherwise clear work ambiguous.
- domainSignals are open-ended work-domain concepts grounded in the employer's description, such as the business function, professional field, operating context, or technical area. Do not choose from a fixed taxonomy and do not infer the employer's industry unless it is actually relevant to the work. Prefer the widest field or department this work sits within over a narrow process name that just re-describes the same activities in different words — e.g. for invoice/payment matching work, "finance operations" is a domain signal; "accounts payable" is not, because it names the exact same task, not a wider context around it. The same distinction applies in any field, not only finance.
- systemsOrTools preserves named systems and tools, using the product name the employer used.
- desiredOutcomes describes the requested operational outcome, not a hiring judgment.
- constraints contains only work constraints, access restrictions, safety constraints, or scope constraints.
- activityClarity is "clear" only when the employer supplied enough concrete activities or outcomes to distinguish the work from other materially different roles.
- activityClarity is "ambiguous" when the employer only names a broad system, domain, or problem that could involve different kinds of work. Do not resolve that ambiguity by inventing one branch. A named platform alone does not reveal whether the work is administration, analysis, support, or software integration.
- domainClarity is "clear" only when the work's professional or operating domain is grounded well enough to reject unrelated role families. It may be clear even when the specific activity is ambiguous. Use "ambiguous" when the same language plausibly spans unrelated domains.
- seniorityIntent may contain intern/junior/student level intent, never age or another protected characteristic.
- If the work is genuinely ambiguous, leave activities that cannot be established empty instead of choosing an occupation.
- Never extract or use age, gender, race, ethnicity, religion, nationality, disability, pregnancy, marital status, sexual orientation, or any other protected candidate characteristic.
- Do not recommend or name an inferred role in this step.`,
      prompt: `Latest employer request:\n${originalRequest}\n\nConversation context:\n${transcript}`,
      maxOutputTokens: 900,
      abortSignal: AbortSignal.timeout(WORK_NEED_TIMEOUT_MS),
    });
    return normalizeWorkNeedProfile(object, originalRequest);
  });
}
