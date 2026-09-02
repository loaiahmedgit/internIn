import {
  RoleRecommendationResultSchema,
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
  return profile.internshipTitle ?? profile.canonicalTitle;
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

function buildClarificationQuestion(scored: ScoredProfile[], weights: CorpusWeights): string {
  if (scored.length < 2) return "What kind of work should this person mainly own day to day?";
  const anchor = scored[0].profile;
  const coherent = scored.filter((candidate) => familySimilarity(anchor, candidate.profile, weights) >= 0.35);
  if (coherent.length !== scored.length) return "What kind of work should this person mainly own day to day?";

  const choices = coherent
    .slice(0, 3)
    .map(({ profile }, index, all) => distinctiveActivity(profile, all.filter((_, candidateIndex) => candidateIndex !== index).map((candidate) => candidate.profile), weights))
    .filter((activity): activity is string => Boolean(activity))
    .slice(0, 3);
  if (choices.length < 2) return "What kind of work should this person mainly own day to day?";
  const readable = choices.map((choice) => choice.replace(/[.?!]+$/u, "").toLocaleLowerCase("en"));
  const last = readable.pop();
  return `Will they mainly ${readable.join(", ")}, or ${last}?`;
}

export function recommendRoleFromProfiles(need: WorkNeedProfile, profiles: RoleKnowledgeProfile[]): RoleRecommendationResult {
  const weights = corpusWeights(profiles);

  if (need.explicitRoleTitle) {
    const profile = findExplicitProfile(need.explicitRoleTitle, profiles, weights);
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
            title: need.explicitRoleTitle,
            confidence: 1,
            reason: "The employer explicitly named this role, so it has not been replaced.",
            evidence: [need.explicitRoleTitle],
          },
          alternatives: [recommendationFromScore(strongestAlternative, calibratedConfidence(strongestAlternative, strongestAlternative.score - explicitScore.score, true))],
          ambiguity: "high",
          clarificationNeeded: true,
          clarificationQuestion: `The responsibilities you described sound closer to ${alternativeTitle} than ${need.explicitRoleTitle}. Should I use ${alternativeTitle}, or is there more ${need.explicitRoleTitle} work involved?`,
          roleSource: "explicit",
        });
      }
    }

    return RoleRecommendationResultSchema.parse({
      recommendedRole: {
        roleProfileId: profile?.id ?? null,
        title: need.explicitRoleTitle,
        confidence: 1,
        reason: "The employer explicitly named this role, so their title is preserved.",
        evidence: [need.explicitRoleTitle],
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
      clarificationQuestion: buildClarificationQuestion(clarificationCandidates, weights),
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
    return RoleRecommendationResultSchema.parse({
      recommendedRole: null,
      alternatives: [],
      ambiguity: "high",
      clarificationNeeded: true,
      clarificationQuestion: buildClarificationQuestion(plausible, weights),
      roleSource: "inferred",
    });
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
