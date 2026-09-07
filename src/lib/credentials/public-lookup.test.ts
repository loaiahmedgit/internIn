import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(mocks.selectResults.shift() ?? []),
        }),
      }),
    }),
  }),
  schema: { challengeCredentials: {}, users: {} },
}));

import { getPublicCredentialByCode } from "./public-lookup";

function credentialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-uuid",
    studentId: "student-uuid",
    applicationId: "application-uuid",
    submissionId: "submission-uuid",
    challengeVersionId: "version-uuid",
    companyId: "company-uuid",
    status: "issued",
    policySnapshot: { policy: "internin_verified", requireHumanConfirmation: false, showCompanyLogo: false },
    companyEndorsed: false,
    companyEndorsedAt: null,
    endorsementWithdrawnAt: null,
    endorsementWithdrawalReason: null,
    displayTitle: "Customer Onboarding Review",
    companyDisplayName: "Skyline Logistics",
    skillsSnapshot: ["Customer reasoning"],
    rubricSnapshot: [
      { criterion: "Customer reasoning", level: "strong" },
      { criterion: "Timeliness", level: "insufficient" },
    ],
    completedAt: new Date("2026-08-01T00:00:00Z"),
    verificationCode: "INTERNIN-CH-ABCDEF",
    isPubliclyShared: true,
    publiclySharedAt: new Date("2026-08-02T00:00:00Z"),
    issuedAt: new Date("2026-08-02T00:00:00Z"),
    revokedAt: null,
    revokedByUserId: null,
    revocationReasonInternal: null,
    revocationReasonPublic: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  mocks.selectResults = [];
});

describe("getPublicCredentialByCode", () => {
  it("malformed code never reaches the DB — returns not_found without querying", async () => {
    const result = await getPublicCredentialByCode("not-a-real-code");
    expect(result.kind).toBe("not_found");
    expect(mocks.selectResults.length).toBe(0); // nothing was ever consumed
  });

  it("unknown (well-formed but absent) code returns not_found", async () => {
    mocks.selectResults = [[]];
    const result = await getPublicCredentialByCode("INTERNIN-CH-ABCDEF");
    expect(result.kind).toBe("not_found");
  });

  it("a pending_human_confirmation row is indistinguishable from not_found — never leaks 'not yet issued'", async () => {
    mocks.selectResults = [[credentialRow({ status: "pending_human_confirmation", issuedAt: null })]];
    const result = await getPublicCredentialByCode("INTERNIN-CH-ABCDEF");
    expect(result.kind).toBe("not_found");
  });

  it("valid issued code returns the minimal public DTO", async () => {
    mocks.selectResults = [[credentialRow()], [{ fullName: "Amina K." }]];
    const result = await getPublicCredentialByCode("INTERNIN-CH-ABCDEF");
    expect(result.kind).toBe("found");
    if (result.kind !== "found") throw new Error("unreachable");
    expect(result.credential.status).toBe("valid");
    expect(result.credential.studentDisplayName).toBe("Amina K.");
    expect(result.credential.displayTitle).toBe("Customer Onboarding Review");
    // Only the demonstrated (strong/solid) criterion — never the insufficient one.
    expect(result.credential.demonstratedCriteria).toEqual([{ criterion: "Customer reasoning", level: "strong" }]);
  });

  it("revoked code returns the revoked state, not not_found", async () => {
    mocks.selectResults = [[credentialRow({ revokedAt: new Date("2026-09-01T00:00:00Z"), revocationReasonPublic: "Policy violation." })], [{ fullName: "Amina K." }]];
    const result = await getPublicCredentialByCode("INTERNIN-CH-ABCDEF");
    expect(result.kind).toBe("found");
    if (result.kind !== "found") throw new Error("unreachable");
    expect(result.credential.status).toBe("revoked");
    expect(result.credential.revocationReasonPublic).toBe("Policy violation.");
  });

  it("public DTO excludes private IDs/data — never a raw row's private fields", async () => {
    mocks.selectResults = [[credentialRow()], [{ fullName: "Amina K." }]];
    const result = await getPublicCredentialByCode("INTERNIN-CH-ABCDEF");
    if (result.kind !== "found") throw new Error("unreachable");
    const keys = Object.keys(result.credential);
    for (const forbidden of ["studentId", "applicationId", "submissionId", "companyId", "id", "revocationReasonInternal", "revokedByUserId", "metadata"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
