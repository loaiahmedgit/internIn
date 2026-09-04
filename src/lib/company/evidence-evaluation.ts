import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { aiProvider } from "@/lib/ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCandidateDetail } from "./candidate-detail-data";
import { evidenceFingerprint } from "./evidence-input";
import {
  groundedHighlights,
  groundedMetrics,
  type EvidenceSource,
  type EvidenceSummary,
} from "./evidence-summary";
import {
  canExtractExtension,
  extractDocumentText,
  extractSpreadsheetSummary,
  fetchLinkText,
  fetchRepositorySummary,
  isRepositoryUrl,
} from "./evidence-adapters";

const MAX_BYTES = 5 * 1024 * 1024;
/** Allow only this application's artifact path or this student's private CV path. */
export async function evaluateCandidateEvidence(
  applicationId: string,
  companyId: string,
  submissionId: string,
): Promise<EvidenceSummary> {
  const detail = await getCandidateDetail(applicationId, companyId, submissionId);
  if (!detail?.submission)
    throw new Error("No submission is available to evaluate.");
  const [company] = await getDb()
    .select({ enabled: schema.companies.evidenceAiEnabled })
    .from(schema.companies)
    .where(eq(schema.companies.id, companyId));
  if (!company?.enabled)
    throw new Error("AI evidence summaries are disabled in Settings.");
  const sources: EvidenceSource[] = [];
  const unavailable: string[] = [];
  const supabase = createAdminClient();
  async function readFile(
    bucket: string,
    path: string,
    name: string,
    kind: "cv" | "submission",
  ) {
    try {
      const prefix =
        bucket === "student-cvs"
          ? `${detail!.studentId}/`
          : `${applicationId}/`;
      const seededSubmission =
        bucket === "submission-artifacts" &&
        path.startsWith(`seed/submissions/${detail!.submission!.id}/`);
      const seededCv =
        kind === "cv" && path === `seed/cv/${detail!.studentId}.pdf`;
      if (
        (!path.startsWith(prefix) && !seededSubmission && !seededCv) ||
        path.split("/").some((part) => part === "..")
      )
        throw new Error("File ownership could not be verified");
      const extension = (name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "").toLowerCase();
      if (!canExtractExtension(extension))
        throw new Error("This file format cannot be evaluated yet — requires human review");
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60);
      if (error || !data) throw new Error("File could not be read");
      const response = await fetch(data.signedUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
      if (
        !response.ok ||
        !response.body ||
        Number(response.headers.get("content-length")) > MAX_BYTES
      )
        throw new Error("File is unavailable or exceeds 5 MB");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_BYTES) {
            await reader.cancel();
            throw new Error("File exceeds 5 MB");
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const buffer = Buffer.concat(chunks);
      const spreadsheetSummary = await extractSpreadsheetSummary(buffer, extension);
      const text = spreadsheetSummary ?? (await extractDocumentText(buffer, extension));
      if (text === null) throw new Error("This file format cannot be evaluated yet — requires human review");
      if (text.trim().length < 20)
        throw new Error(
          "Not enough readable text; scanned files require human review",
        );
      sources.push({
        id: `file-${sources.length}`,
        label: name,
        kind,
        text: text.slice(0, 12_000),
      });
    } catch (error) {
      unavailable.push(
        `${name}: ${error instanceof Error ? error.message : "Could not evaluate this file"}.`,
      );
    }
  }
  if (detail.profile?.cvFileKey)
    await readFile("student-cvs", detail.profile.cvFileKey, "CV.pdf", "cv");
  else if (detail.profile?.cvUrl) {
    try {
      const url = new URL(detail.profile.cvUrl),
        base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
      const prefix = "/storage/v1/object/public/submission-artifacts/";
      if (url.origin !== base.origin || !url.pathname.startsWith(prefix))
        throw new Error();
      await readFile(
        "submission-artifacts",
        decodeURIComponent(url.pathname.slice(prefix.length)),
        "CV.pdf",
        "cv",
      );
    } catch {
      unavailable.push(
        "CV link is available; its contents have not been evaluated.",
      );
    }
  }
  // Real per-artifact rows (every submission made after the P0 rewrite) are
  // the primary source; the legacy jsonb path below only ever fires for
  // pre-rewrite submissions, where it's the only record that exists.
  if (detail.submission.submissionArtifacts.length > 0) {
    for (const artifact of detail.submission.submissionArtifacts.slice(0, 6)) {
      if (artifact.storagePath) {
        await readFile(
          "submission-artifacts",
          artifact.storagePath,
          artifact.originalFilename ?? artifact.label,
          "submission",
        );
      } else if (artifact.externalUrl) {
        if (artifact.artifactKind === "image" || artifact.artifactKind === "video" || artifact.artifactKind === "audio") {
          unavailable.push(`${artifact.label}: requires human review — ${artifact.artifactKind} analysis is not available in this evaluation.`);
        } else if (isRepositoryUrl(artifact.externalUrl)) {
          const repoText = await fetchRepositorySummary(artifact.externalUrl);
          if (repoText) sources.push({ id: `artifact-${artifact.id}`, label: artifact.label, kind: "submission", text: repoText });
          else unavailable.push(`${artifact.label}: requires human review — the repository could not be read (private, missing, or rate-limited).`);
        } else {
          const linkText = await fetchLinkText(artifact.externalUrl);
          if (linkText) sources.push({ id: `artifact-${artifact.id}`, label: artifact.label, kind: "submission", text: linkText });
          else if (/(^|\.)figma\.com$/i.test(new URL(artifact.externalUrl).hostname))
            unavailable.push(`${artifact.label}: requires human review — design tool not accessible for automated analysis.`);
          else unavailable.push(`${artifact.label}: requires human review — this link could not be read automatically.`);
        }
      } else if (artifact.textContent) {
        sources.push({ id: `artifact-${artifact.id}`, label: artifact.label, kind: "submission", text: artifact.textContent.slice(0, 12_000) });
      }
    }
    if (detail.submission.submissionArtifacts.length > 6)
      unavailable.push(
        "Only the first 6 submission artifacts were evaluated. Review the remaining ones manually.",
      );
  } else {
    for (const file of detail.submission.artifacts.slice(0, 6)) {
      try {
        const url = new URL(file.url),
          base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
        const prefix = "/storage/v1/object/public/submission-artifacts/";
        if (url.origin !== base.origin || !url.pathname.startsWith(prefix))
          throw new Error();
        await readFile(
          "submission-artifacts",
          decodeURIComponent(url.pathname.slice(prefix.length)),
          file.name,
          "submission",
        );
      } catch {
        unavailable.push(
          `${file.name}: file link is available; external content was not fetched.`,
        );
      }
    }
    if (detail.submission.artifacts.length > 6)
      unavailable.push(
        "Only the first 6 submission files were evaluated. Review the remaining files manually.",
      );
  }
  if (detail.submission.notes.trim())
    sources.push({
      id: "submission-notes",
      label: "Submission notes",
      kind: "submission",
      text: detail.submission.notes.slice(0, 12_000),
    });
  if (detail.profile)
    sources.push({
      id: "profile",
      label: "Candidate profile (self-reported)",
      kind: "profile",
      text: JSON.stringify({
        education: [
          detail.profile.major,
          detail.profile.university,
          detail.profile.graduationYear,
        ],
        skills: detail.profile.skills,
        availability: detail.profile.availability,
        location: detail.profile.location,
      }),
    });
  const evaluable = sources.filter((s) => s.kind !== "profile");
  const result = evaluable.length
    ? await aiProvider.organizeEvidence({
        sources,
        requirements: JSON.stringify({
          role: detail.role,
          requirements: detail.requirements,
          challenge: detail.challenge,
        }),
      })
    : { highlights: [] };

  // Adaptive rubric evaluation — one metric per this challenge's own
  // rubric criteria, only when there's real submission evidence to
  // evaluate. Never run against profile-only "evidence".
  let metrics: EvidenceSummary["metrics"];
  let strengths: string[] | undefined;
  let gaps: string[] | undefined;
  let confidence: EvidenceSummary["confidence"];
  const submissionSources = sources.filter((s) => s.kind === "submission");
  if (detail.challenge && detail.challenge.rubric.length > 0 && submissionSources.length > 0) {
    const evaluation = await aiProvider.evaluateAgainstRubric({ rubric: detail.challenge.rubric, sources });
    metrics = groundedMetrics(evaluation.metrics, sources);
    strengths = evaluation.strengths;
    gaps = evaluation.gaps;
    confidence = evaluation.confidence;
  }

  return {
    version: 1,
    fingerprint: evidenceFingerprint(detail),
    generatedAt: new Date().toISOString(),
    sources: sources.map(({ id, label, kind }) => ({ id, label, kind })),
    highlights: groundedHighlights(result, sources),
    unavailable,
    metrics,
    strengths,
    gaps,
    confidence,
  };
}
