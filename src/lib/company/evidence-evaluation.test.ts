import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateDetail } from "./candidate-detail-data";

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  company: vi.fn(),
  organize: vi.fn(),
  storage: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("./candidate-detail-data", () => ({
  getCandidateDetail: mocks.detail,
}));
vi.mock("@/db", () => ({
  getDb: () => ({ select: () => ({ from: () => ({ where: mocks.company }) }) }),
  schema: { companies: { id: "id", evidenceAiEnabled: "evidence_ai_enabled" } },
}));
vi.mock("@/lib/ai", () => ({
  aiProvider: { organizeEvidence: mocks.organize },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ storage: { from: mocks.storage } }),
}));

import { evaluateCandidateEvidence } from "./evidence-evaluation";

const notes = "Dock 3 accounted for the largest share of delayed shipments.";
function detail(): CandidateDetail {
  return {
    applicationId: "app",
    companyId: "company",
    studentId: "student",
    studentName: "Candidate",
    studentEmail: "candidate@example.com",
    status: "applied",
    appliedAt: new Date("2026-08-29"),
    opportunityId: "posting",
    role: "Data Analyst Intern",
    profile: null,
    challenge: null,
    evidence: null,
    offer: null,
    notes: [],
    activity: [],
    submission: {
      id: "historical-submission",
      submittedAt: new Date("2026-08-30"),
      notes,
      artifacts: [],
      submissionArtifacts: [],
      aiUsageMode: "open",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.detail.mockResolvedValue(detail());
  mocks.company.mockResolvedValue([{ enabled: true }]);
  mocks.organize.mockResolvedValue({
    highlights: [
      { section: "challenge", sourceId: "submission-notes", quote: notes },
    ],
  });
});

describe("candidate evidence evaluation boundaries", () => {
  it("evaluates the exact requested historical submission, not the application's latest", async () => {
    const result = await evaluateCandidateEvidence(
      "app",
      "company",
      "historical-submission",
    );
    expect(mocks.detail).toHaveBeenCalledWith(
      "app",
      "company",
      "historical-submission",
    );
    expect(mocks.organize.mock.calls[0][0].sources).toEqual([
      {
        id: "submission-notes",
        label: "Submission notes",
        kind: "submission",
        text: notes,
      },
    ]);
    expect(result.highlights[0].quote).toBe(notes);
  });

  it("enforces the workspace AI setting before reading files or invoking the provider", async () => {
    mocks.company.mockResolvedValue([{ enabled: false }]);
    await expect(
      evaluateCandidateEvidence("app", "company", "historical-submission"),
    ).rejects.toThrow("disabled in Settings");
    expect(mocks.organize).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it("does not fetch arbitrary external file links or invent an evaluation", async () => {
    const candidate = detail();
    candidate.submission!.notes = "";
    candidate.submission!.artifacts = [
      { name: "analysis.pdf", url: "https://untrusted.example/analysis.pdf" },
    ];
    mocks.detail.mockResolvedValue(candidate);
    const result = await evaluateCandidateEvidence(
      "app",
      "company",
      "historical-submission",
    );
    expect(mocks.storage).not.toHaveBeenCalled();
    expect(mocks.organize).not.toHaveBeenCalled();
    expect(result.highlights).toEqual([]);
    expect(result.unavailable[0]).toContain(
      "file link is available; external content was not fetched",
    );
  });

  it("fails closed when the owner-checked submission cannot be loaded", async () => {
    mocks.detail.mockResolvedValue(null);
    await expect(
      evaluateCandidateEvidence("app", "company", "foreign-submission"),
    ).rejects.toThrow("No submission");
    expect(mocks.company).not.toHaveBeenCalled();
    expect(mocks.organize).not.toHaveBeenCalled();
  });

  it("does not retain provider claims that are absent from the submitted source", async () => {
    mocks.organize.mockResolvedValue({
      highlights: [
        {
          section: "challenge",
          sourceId: "submission-notes",
          quote: "The candidate completed all required tasks perfectly.",
        },
      ],
    });
    expect(
      (
        await evaluateCandidateEvidence(
          "app",
          "company",
          "historical-submission",
        )
      ).highlights,
    ).toEqual([]);
  });
});
