import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { aiProvider } from "@/lib/ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCandidateDetail } from "./candidate-detail-data";
import { evidenceFingerprint } from "./evidence-input";
import {
  groundedHighlights,
  type EvidenceSource,
  type EvidenceSummary,
} from "./evidence-summary";

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
      if (!/\.(pdf|txt|csv|md)$/i.test(name))
        throw new Error("This file format cannot be evaluated yet");
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
      let text: string;
      if (/\.pdf$/i.test(name)) {
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: buffer });
        try {
          text = (await parser.getText()).text;
        } finally {
          await parser.destroy();
        }
      } else text = buffer.toString("utf8");
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
  return {
    version: 1,
    fingerprint: evidenceFingerprint(detail),
    generatedAt: new Date().toISOString(),
    sources: sources.map(({ id, label, kind }) => ({ id, label, kind })),
    highlights: groundedHighlights(result, sources),
    unavailable,
  };
}
