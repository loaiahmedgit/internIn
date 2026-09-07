import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentCompanyMember: vi.fn(),
  requireCurrentStudent: vi.fn(),
  loadCredentialContext: vi.fn(),
  toEligibilityInput: vi.fn((c: unknown) => c),
  dbSelectResult: vi.fn(),
  issueCredentialForSubmission: vi.fn(),
  confirmPendingCredential: vi.fn(),
  declineCredentialConfirmation: vi.fn(),
  withdrawCredentialEndorsement: vi.fn(),
  requestBaseCredentialReview: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  requireCurrentCompanyMember: mocks.requireCurrentCompanyMember,
  requireCurrentStudent: mocks.requireCurrentStudent,
}));
vi.mock("./credential-data", () => ({
  loadCredentialContext: mocks.loadCredentialContext,
  toEligibilityInput: mocks.toEligibilityInput,
}));
vi.mock("@/db", () => ({
  getDb: () => ({ select: () => ({ from: () => ({ where: () => ({ limit: mocks.dbSelectResult }) }) }) }),
  schema: { challengeCredentials: { id: "id", companyId: "company_id" } },
}));
vi.mock("./issuance", () => ({ issueCredentialForSubmission: mocks.issueCredentialForSubmission }));
vi.mock("./confirmation", () => ({
  confirmPendingCredential: mocks.confirmPendingCredential,
  declineCredentialConfirmation: mocks.declineCredentialConfirmation,
}));
vi.mock("./endorsement", () => ({ withdrawCredentialEndorsement: mocks.withdrawCredentialEndorsement }));
vi.mock("./revocation", () => ({ requestBaseCredentialReview: mocks.requestBaseCredentialReview }));

import {
  confirmChallengeCredentialAction,
  declineChallengeCredentialAction,
  getCredentialEligibilityAction,
  getMyCredentialEligibilityAction,
  issueChallengeCredentialAction,
  requestBaseCredentialReviewAction,
  withdrawCredentialEndorsementAction,
} from "./actions";

// Real RFC4122-shaped UUIDs — Zod's .uuid() validates the version/variant
// nibbles, so an all-repeated-digit placeholder like "111...111" fails
// parsing before authorization logic ever runs.
const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const STUDENT_1 = "33333333-3333-4333-8333-333333333333";
const STUDENT_2 = "44444444-4444-4444-8444-444444444444";
const SUBMISSION_ID = "55555555-5555-4555-8555-555555555555";
const CREDENTIAL_ID = "66666666-6666-4666-8666-666666666666";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.toEligibilityInput.mockImplementation((c: unknown) => c);
});

describe("credential action authorization", () => {
  it("cross-company: a reviewer at company B cannot read company A's submission eligibility", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: "u1" }, membership: { companyId: COMPANY_B } });
    mocks.loadCredentialContext.mockResolvedValue({ companyId: COMPANY_A });

    await expect(getCredentialEligibilityAction(SUBMISSION_ID)).rejects.toThrow(/not authorized/i);
  });

  it("cross-company: a reviewer at company B cannot act on company A's credential", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: "u1" }, membership: { companyId: COMPANY_B } });
    mocks.dbSelectResult.mockResolvedValue([{ id: CREDENTIAL_ID, companyId: COMPANY_A, submissionId: SUBMISSION_ID }]);

    await expect(confirmChallengeCredentialAction(CREDENTIAL_ID)).rejects.toThrow(/not authorized/i);
    expect(mocks.confirmPendingCredential).not.toHaveBeenCalled();

    await expect(withdrawCredentialEndorsementAction({ credentialId: CREDENTIAL_ID, reason: "x" })).rejects.toThrow(/not authorized/i);
    expect(mocks.withdrawCredentialEndorsement).not.toHaveBeenCalled();
  });

  it("cross-student: a student cannot read another student's submission eligibility", async () => {
    mocks.requireCurrentStudent.mockResolvedValue({ user: { id: STUDENT_1 } });
    mocks.loadCredentialContext.mockResolvedValue({ application: { studentId: STUDENT_2 } });

    await expect(getMyCredentialEligibilityAction(SUBMISSION_ID)).rejects.toThrow(/not authorized/i);
  });

  it("same-company reviewer CAN act — issuance is invoked with the real actor id", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: "u1" }, membership: { companyId: COMPANY_A } });
    mocks.loadCredentialContext.mockResolvedValue({ companyId: COMPANY_A });
    mocks.issueCredentialForSubmission.mockResolvedValue({ outcome: "issued", credential: null, eligibility: null });

    await issueChallengeCredentialAction(SUBMISSION_ID);
    expect(mocks.issueCredentialForSubmission).toHaveBeenCalledWith(SUBMISSION_ID, "u1");
  });

  it("decline requires a non-empty reason", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: "u1" }, membership: { companyId: COMPANY_A } });
    mocks.dbSelectResult.mockResolvedValue([{ id: CREDENTIAL_ID, companyId: COMPANY_A }]);

    await expect(declineChallengeCredentialAction({ credentialId: CREDENTIAL_ID, reason: "" })).rejects.toThrow();
    expect(mocks.declineCredentialConfirmation).not.toHaveBeenCalled();
  });

  it("company review-request calls requestBaseCredentialReview, never a revoke path", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: "u1" }, membership: { companyId: COMPANY_A } });
    mocks.dbSelectResult.mockResolvedValue([{ id: CREDENTIAL_ID, companyId: COMPANY_A }]);

    await requestBaseCredentialReviewAction({ credentialId: CREDENTIAL_ID, reason: "please re-check" });
    expect(mocks.requestBaseCredentialReview).toHaveBeenCalledWith(CREDENTIAL_ID, "u1", "please re-check");
  });

  it("company cannot revoke base credential — actions.ts never references revokeBaseCredential at all", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/revokeBaseCredential/);
  });
});
