/**
 * Canonical work-sample submission model, shared by the DB schema, AI
 * generation, the submission action, and every challenge UI surface — one
 * source of truth so the taxonomy never drifts between layers.
 *
 * Two independent axes, deliberately not conflated into one "submissionType":
 * - `inputMode`  — HOW the artifact arrives (file, multiple files, typed
 *   text, or a URL).
 * - `artifactKind` — WHAT it actually is (a spreadsheet, a code repo, a
 *   video, ...). A code_repository is always `inputMode: "url"`; a
 *   spreadsheet is usually `inputMode: "file"` but could be `"url"` (a
 *   Google Sheets link) — the two axes compose independently.
 *
 * Both are plain string unions validated at the Zod boundary, not Postgres
 * enums — this taxonomy is expected to keep growing, and a DB enum
 * migration per addition doesn't scale the way it does for genuinely small,
 * stable vocabularies (e.g. offer_status).
 */

export const SUBMISSION_INPUT_MODES = ["file", "multiple_files", "text", "url"] as const;
export type SubmissionInputMode = (typeof SUBMISSION_INPUT_MODES)[number];

export const SUBMISSION_ARTIFACT_KINDS = [
  "pdf",
  "spreadsheet",
  "document",
  "image",
  "code",
  "code_repository",
  "figma",
  "presentation",
  "video",
  "audio",
  "dataset",
  "portfolio",
  "generic_link",
  "text_response",
] as const;
export type SubmissionArtifactKind = (typeof SUBMISSION_ARTIFACT_KINDS)[number];

/**
 * One required-or-optional piece of work a challenge asks the student to
 * submit. `minFiles`/`maxFiles`/`maxFileSizeBytes` are optional and only
 * meaningful for `file`/`multiple_files` — kept optional so the engine
 * doesn't force every requirement to declare limits it doesn't need.
 */
export interface SubmissionRequirement {
  id: string;
  label: string;
  inputMode: SubmissionInputMode;
  artifactKind: SubmissionArtifactKind;
  required: boolean;
  /** File extensions, e.g. [".xlsx", ".csv"] — only meaningful for file inputs. */
  acceptedFormats?: string[];
  /** Restricts a url input to specific hosts, e.g. ["github.com", "gitlab.com"] for a code_repository, or ["figma.com"] for a figma link. */
  providers?: string[];
  minFiles?: number;
  maxFiles?: number;
  maxFileSizeBytes?: number;
  instructions?: string;
}

export const CHALLENGE_RESOURCE_TYPES = ["file", "link"] as const;
export type ChallengeResourceType = (typeof CHALLENGE_RESOURCE_TYPES)[number];

export const RESOURCE_GENERATION_STATUSES = ["pending", "generating", "ready", "failed", "requires_upload"] as const;
export type ResourceGenerationStatus = (typeof RESOURCE_GENERATION_STATUSES)[number];

/**
 * The AI-authored *content* spec behind a generated resource — the model
 * designs what the file should actually contain, server code turns that
 * into real bytes (see src/lib/challenges/resource-generation.ts). Kept on
 * the `challenge_resources` row for audit/regeneration, never shown to the
 * student directly.
 */
export interface SpreadsheetContentSpec {
  kind: "spreadsheet";
  sheetName?: string;
  columns: { name: string; dataType: "text" | "number" | "date" | "boolean" }[];
  rowCount: number;
  rowGenerationHint?: string;
}

export interface DocumentContentSpec {
  kind: "document";
  title: string;
  sections: { heading: string; paragraphs: string[] }[];
}

export interface StructuredDataContentSpec {
  kind: "structured_data";
  schemaDescription: string;
  /** Matches ResourceContentSpecSchema's z.record value union exactly (src/lib/ai/schemas.ts) — kept in sync by hand since this file has no zod dependency. */
  sampleRecords: Record<string, string | number | boolean | null>[];
}

export type ResourceContentSpec = SpreadsheetContentSpec | DocumentContentSpec | StructuredDataContentSpec;

/**
 * A short, real description derived from the requirement's own fields —
 * never invented copy, just plain-language phrasing of acceptedFormats,
 * providers, and file-count limits. Shared by the active submission form
 * and the pre-start "submission preview" so the two never drift.
 */
export function describeSubmissionRequirement(requirement: SubmissionRequirement): string {
  if (requirement.instructions) return requirement.instructions;
  const kindLabel = requirement.artifactKind.replace(/_/g, " ");
  switch (requirement.inputMode) {
    case "file":
      return requirement.acceptedFormats?.length ? `Upload a ${kindLabel} file (${requirement.acceptedFormats.join(", ")})` : `Upload a ${kindLabel} file`;
    case "multiple_files": {
      const min = requirement.minFiles ?? 1;
      const max = requirement.maxFiles;
      const countLabel = max ? `${min}–${max} files` : `at least ${min} file${min > 1 ? "s" : ""}`;
      return `Upload ${countLabel}${requirement.acceptedFormats?.length ? ` (${requirement.acceptedFormats.join(", ")})` : ""}`;
    }
    case "url":
      return requirement.providers?.length ? `Paste a link from ${requirement.providers.join(" or ")}` : "Paste a link";
    case "text":
      return "Write a short written response";
  }
}
