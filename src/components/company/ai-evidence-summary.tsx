import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { CandidateDetail } from "@/lib/company/candidate-detail-data";
import { evidenceFingerprint } from "@/lib/company/evidence-input";
import {
  candidateSummaryUnavailableMessage,
  relevantSkills,
} from "@/lib/company/candidate-insights";
import { GenerateEvidenceButton } from "./generate-evidence-button";

export function AiEvidenceSummary({
  candidate: c,
  enabled,
}: {
  candidate: CandidateDetail;
  enabled: boolean;
}) {
  const evaluated =
    c.evaluatedSummary?.version === 1 &&
    c.evaluatedSummary.fingerprint === evidenceFingerprint(c)
      ? c.evaluatedSummary
      : null;
  const matchedSkills = relevantSkills(c);
  const gaps = (c.requirements?.skills ?? []).filter(
    (s) => !matchedSkills.some((m) => m.toLowerCase() === s.toLowerCase()),
  );
  function quotes(
    section: "background" | "requirements" | "challenge" | "strengths",
  ) {
    return evaluated?.highlights
      .filter((h) => h.section === section)
      .map((h, i) => {
        const source = evaluated.sources.find((s) => s.id === h.sourceId);
        return (
          <blockquote
            key={`${h.sourceId}-${i}`}
            className="mt-2 text-xs leading-relaxed text-navy/80"
          >
            <p>“{h.quote}”</p>
            <Link
              className="mt-1 inline-block text-teal-ink underline underline-offset-2"
              href={
                source?.kind === "submission" && c.submission
                  ? `/company/submissions/${c.submission.id}`
                  : `/company/candidates/${c.applicationId}?tab=${source?.kind === "cv" ? "resume" : "overview"}`
              }
            >
              {source?.label ?? "Source"}
            </Link>
          </blockquote>
        );
      });
  }
  return (
    <section className="rounded-xl border border-teal/20 bg-teal/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-ink">
          <Sparkles className="size-3.5" aria-hidden="true" />
          AI evidence summary
        </h2>
        <span className="text-xs text-navy/60">Assistive only</span>
      </div>
      {!enabled ? (
        <p className="mt-3 text-sm text-navy/70">
          AI evidence summaries are disabled in Settings. All candidate
          materials remain available for human review.
        </p>
      ) : (
        <div className="mt-4 space-y-4 text-xs leading-relaxed text-navy/70">
          {evaluated?.metrics && evaluated.metrics.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-navy">Structured evidence</h3>
                {evaluated.confidence && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-navy/50">
                    {evaluated.confidence} confidence
                  </span>
                )}
              </div>
              <p className="mt-1 text-navy/55">Adapted to this challenge&apos;s own rubric — not a universal scorecard.</p>
              <ul className="mt-2 space-y-2">
                {evaluated.metrics.map((metric, i) => {
                  const needsHumanReview = metric.level === "insufficient" || metric.level === "not_demonstrated";
                  const levelLabel = metric.level === "insufficient" ? "Insufficient evidence" : metric.level.replace(/_/g, " ");
                  return (
                    <li key={`${metric.criterion}-${i}`} className="rounded-lg border border-navy/10 bg-white p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-navy">{metric.criterion}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${needsHumanReview ? "bg-amber-50 text-amber-700" : "bg-gray-light text-navy/60"}`}>
                          {levelLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-navy/65">{metric.rationale}</p>
                      {metric.evidenceQuote && <p className="mt-1 italic text-navy/50">&quot;{metric.evidenceQuote}&quot;</p>}
                      {needsHumanReview && !metric.evidenceQuote && <p className="mt-1 text-[11px] text-amber-700">Requires human review.</p>}
                    </li>
                  );
                })}
              </ul>
              {(evaluated.strengths?.length ?? 0) > 0 && (
                <p className="mt-2">
                  <span className="font-medium text-navy">Strengths:</span> {evaluated.strengths!.join(" ")}
                </p>
              )}
              {(evaluated.gaps?.length ?? 0) > 0 && (
                <p className="mt-1">
                  <span className="font-medium text-navy">Gaps:</span> {evaluated.gaps!.join(" ")}
                </p>
              )}
              <p className="mt-2 text-navy/50">AI analyzes evidence and produces signals for review — it does not make or imply a hiring decision.</p>
            </div>
          )}
          <div>
            <h3 className="font-semibold text-navy">CV / Background</h3>
            {quotes("background")?.length ? (
              quotes("background")
            ) : (
              <p className="mt-1">
                {c.profile?.cvUrl || c.profile?.cvFileKey
                  ? "CV available. Its experience and projects have not yet been verified from evaluated content."
                  : "No CV is available."}
              </p>
            )}
            <p className="mt-2">
              Profile education (self-reported):{" "}
              {[
                c.profile?.major,
                c.profile?.university,
                c.profile?.graduationYear,
              ]
                .filter(Boolean)
                .join(" · ") || "Not provided"}
              .
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-navy">Role requirements</h3>
            <p className="mt-1">
              Profile skill matches:{" "}
              {matchedSkills.join(" · ") || "None recorded"}. These are
              self-reported, not proof of proficiency.
            </p>
            {quotes("requirements")}
            <p className="mt-2">
              Availability: {c.profile?.availability || "Not provided"}
              {c.requirements
                ? `; role requires ${c.requirements.hoursPerWeek} hours/week`
                : ""}
              .
            </p>
            {c.requirements && (
              <p className="mt-1">
                Location: {c.profile?.location || "Not provided"}; role:{" "}
                {c.requirements.location}
                {c.requirements.workMode ? ` (${c.requirements.workMode})` : ""}
                . Confirm compatibility with the candidate.
              </p>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-navy">Challenge evidence</h3>
            <p className="mt-1">
              {c.submission
                ? `${c.submission.submissionArtifacts.length || c.submission.artifacts.length} submitted files${c.submission.notes.trim() ? " and written notes" : ""}.`
                : "No challenge submission recorded."}{" "}
              {c.challenge?.tasks.length ?? 0} task requirements and{" "}
              {c.challenge?.deliverables.length ?? 0} required deliverables.
              Completion and quality need human verification.
            </p>
            {quotes("challenge")}
            {!evaluated?.highlights.length && (
              <p className="mt-2">{candidateSummaryUnavailableMessage(c)}</p>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-navy">Strengths</h3>
            {quotes("strengths")?.length ? (
              quotes("strengths")
            ) : (
              <p className="mt-1">
                No source-backed strengths have been evaluated yet.
              </p>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-navy">Things to verify / gaps</h3>
            {gaps.length > 0 && (
              <p className="mt-1">
                Not listed in the profile: {gaps.join(" · ")}. This does not
                establish that the candidate lacks these skills.
              </p>
            )}
            <p className="mt-1">
              Check each required deliverable against the files and rubric. A
              file count does not establish task completion.
            </p>
            {evaluated?.unavailable.map((message) => (
              <p key={message} className="mt-2">
                {message}
              </p>
            ))}
            {c.evaluatedSummary && !evaluated && (
              <p className="mt-2">
                Candidate evidence changed. Refresh the summary before relying
                on previous highlights.
              </p>
            )}
          </div>
          <p className="border-t border-teal/15 pt-3">
            AI selects source excerpts, not hiring decisions. Review the
            originals before deciding.
          </p>
          {c.submission && (
            <GenerateEvidenceButton
              submissionId={c.submission.id}
              hasSummary={!!evaluated}
            />
          )}
        </div>
      )}
    </section>
  );
}
