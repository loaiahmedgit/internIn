import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentCompanyMember: vi.fn(),
  selectResults: [] as unknown[][],
  insertedAssignments: [] as Record<string, unknown>[],
  insertedEvents: [] as Record<string, unknown>[],
  deletedCalls: 0,
}));

vi.mock("@/lib/auth", () => ({ requireCurrentCompanyMember: mocks.requireCurrentCompanyMember }));
vi.mock("@/db", () => ({
  getDb: () => {
    function chain() {
      const c: Record<string, unknown> = {
        from: () => c,
        innerJoin: () => c,
        where: () => c,
        limit: () => c,
        then: (resolve: (value: unknown) => void) => resolve(mocks.selectResults.shift() ?? []),
      };
      return c;
    }
    return {
      select: () => chain(),
      insert: (table: { __marker?: string }) => ({
        values: (payload: Record<string, unknown>) => {
          if (table && table.__marker === "eventLog") {
            mocks.insertedEvents.push(payload);
            return Promise.resolve();
          }
          mocks.insertedAssignments.push(payload);
          return { onConflictDoNothing: () => Promise.resolve() };
        },
      }),
      delete: () => ({
        where: () => {
          mocks.deletedCalls++;
          return Promise.resolve();
        },
      }),
    };
  },
  schema: {
    opportunityResponsibilityAssignments: { id: "id", opportunityId: "opportunity_id", companyMemberId: "company_member_id", responsibilityType: "responsibility_type" },
    opportunities: { id: "id", companyId: "company_id" },
    companyMembers: { id: "id", companyId: "company_id", userId: "user_id" },
    users: { id: "id", fullName: "full_name", email: "email" },
    eventLog: { __marker: "eventLog" },
  },
}));

import { assignOpportunityResponsibilityAction, getOpportunityResponsibilitiesAction, hasOpportunityResponsibility, removeOpportunityResponsibilityAction } from "./responsibility-assignments";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const OPPORTUNITY_ID = "33333333-3333-4333-8333-333333333333";
const MEMBER_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "55555555-5555-4555-8555-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectResults = [];
  mocks.insertedAssignments = [];
  mocks.insertedEvents = [];
  mocks.deletedCalls = 0;
});

describe("hasOpportunityResponsibility", () => {
  it("returns false when no assignment row exists — an unassigned reviewer is never treated as a certificate approver", async () => {
    mocks.selectResults = [[]];
    await expect(hasOpportunityResponsibility(OPPORTUNITY_ID, MEMBER_ID, "certificate_approver")).resolves.toBe(false);
  });

  it("returns true when a matching assignment row exists", async () => {
    mocks.selectResults = [[{ id: "row-1" }]];
    await expect(hasOpportunityResponsibility(OPPORTUNITY_ID, MEMBER_ID, "certificate_approver")).resolves.toBe(true);
  });
});

describe("assignOpportunityResponsibilityAction", () => {
  it("refuses to assign a responsibility on an opportunity owned by another company", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_B } });
    mocks.selectResults = [[{ companyId: COMPANY_A }]];
    await expect(assignOpportunityResponsibilityAction(OPPORTUNITY_ID, MEMBER_ID, "certificate_approver")).rejects.toThrow(/not authorized for this opportunity/i);
    expect(mocks.insertedAssignments).toHaveLength(0);
  });

  it("refuses to assign a member who belongs to a different company", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A } });
    mocks.selectResults = [[{ companyId: COMPANY_A }], [{ companyId: COMPANY_B }]];
    await expect(assignOpportunityResponsibilityAction(OPPORTUNITY_ID, MEMBER_ID, "certificate_approver")).rejects.toThrow(/isn't part of this company/i);
    expect(mocks.insertedAssignments).toHaveLength(0);
  });

  it("records who assigned it, on a same-company opportunity and member", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A } });
    mocks.selectResults = [[{ companyId: COMPANY_A }], [{ companyId: COMPANY_A }]];
    await assignOpportunityResponsibilityAction(OPPORTUNITY_ID, MEMBER_ID, "certificate_approver");
    expect(mocks.insertedAssignments).toHaveLength(1);
    expect(mocks.insertedAssignments[0]).toMatchObject({ opportunityId: OPPORTUNITY_ID, companyMemberId: MEMBER_ID, responsibilityType: "certificate_approver", assignedByUserId: USER_ID });
  });
});

describe("removeOpportunityResponsibilityAction", () => {
  it("refuses to remove a responsibility on an opportunity owned by another company", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_B } });
    mocks.selectResults = [[{ companyId: COMPANY_A }]];
    await expect(removeOpportunityResponsibilityAction(OPPORTUNITY_ID, MEMBER_ID, "certificate_approver")).rejects.toThrow(/not authorized for this opportunity/i);
    expect(mocks.deletedCalls).toBe(0);
  });

  it("deletes the assignment row for a same-company opportunity", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A } });
    mocks.selectResults = [[{ companyId: COMPANY_A }]];
    await removeOpportunityResponsibilityAction(OPPORTUNITY_ID, MEMBER_ID, "certificate_approver");
    expect(mocks.deletedCalls).toBe(1);
  });
});

describe("getOpportunityResponsibilitiesAction", () => {
  it("refuses to read responsibilities for an opportunity owned by another company", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_B } });
    mocks.selectResults = [[{ companyId: COMPANY_A }]];
    await expect(getOpportunityResponsibilitiesAction(OPPORTUNITY_ID)).rejects.toThrow(/not authorized for this opportunity/i);
  });
});
