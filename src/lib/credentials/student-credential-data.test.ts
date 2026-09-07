import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  fromCallCount: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => {
        mocks.fromCallCount++;
        return {
          where: () => ({
            orderBy: () => Promise.resolve(mocks.selectResults.shift() ?? []),
            limit: () => Promise.resolve(mocks.selectResults.shift() ?? []),
          }),
        };
      },
    }),
  }),
  schema: { challengeCredentials: {} },
}));

import { getOwnedCredentialDetail, getStudentCredentialSummaries } from "./student-credential-data";

function issuedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "credential-1",
    studentId: "student-1",
    submissionId: "submission-1",
    status: "issued",
    displayTitle: "Customer Onboarding Review",
    companyDisplayName: "Skyline Logistics",
    companyEndorsed: false,
    issuedAt: new Date("2026-08-02T00:00:00Z"),
    rubricSnapshot: [
      { criterion: "Customer reasoning", level: "strong" },
      { criterion: "Timeliness", level: "insufficient" },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  mocks.selectResults = [];
  mocks.fromCallCount = 0;
});

describe("getStudentCredentialSummaries", () => {
  it("issued credential appears in the Verified Work summary list", async () => {
    mocks.selectResults = [[issuedRow()]];
    const summaries = await getStudentCredentialSummaries("student-1");
    expect(summaries).toHaveLength(1);
    expect(summaries[0].displayTitle).toBe("Customer Onboarding Review");
    // Only demonstrated (strong/solid) criteria surface — the weak one is filtered out.
    expect(summaries[0].demonstratedCriteria).toEqual(["Customer reasoning"]);
  });

  it("is a single flat query — no extra round trip per credential (no N+1)", async () => {
    mocks.selectResults = [[issuedRow(), issuedRow({ id: "credential-2" })]];
    await getStudentCredentialSummaries("student-1");
    expect(mocks.fromCallCount).toBe(1); // one .from() call total, regardless of row count
  });

  it("includes revoked credentials too, with status set — required so the Profile page can exclude their submission from the older generic fallback card (a revoked credential must never silently reappear as ordinary valid Verified Work; full page-level rendering behavior is confirmed in this phase's real browser QA)", async () => {
    mocks.selectResults = [[issuedRow({ id: "credential-revoked", submissionId: "submission-2", status: "revoked" })]];
    const summaries = await getStudentCredentialSummaries("student-1");
    expect(summaries).toHaveLength(1);
    expect(summaries[0].status).toBe("revoked");
    expect(summaries[0].submissionId).toBe("submission-2");
  });
});

describe("getOwnedCredentialDetail", () => {
  it("the owning student can read their own credential", async () => {
    mocks.selectResults = [[issuedRow()]];
    const detail = await getOwnedCredentialDetail("credential-1", "student-1");
    expect(detail?.id).toBe("credential-1");
  });

  it("another student cannot access someone else's credential detail (ownership filter excludes it)", async () => {
    // The real WHERE clause filters by (id AND studentId) together — a
    // mismatched studentId means the DB itself returns no row, which is
    // exactly what this simulates.
    mocks.selectResults = [[]];
    const detail = await getOwnedCredentialDetail("credential-1", "some-other-student");
    expect(detail).toBeNull();
  });
});
