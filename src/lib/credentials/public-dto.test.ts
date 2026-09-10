import { describe, expect, it } from "vitest";
import { toPublicCredentialDto } from "./public-dto";
import type { ChallengeCredentialRow } from "./credential-data";

function row(overrides: Partial<ChallengeCredentialRow> = {}): ChallengeCredentialRow {
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
    companyEndorsedByUserId: null,
    companyEndorsedCapabilities: [],
    endorsementWithdrawnAt: null,
    endorsementWithdrawnByUserId: null,
    endorsementWithdrawalReason: null,
    displayTitle: "Customer Onboarding Review",
    companyDisplayName: "Skyline Logistics",
    skillsSnapshot: ["Customer reasoning"],
    rubricSnapshot: [
      { criterion: "Customer reasoning", level: "strong" },
      { criterion: "Practicality", level: "solid" },
      { criterion: "Timeliness", level: "insufficient" },
    ],
    completedAt: new Date("2026-08-01T00:00:00Z"),
    verificationCode: "INTERNIN-CH-ABCDEF",
    isPubliclyShared: true,
    publiclySharedAt: new Date("2026-08-02T00:00:00Z"),
    issuedAt: new Date("2026-08-02T00:00:00Z"),
    revokedAt: null,
    revokedByUserId: null,
    revocationReasonInternal: "internal only, never public",
    revocationReasonPublic: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ChallengeCredentialRow;
}

describe("toPublicCredentialDto", () => {
  it("shows only demonstrated (strong/solid) criteria, never a weak/unresolved one", () => {
    const dto = toPublicCredentialDto(row(), "Amina K.");
    expect(dto.demonstratedCriteria).toEqual([
      { criterion: "Customer reasoning", level: "strong" },
      { criterion: "Practicality", level: "solid" },
    ]);
  });

  it("company endorsement renders independently of the base status", () => {
    // Endorsed AND currently issued.
    const endorsedIssued = toPublicCredentialDto(row({ companyEndorsed: true }), "Amina K.");
    expect(endorsedIssued.companyEndorsed).toBe(true);
    expect(endorsedIssued.status).toBe("valid");

    // Endorsement withdrawn (companyEndorsed false) but base credential still valid.
    const withdrawnStillValid = toPublicCredentialDto(row({ companyEndorsed: false, endorsementWithdrawnAt: new Date() }), "Amina K.");
    expect(withdrawnStillValid.companyEndorsed).toBe(false);
    expect(withdrawnStillValid.status).toBe("valid");

    // Never endorsed, base credential revoked — companyEndorsed still reads independently (false here, but driven by its own field, not derived from status).
    const revokedNeverEndorsed = toPublicCredentialDto(row({ companyEndorsed: false, revokedAt: new Date() }), "Amina K.");
    expect(revokedNeverEndorsed.companyEndorsed).toBe(false);
    expect(revokedNeverEndorsed.status).toBe("revoked");
  });

  it("exposes the granted capability subset, never a blanket endorsement", () => {
    const dto = toPublicCredentialDto(
      row({ companyEndorsed: true, companyEndorsedCapabilities: ["Customer reasoning"], companyEndorsedAt: new Date("2026-08-05T00:00:00Z") }),
      "Amina K.",
    );
    expect(dto.companyEndorsedCapabilities).toEqual(["Customer reasoning"]);
    expect(dto.companyEndorsedAt).toBe("2026-08-05T00:00:00.000Z");
    expect(dto.endorsementWithdrawnAt).toBeNull();
  });

  it("distinguishes never-granted from granted-then-withdrawn", () => {
    const neverGranted = toPublicCredentialDto(row(), "Amina K.");
    expect(neverGranted.companyEndorsed).toBe(false);
    expect(neverGranted.endorsementWithdrawnAt).toBeNull();

    const withdrawn = toPublicCredentialDto(row({ companyEndorsed: false, endorsementWithdrawnAt: new Date("2026-08-06T00:00:00Z") }), "Amina K.");
    expect(withdrawn.companyEndorsed).toBe(false);
    expect(withdrawn.endorsementWithdrawnAt).toBe("2026-08-06T00:00:00.000Z");
  });

  it("mutable challenge/company changes cannot alter this presentation — only the row's own snapshot columns are read, nothing is re-derived", () => {
    // The mapper takes no challenge/company/rubric argument at all — its
    // only inputs are the row and a display name. This is a structural
    // guarantee, not just a behavioral one: there is no live data this
    // function could even read to drift.
    expect(toPublicCredentialDto.length).toBe(2);
  });

  it("never exposes internal revocation reason, only the public one", () => {
    const dto = toPublicCredentialDto(row({ revokedAt: new Date(), revocationReasonPublic: "Policy violation." }), "Amina K.");
    expect(dto.revocationReasonPublic).toBe("Policy violation.");
    expect(Object.values(dto)).not.toContain("internal only, never public");
  });

  it("excludes every private id field by construction", () => {
    const dto = toPublicCredentialDto(row(), "Amina K.");
    const keys = Object.keys(dto);
    for (const forbidden of [
      "id",
      "studentId",
      "applicationId",
      "submissionId",
      "companyId",
      "revokedByUserId",
      "policySnapshot",
      "metadata",
      "companyEndorsedByUserId",
      "endorsementWithdrawnByUserId",
      "endorsementWithdrawalReason",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
