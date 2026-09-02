import {
  RoleRecommendationResultSchema,
  type RecommendedRole,
  type RoleKnowledgeProfile,
  type RoleRecommendationResult,
  type WorkNeedProfile,
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

function phraseSimilarity(left: string, right: string): number {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / Math.max(leftTokens.size, rightTokens.size);
}

function coverage(needles: string[], haystack: string[]): number {
  if (!needles.length || !haystack.length) return 0;
  const total = needles.reduce((sum, needle) => {
    const best = haystack.reduce((max, candidate) => Math.max(max, phraseSimilarity(needle, candidate)), 0);
    return sum + best;
  }, 0);
  return total / needles.length;
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
  activityEvidence: string[];
  toolEvidence: string[];
};

function scoreProfile(need: WorkNeedProfile, profile: RoleKnowledgeProfile): ScoredProfile {
  const activityCorpus = [...profile.workActivities, ...profile.typicalTasks, ...profile.typicalDeliverables];
  const descriptiveCorpus = [profile.description, ...profile.skills, ...profile.knowledge, ...activityCorpus];
  const titleCorpus = [profile.canonicalTitle, profile.internshipTitle ?? "", ...profile.alternateTitles];

  const activityCoverage = coverage(need.activities, activityCorpus);
  const toolCoverage = Math.max(
    exactOrContainedCoverage(need.systemsOrTools, profile.commonTools),
    coverage(need.systemsOrTools, [...profile.commonTools, ...profile.skills, ...profile.knowledge]),
  );
  const problemOutcomeCoverage = coverage([...need.problems, ...need.desiredOutcomes], descriptiveCorpus);
  const requestCoverage = coverage([need.originalRequest], [...descriptiveCorpus, ...profile.commonTools]);
  const titleCoverage = coverage([need.originalRequest], titleCorpus);

  const score = Math.min(
    1,
    activityCoverage * 0.44 +
      toolCoverage * 0.29 +
      problemOutcomeCoverage * 0.15 +
      requestCoverage * 0.08 +
      titleCoverage * 0.04,
  );

  const activityEvidence = need.activities.filter((activity) => coverage([activity], activityCorpus) >= 0.5);
  const toolEvidence = need.systemsOrTools.filter((tool) => exactOrContainedCoverage([tool], profile.commonTools) > 0);
  return { profile, score, activityEvidence, toolEvidence };
}

function displayTitle(profile: RoleKnowledgeProfile): string {
  return profile.internshipTitle ?? profile.canonicalTitle;
}

function recommendationFromScore(scored: ScoredProfile, confidence = scored.score): RecommendedRole {
  const evidence = [...scored.activityEvidence, ...scored.toolEvidence].slice(0, 8);
  const evidenceText = evidence.length ? evidence.join(", ") : scored.profile.occupationFamily;
  return {
    roleProfileId: scored.profile.id,
    title: displayTitle(scored.profile),
    confidence: Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100,
    reason: `This role is grounded in the described work around ${evidenceText}.`,
    evidence,
  };
}

function findExplicitProfile(explicitTitle: string, profiles: RoleKnowledgeProfile[]): RoleKnowledgeProfile | null {
  const ranked = profiles
    .map((profile) => ({
      profile,
      score: Math.max(
        ...[profile.canonicalTitle, profile.internshipTitle ?? "", ...profile.alternateTitles].map((title) => phraseSimilarity(explicitTitle, title)),
      ),
    }))
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.score >= 0.65 ? ranked[0].profile : null;
}

function distinctiveActivity(profile: RoleKnowledgeProfile, otherProfiles: RoleKnowledgeProfile[]): string | null {
  const otherActivities = otherProfiles.flatMap((candidate) => [...candidate.workActivities, ...candidate.typicalTasks]);
  return [...profile.workActivities, ...profile.typicalTasks].find((activity) => coverage([activity], otherActivities) < 0.5) ?? null;
}

function buildClarificationQuestion(scored: ScoredProfile[]): string {
  const choices = scored
    .slice(0, 3)
    .map(({ profile }, index, all) => distinctiveActivity(profile, all.filter((candidate) => candidate.profile.id !== profile.id).map((candidate) => candidate.profile)))
    .filter((activity): activity is string => Boolean(activity))
    .slice(0, 3);

  if (choices.length < 2) return "What will this person mainly be responsible for day to day?";
  const readable = choices.map((choice) => choice.replace(/[.?!]+$/u, "").toLocaleLowerCase("en"));
  const last = readable.pop();
  return `Will they mainly ${readable.join(", ")}, or ${last}?`;
}

/**
 * Deterministic lexical baseline used to prove the task-first architecture
 * before adding Postgres FTS, embeddings, or an LLM reranker. There are no
 * title-specific conditionals here: every role is ranked by the same work,
 * activity, system, and outcome evidence.
 */
export function recommendRoleFromProfiles(need: WorkNeedProfile, profiles: RoleKnowledgeProfile[]): RoleRecommendationResult {
  if (need.explicitRoleTitle) {
    const profile = findExplicitProfile(need.explicitRoleTitle, profiles);
    if (profile && need.activityClarity === "clear" && need.activities.length > 0) {
      const explicitScore = scoreProfile(need, profile);
      const strongestAlternative = profiles
        .filter((candidate) => candidate.id !== profile.id)
        .map((candidate) => scoreProfile(need, candidate))
        .sort((left, right) => right.score - left.score)[0];

      if (
        strongestAlternative &&
        strongestAlternative.score >= 0.38 &&
        strongestAlternative.score - explicitScore.score >= 0.2
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
          alternatives: [recommendationFromScore(strongestAlternative)],
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

  const scored = profiles.map((profile) => scoreProfile(need, profile)).sort((left, right) => right.score - left.score);
  const top = scored[0];
  if (!top) {
    return RoleRecommendationResultSchema.parse({
      recommendedRole: null,
      alternatives: [],
      ambiguity: "high",
      clarificationNeeded: true,
      clarificationQuestion: "What will this person mainly be responsible for day to day?",
      roleSource: "inferred",
    });
  }

  const margin = top.score - (scored[1]?.score ?? 0);
  const lacksDiscriminatingWork =
    need.activityClarity === "ambiguous" ||
    (need.activities.length === 0 && need.desiredOutcomes.length === 0);
  const highAmbiguity = lacksDiscriminatingWork || top.score < 0.16;
  const mediumAmbiguity = !highAmbiguity && (top.score < 0.38 || margin < 0.085);
  const alternatives = scored
    .slice(1, 4)
    .filter((candidate) => candidate.score >= Math.max(0.05, top.score - 0.4))
    .map((candidate) => recommendationFromScore(candidate));

  return RoleRecommendationResultSchema.parse({
    recommendedRole: highAmbiguity ? null : recommendationFromScore(top, mediumAmbiguity ? Math.min(top.score, 0.69) : Math.max(top.score, 0.7)),
    alternatives,
    ambiguity: highAmbiguity ? "high" : mediumAmbiguity ? "medium" : "low",
    clarificationNeeded: highAmbiguity,
    clarificationQuestion: highAmbiguity ? buildClarificationQuestion(scored) : null,
    roleSource: "inferred",
  });
}
