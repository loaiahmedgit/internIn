import type { SubmissionRequirement } from "./submission-model";

/**
 * Deterministic, real-data-only summarization for the Start Challenge and
 * Active Challenge screens — no AI call, no invented facts. Every function
 * here only rearranges/truncates fields that already exist on the challenge
 * (scenario, tasks, submissionRequirements, rubric), so the same component
 * structure adapts across every internship type without industry-specific
 * branches: the taxonomy already spans every field internIn supports (see
 * submission-model.ts's own comment on SUBMISSION_ARTIFACT_KINDS).
 */

/** First sentence of a longer real text block, hard-capped so a runaway
 * "sentence" (no punctuation for a while) still fits a single line or two. */
export function firstSentence(text: string, maxLength = 200): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^.*?[.!?](?=\s|$)/);
  const sentence = (match ? match[0] : trimmed).trim();
  return sentence.length > maxLength ? `${sentence.slice(0, maxLength - 1).trimEnd()}…` : sentence;
}

function joinNaturally(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Strips one trailing sentence-ending punctuation mark — some seeded task
 * titles are themselves full sentences ("...three bottlenecks."), which
 * would otherwise double up when joined into a larger sentence. */
function stripTrailingPunctuation(s: string): string {
  return s.replace(/[.!?]+$/, "");
}

/** "What you'll do" — a flowing one-sentence summary built from the
 * challenge's own task titles (never their long descriptions), so it reads
 * like a single sentence instead of a list, without inventing wording the
 * challenge itself doesn't contain. */
export function summarizeTaskTitles(tasks: { title: string }[]): string {
  if (tasks.length === 0) return "Complete the work described in this challenge.";
  const [first, ...rest] = tasks.map((t) => stripTrailingPunctuation(t.title.trim())).filter(Boolean);
  const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const parts = [first, ...rest.map(lowerFirst)];
  return `${capitalize(joinNaturally(parts))}.`;
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/** "What you'll submit" — one human-readable sentence built from the real
 * submissionRequirements' own labels (the most specific real field
 * available — closer to what a company actually named the deliverable than
 * a generic artifact-kind noun would be), e.g. "A feedback analysis and an
 * onboarding improvement proposal." Required requirements are used when any
 * exist; otherwise all requirements are summarized, since something is
 * still expected. Never hardcodes an industry. */
export function summarizeSubmissionRequirements(requirements: SubmissionRequirement[]): string {
  const relevant = requirements.some((r) => r.required) ? requirements.filter((r) => r.required) : requirements;
  if (relevant.length === 0) return "Your completed work for this challenge.";
  const phrases = relevant.map((r) => {
    const label = stripTrailingPunctuation(r.label.trim());
    const lowered = label.charAt(0).toLowerCase() + label.slice(1);
    return `${article(label)} ${lowered}`;
  });
  return `${capitalize(joinNaturally(phrases))}.`;
}

const GENERIC_GUIDANCE = ["Address every task before you submit.", "Explain your reasoning, not just your conclusion."];

/** "What to keep in mind" — 2 to 4 bullets derived from the challenge's own
 * rubric descriptions (already AI-authored per role/challenge, so they
 * naturally differ by industry) or, failing that, real submission-
 * requirement instructions. Falls back to two role-agnostic process
 * reminders only when neither source has real content — never fabricates
 * challenge-specific advice. */
export function deriveGuidanceBullets(rubric: { description: string }[], requirements: SubmissionRequirement[]): string[] {
  const fromRubric = rubric.map((r) => r.description?.trim()).filter((d): d is string => Boolean(d));
  if (fromRubric.length >= 2) return fromRubric.slice(0, 4);

  const fromRequirements = requirements.map((r) => r.instructions?.trim()).filter((d): d is string => Boolean(d));
  const combined = [...fromRubric, ...fromRequirements].slice(0, 4);
  return combined.length >= 2 ? combined : GENERIC_GUIDANCE;
}
