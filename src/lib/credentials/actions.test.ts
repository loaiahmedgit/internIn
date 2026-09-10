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
  grantCredentialCompanyEndorsement: vi.fn(),
  requestBaseCredentialReview: vi.fn(),
  hasOpportunityResponsibility: vi.fn(),
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
  getDb: () => ({
    select: () => ({
      from: () => ({
        // loadCompanyOwnedCredential's plain path: select().from().where().limit()
        where: () => ({ limit: mocks.dbSelectResult }),
        // loadCompanyOwnedCredentialForEndorsement's joined path: select().from().innerJoin().where().limit()
        innerJoin: () => ({ where: () => ({ limit: mocks.dbSelectResult }) }),
      }),
    }),
  }),
  schema: {
    challengeCredentials: { id: "id", companyId: "company_id", applicationId: "application_id" },
    applications: { id: "id", opportunityId: "opportunity_id" },
  },
}));
vi.mock("./issuance", () => ({ issueCredentialForSubmission: mocks.issueCredentialForSubmission }));
vi.mock("./confirmation", () => ({
  confirmPendingCredential: mocks.confirmPendingCredential,
  declineCredentialConfirmation: mocks.declineCredentialConfirmation,
}));
vi.mock("./endorsement", () => ({ withdrawCredentialEndorsement: mocks.withdrawCredentialEndorsement }));
vi.mock("./company-endorsement", () => ({ grantCredentialCompanyEndorsement: mocks.grantCredentialCompanyEndorsement }));
vi.mock("./revocation", () => ({ requestBaseCredentialReview: mocks.requestBaseCredentialReview }));
vi.mock("@/lib/opportunities/responsibility-assignments", () => ({ hasOpportunityResponsibility: mocks.hasOpportunityResponsibility }));

import {
  confirmChallengeCredentialAction,
  declineChallengeCredentialAction,
  getCredentialEligibilityAction,
  getMyCredentialEligibilityAction,
  grantCredentialCompanyEndorsementAction,
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

  it("cross-company: a reviewer at company B cannot confirm company A's credential", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: "u1" }, membership: { companyId: COMPANY_B } });
    mocks.dbSelectResult.mockResolvedValue([{ id: CREDENTIAL_ID, companyId: COMPANY_A, submissionId: SUBMISSION_ID }]);

    await expect(confirmChallengeCredentialAction(CREDENTIAL_ID)).rejects.toThrow(/not authorized/i);
    expect(mocks.confirmPendingCredential).not.toHaveBeenCalled();
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

// R1 §5 — the strict double-gate that governs both granting and
// withdrawing a company endorsement: real company-level permission AND a
// real certificate_approver assignment for this credential's opportunity.
// No workspace_admin bypass, unlike Phase 6A's assertAssignedOrAdmin.
describe("company endorsement authorization (R1 §5)", () => {
  const OPPORTUNITY_ID = "77777777-7777-4777-8777-777777777777";
  const MEMBER_ID = "88888888-8888-4888-8888-888888888888";

  function ownedRow(overrides: Record<string, unknown> = {}) {
    return [{ credential: { id: CREDENTIAL_ID, companyId: COMPANY_A, ...overrides }, opportunityId: OPPORTUNITY_ID }];
  }

  it("cross-company: a reviewer at company B cannot withdraw or grant company A's endorsement", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: "u1" }, membership: { id: MEMBER_ID, companyId: COMPANY_B } });
    mocks.dbSelectResult.mockResolvedValue(ownedRow());

    await expect(withdrawCredentialEndorsementAction({ credentialId: CREDENTIAL_ID, reason: "x" })).rejects.toThrow(/not authorized/i);
    expect(mocks.withdrawCredentialEndorsement).not.toHaveBeenCalled();

    await expect(grantCredentialCompanyEndorsementAction({ credentialId: CREDENTIAL_ID, capabilities: ["Customer reasoning"] })).rejects.toThrow(/not authorized/i);
    expect(mocks.grantCredentialCompanyEndorsement).not.toHaveBeenCalled();
    expect(mocks.hasOpportunityResponsibility).not.toHaveBeenCalled();
  });

  it("same-company but unassigned (no certificate_approver row): company-level permission alone is not enough", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: "u1" }, membership: { id: MEMBER_ID, companyId: COMPANY_A } });
    mocks.dbSelectResult.mockResolvedValue(ownedRow());
    mocks.hasOpportunityResponsibility.mockResolvedValue(false);

    await expect(grantCredentialCompanyEndorsementAction({ credentialId: CREDENTIAL_ID, capabilities: ["Customer reasoning"] })).rejects.toThrow(/not an assigned certificate approver/i);
    expect(mocks.grantCredentialCompanyEndorsement).not.toHaveBeenCalled();

    await expect(withdrawCredentialEndorsementAction({ credentialId: CREDENTIAL_ID, reason: "x" })).rejects.toThrow(/not an assigned certificate approver/i);
    expect(mocks.withdrawCredentialEndorsement).not.toHaveBeenCalled();

    expect(mocks.hasOpportunityResponsibility).toHaveBeenCalledWith(OPPORTUNITY_ID, MEMBER_ID, "certificate_approver");
  });

  it("same-company AND a real certificate_approver assignment CAN grant, with the real actor id and selected capabilities", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: "u1" }, membership: { id: MEMBER_ID, companyId: COMPANY_A } });
    mocks.dbSelectResult.mockResolvedValue(ownedRow());
    mocks.hasOpportunityResponsibility.mockResolvedValue(true);
    mocks.grantCredentialCompanyEndorsement.mockResolvedValue({});

    await grantCredentialCompanyEndorsementAction({ credentialId: CREDENTIAL_ID, capabilities: ["Customer reasoning"] });
    expect(mocks.grantCredentialCompanyEndorsement).toHaveBeenCalledWith(CREDENTIAL_ID, "u1", ["Customer reasoning"]);
  });

  it("same-company AND a real certificate_approver assignment CAN withdraw", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: "u1" }, membership: { id: MEMBER_ID, companyId: COMPANY_A } });
    mocks.dbSelectResult.mockResolvedValue(ownedRow());
    mocks.hasOpportunityResponsibility.mockResolvedValue(true);
    mocks.withdrawCredentialEndorsement.mockResolvedValue({});

    await withdrawCredentialEndorsementAction({ credentialId: CREDENTIAL_ID, reason: "No longer accurate." });
    expect(mocks.withdrawCredentialEndorsement).toHaveBeenCalledWith(CREDENTIAL_ID, "u1", "No longer accurate.");
  });

  it("grant requires at least one selected capability — validated before the double-gate check even runs", async () => {
    await expect(grantCredentialCompanyEndorsementAction({ credentialId: CREDENTIAL_ID, capabilities: [] })).rejects.toThrow();
    expect(mocks.requireCurrentCompanyMember).not.toHaveBeenCalled();
    expect(mocks.grantCredentialCompanyEndorsement).not.toHaveBeenCalled();
  });
});
