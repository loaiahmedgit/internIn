import {
  RoleRecommendationResultSchema,
  isGenericRoleTitle,
  type RecommendedRole,
  type RoleKnowledgeProfile,
  type RoleRecommendationResult,
  type WorkNeedProfile,
  workActivitySignals,
} from "./role-intelligence-schemas";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "help", "hire", "in", "intern", "internship", "is", "it", "need", "of", "on", "or", "our", "someone", "that", "the", "their", "they", "to", "we", "when", "with",
]);

function normalizeToken(token: string): string {
  return token
    .replace(/ies$/u, "y")
    .replace(/ations?$/u, "ate")
    .replace(/ing$/u, "")
    .replace(/ed$/u, "")
    .replace(/s$/u, "");
}

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase("en")
      .replace(/[^\p{L}\p{N}+#./-]+/gu, " ")
      .split(/\s+/u)
      .map(normalizeToken)
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
  );
}

type CorpusWeights = Map<string, number>;

function profileDocument(profile: RoleKnowledgeProfile): string {
  return [
    profile.occupationFamily,
    profile.description,
    ...profile.typicalTasks,
    ...profile.workActivities,
    ...profile.skills,
    ...profile.knowledge,
    ...profile.commonTools,
    ...profile.typicalDeliverables,
  ].join(" ");
}

/**
 * Corpus-derived inverse-document weights suppress generic vocabulary without
 * maintaining a profession- or industry-specific keyword blacklist.
 */
function corpusWeights(profiles: RoleKnowledgeProfile[]): CorpusWeights {
  const documentFrequency = new Map<string, number>();
  for (const profile of profiles) {
    for (const token of tokens(profileDocument(profile))) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  return new Map(
    [...documentFrequency].map(([token, frequency]) => [
      token,
      Math.log((profiles.length + 1) / (frequency + 1)) + 1,
    ]),
  );
}

function tokenWeight(token: string, weights: CorpusWeights): number {
  return weights.get(token) ?? Math.log(weights.size + 2) + 1;
}

/** Directional evidence coverage: how much of the employer phrase is supported. */
function phraseCoverage(needle: string, candidate: string, weights: CorpusWeights): number {
  const needleTokens = tokens(needle);
  const candidateTokens = tokens(candidate);
  if (!needleTokens.size || !candidateTokens.size) return 0;
  let total = 0;
  let matched = 0;
  for (const token of needleTokens) {
    const weight = tokenWeight(token, weights);
    total += weight;
    if (candidateTokens.has(token)) matched += weight;
  }
  return total ? matched / total : 0;
}

function coverage(needles: string[], haystack: string[], weights: CorpusWeights): number {
  if (!needles.length || !haystack.length) return 0;
  return needles.reduce((sum, needle) => {
    const best = haystack.reduce((max, candidate) => Math.max(max, phraseCoverage(needle, candidate, weights)), 0);
    return sum + best;
  }, 0) / needles.length;
}

function exactOrContainedCoverage(needles: string[], haystack: string[]): number {
  if (!needles.length || !haystack.length) return 0;
  const normalizedHaystack = haystack.map((value) => value.toLocaleLowerCase("en"));
  const matches = needles.filter((needle) => {
    const normalizedNeedle = needle.toLocaleLowerCase("en");
    return normalizedHaystack.some((candidate) => candidate.includes(normalizedNeedle) || normalizedNeedle.includes(candidate));
  }).length;
  return matches / needles.length;
}

type ScoredProfile = {
  profile: RoleKnowledgeProfile;
  score: number;
  activityCoverage: number;
  domainCoverage: number;
  toolCoverage: number;
  contextCoverage: number;
  matchingChannelCount: number;
  activityEvidence: string[];
  toolEvidence: string[];
  eligible: boolean;
};

export type RoleCandidateEvidence = Omit<ScoredProfile, "profile"> & {
  roleProfileId: string;
  title: string;
  occupationFamily: string;
};

function scoreProfile(need: WorkNeedProfile, profile: RoleKnowledgeProfile, weights: CorpusWeights): ScoredProfile {
  const activitySignals = workActivitySignals(need);
  const activityCorpus = [...profile.workActivities, ...profile.typicalTasks, ...profile.typicalDeliverables];
  const domainCorpus = [profile.occupationFamily, profile.description, ...profile.knowledge, ...profile.skills, ...profile.workEnvironments];
  const contextCorpus = [profile.description, ...profile.knowledge, ...activityCorpus];

  const activityCoverage = coverage(activitySignals, activityCorpus, weights);
  const domainCoverage = coverage(need.domainSignals, domainCorpus, weights);
  const toolCoverage = Math.max(
    exactOrContainedCoverage(need.systemsOrTools, profile.commonTools),
    coverage(need.systemsOrTools, [...profile.commonTools, ...profile.skills, ...profile.knowledge], weights),
  );
  const contextCoverage = coverage([...need.problems, ...need.desiredOutcomes], contextCorpus, weights);
  const matchingChannelCount = [
    activityCoverage >= 0.24,
    need.domainSignals.length > 0 && domainCoverage >= 0.18,
    need.systemsOrTools.length > 0 && toolCoverage >= 0.35,
    [...need.problems, ...need.desiredOutcomes].length > 0 && contextCoverage >= 0.2,
  ].filter(Boolean).length;

  const domainIsCompatible =
    need.domainClarity !== "clear" ||
    need.domainSignals.length === 0 ||
    domainCoverage >= 0.16 ||
    (activityCoverage >= 0.55 && matchingChannelCount >= 2);
  const hasMeaningfulActivityEvidence = activitySignals.length > 0 && activityCoverage >= 0.24;
  const eligible = hasMeaningfulActivityEvidence && domainIsCompatible;

  // Problem-first discovery deliberately excludes title similarity. A title
  // becomes authoritative only in the explicit-title branch below.
  const rawScore =
    activityCoverage * 0.56 +
    domainCoverage * 0.24 +
    toolCoverage * 0.12 +
    contextCoverage * 0.08;
  const crossDomainPenalty = domainIsCompatible ? 1 : 0.2;
  const score = Math.min(1, rawScore * crossDomainPenalty);

  const activityEvidence = activitySignals.filter((activity) => coverage([activity], activityCorpus, weights) >= 0.5);
  const toolEvidence = need.systemsOrTools.filter((tool) => exactOrContainedCoverage([tool], profile.commonTools) > 0);
  return {
    profile,
    score,
    activityCoverage,
    domainCoverage,
    toolCoverage,
    contextCoverage,
    matchingChannelCount,
    activityEvidence,
    toolEvidence,
    eligible,
  };
}

/** Stable diagnostic projection used by aggregate evaluations and telemetry. */
export function evaluateRoleCandidates(need: WorkNeedProfile, profiles: RoleKnowledgeProfile[]): RoleCandidateEvidence[] {
  const weights = corpusWeights(profiles);
  return profiles
    .map((profile) => scoreProfile(need, profile, weights))
    .sort((left, right) => right.score - left.score)
    .map(({ profile, ...evidence }) => ({
      ...evidence,
      roleProfileId: profile.id,
      title: displayTitle(profile),
      occupationFamily: profile.occupationFamily,
    }));
}

function displayTitle(profile: RoleKnowledgeProfile): string {
  const internshipTitle = profile.internshipTitle?.trim();
  // A generic internshipTitle (a data-quality gap, not a role) carries no
  // more information than the bare word "intern" — the canonical title is
  // always a real occupation name and is the safer fallback.
  if (internshipTitle && !isGenericRoleTitle(internshipTitle)) return internshipTitle;
  return profile.canonicalTitle;
}

function calibratedConfidence(scored: ScoredProfile, margin: number, familyCoherent: boolean): number {
  const evidenceQuality =
    scored.activityCoverage * 0.58 +
    scored.domainCoverage * 0.22 +
    scored.toolCoverage * 0.12 +
    scored.contextCoverage * 0.08;
  const channelSupport = Math.min(1, scored.matchingChannelCount / 3);
  const separation = Math.min(1, Math.max(0, margin) / 0.24);
  const confidence = evidenceQuality * 0.72 + channelSupport * 0.14 + separation * 0.1 + (familyCoherent ? 0.04 : 0);
  return Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;
}

function recommendationFromScore(scored: ScoredProfile, confidence: number): RecommendedRole {
  const evidence = [...scored.activityEvidence, ...scored.toolEvidence].slice(0, 8);
  const evidenceText = evidence.length ? evidence.join(", ") : scored.profile.occupationFamily;
  return {
    roleProfileId: scored.profile.id,
    title: displayTitle(scored.profile),
    confidence,
    reason: `This role is grounded in the described work around ${evidenceText}.`,
    evidence,
  };
}

function titleSimilarity(left: string, right: string, weights: CorpusWeights): number {
  return Math.max(phraseCoverage(left, right, weights), phraseCoverage(right, left, weights));
}

function findExplicitProfile(explicitTitle: string, profiles: RoleKnowledgeProfile[], weights: CorpusWeights): RoleKnowledgeProfile | null {
  const ranked = profiles
    .map((profile) => ({
      profile,
      score: Math.max(
        ...[profile.canonicalTitle, profile.internshipTitle ?? "", ...profile.alternateTitles].map((title) => titleSimilarity(explicitTitle, title, weights)),
      ),
    }))
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.score >= 0.72 ? ranked[0].profile : null;
}

function familySimilarity(left: RoleKnowledgeProfile, right: RoleKnowledgeProfile, weights: CorpusWeights): number {
  return Math.max(
    phraseCoverage(left.occupationFamily, right.occupationFamily, weights),
    phraseCoverage(right.occupationFamily, left.occupationFamily, weights),
  );
}

function distinctiveActivity(profile: RoleKnowledgeProfile, otherProfiles: RoleKnowledgeProfile[], weights: CorpusWeights): string | null {
  const otherActivities = otherProfiles.flatMap((candidate) => [...candidate.workActivities, ...candidate.typicalTasks]);
  return [...profile.workActivities, ...profile.typicalTasks].find((activity) => coverage([activity], otherActivities, weights) < 0.45) ?? null;
}

const GENERIC_CLARIFICATION_QUESTION = "What kind of work should this person mainly own day to day?";

function sentenceList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function cleanPhrase(value: string): string {
  return value.trim().replace(/[.?!]+$/u, "");
}

/**
 * All of the employer's own domain/work evidence, deduplicated. Used only
 * as an evidence-richness gate: a single entry (typically the employer's
 * whole ambiguous sentence sitting alone in `problems`) is the ambiguity
 * itself, not evidence to build a contrast from.
 */
function evidencePool(need: WorkNeedProfile): string[] {
  const pool = [...need.activities, ...need.problems, ...need.desiredOutcomes, ...need.domainSignals]
    .map(cleanPhrase)
    .filter(Boolean);
  return [...new Set(pool)];
}

/**
 * The specific, already-known cluster of work — what a clarification
 * should name as the "narrow" side of a contrast. Concrete activities are
 * preferred (most action-shaped); outcomes/problems only pad the list when
 * there aren't at least two activities. Domain signals are the last
 * resort, only when nothing more concrete was extracted at all.
 */
function narrowActivityCluster(need: WorkNeedProfile): string[] {
  const activities = need.activities.map(cleanPhrase).filter(Boolean);
  const padded = activities.length >= 2
    ? activities
    : [...activities, ...need.desiredOutcomes.map(cleanPhrase), ...need.problems.map(cleanPhrase)].filter(Boolean);
  const narrow = [...new Set(padded)].slice(0, 3);
  return narrow.length ? narrow : [...new Set(need.domainSignals.map(cleanPhrase).filter(Boolean))].slice(0, 3);
}

/**
 * Overly formal verbs swapped for a plainer equivalent when they open a
 * narrow-cluster phrase, purely because the meaning transfers unchanged —
 * "audit the records" and "track the records" ask the same question. This
 * is a verb-register map, not a profession map: it has no idea what
 * domain the phrase is even about.
 */
const FORMAL_VERB_REPLACEMENTS: Record<string, string> = {
  audit: "track", audits: "tracks", auditing: "tracking",
  oversee: "manage", oversees: "manages", overseeing: "managing",
  administer: "maintain", administers: "maintains", administering: "maintaining",
  administrate: "maintain", administrates: "maintains", administrating: "maintaining",
};

function softenLeadingVerb(phrase: string): string {
  const [firstWord, ...rest] = phrase.split(/\s+/u);
  const replacement = FORMAL_VERB_REPLACEMENTS[firstWord];
  return replacement ? [replacement, ...rest].join(" ") : phrase;
}

/** Generic organizational nouns a domain phrase might already end in —
 * checked only so a suffix is never doubled ("pharmacy operations
 * operations"), never to recognize a specific profession. */
const DOMAIN_SUFFIX_WORDS = new Set(["operations", "operation", "work", "works", "support", "administration", "management", "implementation", "services", "responsibilities"]);

function endsWithOrganizationalNoun(phrase: string): boolean {
  // Raw word, not the stemmed tokens() output: stemming mangles words like
  // "implementation" (-> "implementate"), which would never match the
  // (deliberately unstemmed) suffix-word set below.
  const words = phrase.toLocaleLowerCase("en").replace(/[^\p{L}\p{N}\s-]+/gu, " ").trim().split(/\s+/u);
  const lastWord = words.at(-1);
  return Boolean(lastWord && DOMAIN_SUFFIX_WORDS.has(lastWord));
}

/**
 * The domain phrase for the "or also support broader X" side of the
 * contrast — preferred over a fully generic "in this area" whenever a
 * usable domain signal exists, per "if a reliable domain label exists,
 * prefer broader {domain} operations/responsibilities". Two tiers, both
 * pure token/vocabulary checks with no profession-specific casing:
 *
 * 1. A domain signal genuinely not already covered by the narrow
 *    cluster's tokens — the strongest signal, used as-is.
 * 2. Otherwise, the shortest available domain signal (a short phrase is
 *    usually the broader category, e.g. "pharmacy operations" versus
 *    "medication inventory"), with a generic "operations" suffix added
 *    only if it doesn't already end in an organizational noun.
 */
/**
 * Generic organizational vocabulary (the same closed word list as
 * DOMAIN_SUFFIX_WORDS, stemmed) — excluded when checking whether a
 * candidate "broader" phrase contributes real new content. A phrase that,
 * once its narrow-cluster overlap AND this filler is stripped out, has
 * nothing left is not a different scope — it is the narrow work wearing a
 * bigger-sounding label.
 */
const ORGANIZATIONAL_FILLER_TOKENS = new Set([...DOMAIN_SUFFIX_WORDS].flatMap((word) => [...tokens(word)]));

/**
 * Rejects a "broader" candidate that does not actually add a new scope
 * dimension beyond the narrow cluster — a paraphrase or parent label of
 * the same work (e.g. "medication inventory management" over narrow
 * "medication inventory records, expiry tracking, restocking") sounds
 * specific but does not reduce uncertainty about which role is needed.
 * Two purely structural checks, neither aware of what profession or
 * domain is involved:
 *
 * 1. Overlap ratio: if most of the candidate's own tokens are already
 *    present in the narrow cluster, it is substantially the same phrase.
 * 2. Residual content: after removing narrow-cluster tokens AND generic
 *    organizational filler, at least one real content word must remain —
 *    otherwise the candidate is just the narrow work plus a bigger-
 *    sounding suffix.
 */
function addsGenuineScope(candidate: string, narrow: string[]): boolean {
  const candidateTokens = tokens(candidate);
  if (!candidateTokens.size) return false;
  const narrowTokens = new Set(narrow.flatMap((phrase) => [...tokens(phrase)]));
  const overlapping = [...candidateTokens].filter((token) => narrowTokens.has(token)).length;
  if (overlapping / candidateTokens.size >= 0.6) return false;
  const residual = [...candidateTokens].filter((token) => !narrowTokens.has(token) && !ORGANIZATIONAL_FILLER_TOKENS.has(token));
  return residual.length > 0;
}

/**
 * The validated domain phrase for the "or also support broader X" side of
 * a contrast — null when nothing in domainSignals actually adds a new
 * scope dimension beyond the narrow cluster (see addsGenuineScope). Signals
 * are tried most-distinct-first (zero token overlap, then ascending
 * length as a tiebreak, since a short phrase is usually the broader
 * category), and the first one that survives validation wins. No
 * profession-specific casing: only token overlap and vocabulary size.
 */
function broaderDomainPhrase(need: WorkNeedProfile, narrow: string[]): string | null {
  const narrowTokens = new Set(narrow.flatMap((phrase) => [...tokens(phrase)]));
  const signals = [...new Set(need.domainSignals.map(cleanPhrase).filter(Boolean))]
    .map((signal) => ({
      signal,
      overlaps: [...tokens(signal)].some((token) => narrowTokens.has(token)),
      size: tokens(signal).size,
    }))
    .sort((left, right) => Number(left.overlaps) - Number(right.overlaps) || left.size - right.size);

  const validated = signals.find(({ signal }) => addsGenuineScope(signal, narrow));
  if (!validated) return null;
  // A signal with zero token overlap already reads as a clean, standalone
  // domain name — leave it untouched. Only a signal that survived
  // validation despite some overlap (the weaker fallback tier) gets a
  // generic organizational suffix, and only if it doesn't already have one.
  if (!validated.overlaps) return validated.signal;
  return endsWithOrganizationalNoun(validated.signal) ? validated.signal : `${validated.signal} operations`;
}

/**
 * A genuine binary contrast built purely from the domain signal channel —
 * a specific known activity cluster versus a broader domain that
 * validation confirms is actually a different scope. Returns null (never
 * a fake contrast) when no domain signal survives that check; the caller
 * decides whether that means falling back to an honest generic question
 * or, when a real role candidate already exists, recommending it instead
 * of asking at all.
 */
function buildDomainContrastQuestion(need: WorkNeedProfile): string | null {
  if (evidencePool(need).length < 2) return null;
  const narrow = narrowActivityCluster(need);
  if (!narrow.length) return null;
  const broader = broaderDomainPhrase(need, narrow);
  if (!broader) return null;
  const narrowPhrase = sentenceList(narrow.map((phrase) => softenLeadingVerb(phrase.toLocaleLowerCase("en"))));
  return `Will they mainly ${narrowPhrase}, or will they also support broader ${broader}?`;
}

/**
 * The honest floor when no genuine second scope can be identified: still
 * a binary contrast naming the known work, but the other side is openly
 * generic rather than a fabricated specific-sounding alternative. Always
 * returns a real string — used only where the caller has already decided
 * a question must be asked regardless (nothing to recommend, or families
 * genuinely conflict but couldn't be worded specifically).
 */
function honestBroadFallbackQuestion(need: WorkNeedProfile): string {
  const narrow = narrowActivityCluster(need);
  if (evidencePool(need).length < 2 || !narrow.length) return GENERIC_CLARIFICATION_QUESTION;
  const narrowPhrase = sentenceList(narrow.map((phrase) => softenLeadingVerb(phrase.toLocaleLowerCase("en"))));
  return `Will they mainly ${narrowPhrase}, or take on broader responsibilities in this area?`;
}

/**
 * Attempts a REAL discriminating question — either two coherent retrieved
 * role profiles with genuinely distinctive activities, or a validated
 * domain-signal contrast. Returns null when neither is available: there
 * is no genuine second scope to ask about, only similarly-worded evidence
 * for the same one, which is not a distinction worth asking the employer
 * to resolve.
 */
function buildDiscriminatingQuestion(scored: ScoredProfile[], weights: CorpusWeights, need: WorkNeedProfile): string | null {
  if (scored.length >= 2) {
    const anchor = scored[0].profile;
    // Use whatever coherent subset exists rather than discarding all of it
    // the moment one outlier candidate breaks full-list coherence — a
    // single unrelated candidate in the list shouldn't erase a genuinely
    // discriminating question available from the rest.
    const coherent = scored.filter((candidate) => familySimilarity(anchor, candidate.profile, weights) >= 0.35);
    if (coherent.length >= 2) {
      const choices = coherent
        .slice(0, 3)
        .map(({ profile }, index, all) => distinctiveActivity(profile, all.filter((_, candidateIndex) => candidateIndex !== index).map((candidate) => candidate.profile), weights))
        .filter((activity): activity is string => Boolean(activity))
        .slice(0, 3);
      if (choices.length >= 2) {
        const readable = choices.map((choice) => choice.replace(/[.?!]+$/u, "").toLocaleLowerCase("en"));
        const last = readable.pop();
        return `Will they mainly ${readable.join(", ")}, or ${last}?`;
      }
    }
  }
  return buildDomainContrastQuestion(need);
}

/** Always returns a real question — the genuine one when available, the
 * honest generic floor otherwise. Used only where the caller has already
 * committed to asking (nothing eligible to recommend at all). */
function buildClarificationQuestion(scored: ScoredProfile[], weights: CorpusWeights, need: WorkNeedProfile): string {
  return buildDiscriminatingQuestion(scored, weights, need) ?? honestBroadFallbackQuestion(need);
}

export function recommendRoleFromProfiles(need: WorkNeedProfile, profiles: RoleKnowledgeProfile[]): RoleRecommendationResult {
  const weights = corpusWeights(profiles);
  // A generic word ("intern", "student", "employee", ...) is not a role the
  // employer actually named — it is an employment-status noun that
  // extraction sometimes mistakes for one. Treating it as absent falls
  // through to the same problem-first retrieval every other request uses,
  // instead of preserving a title with zero role information.
  const explicitRoleTitle = need.explicitRoleTitle && !isGenericRoleTitle(need.explicitRoleTitle) ? need.explicitRoleTitle : null;

  if (explicitRoleTitle) {
    const profile = findExplicitProfile(explicitRoleTitle, profiles, weights);
    if (profile && need.activityClarity === "clear" && workActivitySignals(need).length > 0) {
      const explicitScore = scoreProfile(need, profile, weights);
      const strongestAlternative = profiles
        .filter((candidate) => candidate.id !== profile.id)
        .map((candidate) => scoreProfile(need, candidate, weights))
        .filter((candidate) => candidate.eligible)
        .sort((left, right) => right.score - left.score)[0];
      const conflictEvidence = strongestAlternative && need.domainSignals.length > 0
        ? strongestAlternative.domainCoverage >= 0.25 && explicitScore.domainCoverage < 0.16
        : Boolean(
            strongestAlternative &&
            strongestAlternative.activityCoverage >= 0.55 &&
            explicitScore.activityCoverage < 0.16,
          );

      if (
        strongestAlternative &&
        conflictEvidence &&
        strongestAlternative.score >= 0.4 &&
        strongestAlternative.activityCoverage >= 0.3 &&
        strongestAlternative.score - explicitScore.score >= 0.15
      ) {
        const alternativeTitle = displayTitle(strongestAlternative.profile);
        return RoleRecommendationResultSchema.parse({
          recommendedRole: {
            roleProfileId: profile.id,
            title: explicitRoleTitle,
            confidence: 1,
            reason: "The employer explicitly named this role, so it has not been replaced.",
            evidence: [explicitRoleTitle],
          },
          alternatives: [recommendationFromScore(strongestAlternative, calibratedConfidence(strongestAlternative, strongestAlternative.score - explicitScore.score, true))],
          ambiguity: "high",
          clarificationNeeded: true,
          clarificationQuestion: `The responsibilities you described sound closer to ${alternativeTitle} than ${explicitRoleTitle}. Should I use ${alternativeTitle}, or is there more ${explicitRoleTitle} work involved?`,
          roleSource: "explicit",
        });
      }
    }

    return RoleRecommendationResultSchema.parse({
      recommendedRole: {
        roleProfileId: profile?.id ?? null,
        title: explicitRoleTitle,
        confidence: 1,
        reason: "The employer explicitly named this role, so their title is preserved.",
        evidence: [explicitRoleTitle],
      },
      alternatives: [],
      ambiguity: "low",
      clarificationNeeded: false,
      clarificationQuestion: null,
      roleSource: "explicit",
    });
  }

  const allScored = profiles.map((profile) => scoreProfile(need, profile, weights)).sort((left, right) => right.score - left.score);
  const eligible = allScored.filter((candidate) => candidate.eligible);
  const top = eligible[0];
  const lacksDiscriminatingWork =
    need.activityClarity === "ambiguous" ||
    workActivitySignals(need).length === 0;

  if (!top || lacksDiscriminatingWork) {
    const clarificationCandidates = eligible
      .filter((candidate) => candidate.activityCoverage >= 0.3)
      .slice(0, 3);
    return RoleRecommendationResultSchema.parse({
      recommendedRole: null,
      alternatives: [],
      ambiguity: "high",
      clarificationNeeded: true,
      clarificationQuestion: buildClarificationQuestion(clarificationCandidates, weights, need),
      roleSource: "inferred",
    });
  }

  const runnerUp = eligible[1];
  const margin = top.score - (runnerUp?.score ?? 0);
  const plausible = eligible.filter((candidate) => candidate.score >= Math.max(0.28, top.score - 0.12)).slice(0, 3);
  const familyCoherent = plausible.every((candidate) => familySimilarity(top.profile, candidate.profile, weights) >= 0.35);
  const confidence = calibratedConfidence(top, margin, familyCoherent);
  const conflictingFamilies = !familyCoherent && margin < 0.14;
  const weakAbsoluteEvidence = top.activityCoverage < 0.3 || top.score < 0.29 || confidence < 0.46;

  if (conflictingFamilies || weakAbsoluteEvidence) {
    const discriminating = buildDiscriminatingQuestion(plausible, weights, need);
    // A genuine second scope exists, or the families themselves genuinely
    // conflict (still worth asking even when it can only be worded
    // generically) — ask.
    if (discriminating || conflictingFamilies) {
      return RoleRecommendationResultSchema.parse({
        recommendedRole: null,
        alternatives: [],
        ambiguity: "high",
        clarificationNeeded: true,
        clarificationQuestion: discriminating ?? honestBroadFallbackQuestion(need),
        roleSource: "inferred",
      });
    }
    // Only the confidence math was weak: one role family already
    // dominates (familyCoherent) and no genuinely different second scope
    // could be found. Asking here would only be "inventory work, or
    // broader inventory work?" — that does not reduce uncertainty about
    // which role is needed, so recommend the dominant family instead of
    // forcing a fake clarification just to satisfy a threshold.
  }

  const alternatives = eligible
    .slice(1, 4)
    .filter((candidate) =>
      candidate.score >= top.score - 0.1 &&
      candidate.activityCoverage >= 0.34 &&
      familySimilarity(top.profile, candidate.profile, weights) >= 0.35,
    )
    .map((candidate) => recommendationFromScore(candidate, calibratedConfidence(candidate, candidate.score - (eligible[2]?.score ?? 0), true)))
    .slice(0, 2);
  const ambiguity = confidence >= 0.7 && margin >= 0.1 ? "low" : "medium";

  return RoleRecommendationResultSchema.parse({
    recommendedRole: recommendationFromScore(top, confidence),
    alternatives,
    ambiguity,
    clarificationNeeded: false,
    clarificationQuestion: null,
    roleSource: "inferred",
  });
}
