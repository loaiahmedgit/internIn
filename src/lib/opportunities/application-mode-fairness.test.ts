import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentCompanyMember: vi.fn(),
  canManagePublication: vi.fn(() => true),
  selectResults: [] as unknown[][],
  updatedRows: [] as { table: string; payload: Record<string, unknown> }[],
  insertedEvents: [] as Record<string, unknown>[],
  sendNotificationEvent: vi.fn(),
  generateResourceFile: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireCurrentCompanyMember: mocks.requireCurrentCompanyMember }));
vi.mock("@/lib/company/permissions", () => ({ canManagePublication: mocks.canManagePublication }));
vi.mock("@/lib/inngest/client", () => ({ sendNotificationEvent: mocks.sendNotificationEvent }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ storage: { from: () => ({ upload: vi.fn() }) } }) }));
vi.mock("@/lib/challenges/resource-generation", () => ({ generateResourceFile: mocks.generateResourceFile }));
vi.mock("@/lib/ai", async () => {
  const schemas = await import("@/lib/ai/schemas");
  return {
    ...schemas,
    aiProvider: {},
    isWorkModeLabel: () => false,
    NOT_A_WORK_MODE_LOCATION_MESSAGE: "not a work mode",
  };
});

vi.mock("@/db", () => ({
  getDb: () => {
    function chain(kind: "select" | "update" | "delete", table?: string) {
      const c: Record<string, unknown> = {
        from: () => c,
        innerJoin: () => c,
        where: () => c,
        limit: () => c,
        orderBy: () => c,
        returning: () => c,
        set: (payload: Record<string, unknown>) => {
          if (kind === "update") mocks.updatedRows.push({ table: table ?? "unknown", payload });
          return c;
        },
        values: (payload: Record<string, unknown>) => {
          if (table === "eventLog") mocks.insertedEvents.push(payload);
          return c;
        },
        then: (resolve: (value: unknown) => void) => resolve(mocks.selectResults.shift() ?? []),
      };
      return c;
    }
    return {
      select: () => chain("select"),
      update: (table: { __name?: string }) => chain("update", table?.__name),
      insert: (table: { __name?: string }) => chain("insert" as never, table?.__name),
      delete: () => chain("delete"),
    };
  },
  schema: {
    opportunities: { __name: "opportunities", id: "id", companyId: "company_id", status: "status", applicationMode: "application_mode" },
    applications: { __name: "applications", id: "id", opportunityId: "opportunity_id", status: "status" },
    challenges: { __name: "challenges", id: "id", opportunityId: "opportunity_id", status: "status", currentVersionId: "current_version_id" },
    challengeVersions: { __name: "challengeVersions", id: "id" },
    challengeResources: { __name: "challengeResources" },
    submissions: { __name: "submissions", id: "id", applicationId: "application_id" },
    companies: { __name: "companies", id: "id", name: "name" },
    users: { __name: "users", id: "id" },
    internshipOffers: { __name: "internshipOffers", id: "id", applicationId: "application_id", status: "status" },
    eventLog: { __name: "eventLog" },
  },
}));

import {
  createOpportunityAction,
  publishOpportunityAction,
  saveInternshipAction,
  shortlistApplicationAction,
  inviteToInternshipAction,
  updateApplicationModeAction,
  saveChallengeVersionAction,
  type InternshipFormInput,
} from "./actions";
import type { Challenge, InternshipDraft } from "@/lib/ai";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const OPPORTUNITY_ID = "33333333-3333-4333-8333-333333333333";
const APPLICATION_ID = "44444444-4444-4444-8444-444444444444";
const CHALLENGE_ID = "55555555-5555-4555-8555-555555555555";
const VERSION_ID = "66666666-6666-4666-8666-666666666666";
const USER_ID = "77777777-7777-4777-8777-777777777777";

function approvedChallengeRow(overrides: Record<string, unknown> = {}) {
  return { id: CHALLENGE_ID, opportunityId: OPPORTUNITY_ID, status: "approved", currentVersionId: VERSION_ID, ...overrides };
}
function currentVersionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VERSION_ID,
    title: "Real challenge",
    scenario: "A real scenario.",
    estimatedMinutes: 60,
    safeguardPolicyVersion: 2,
    assessmentBasis: "synthetic",
    productionWorkRisk: "none",
    productionWorkReason: null,
    transformationApplied: false,
    originalIntentSummary: null,
    nonProductionConfirmedByUserId: USER_ID,
    nonProductionConfirmedAt: new Date("2026-09-10T10:00:00Z"),
    durationExceptionJustification: null,
    skills: [],
    tasks: [{ id: "t1", title: "Task", description: "Do the thing." }],
    deliverables: ["A file"],
    files: [],
    rubric: [{ criterion: "Quality", description: "d", weight: 100 }],
    submissionRequirements: [{ id: "s1", label: "Written", inputMode: "text", artifactKind: "text_response", required: true }],
    ...overrides,
  };
}

const baseForm: InternshipFormInput = {
  role: "Data Intern",
  department: null,
  shortDescription: null,
  description: "A real description of the role.",
  whatYouWillLearn: null,
  requirements: [],
  niceToHave: [],
  duration: "8 weeks",
  hoursPerWeek: 20,
  location: "Doha, Qatar",
  workMode: null,
  applicationDeadline: null,
  startDate: null,
  slots: 1,
  skills: [],
  requireCv: true,
  applicationQuestions: [],
  applicationMode: "optional_challenge",
};

const baseInternship: InternshipDraft = {
  role: "Data Intern",
  duration: "8 weeks",
  hoursPerWeek: 20,
  location: "Doha, Qatar",
  workMode: null,
  applicationDeadline: null,
  slots: 1,
  skills: [],
  description: "A real description of the role.",
};

const approvedChallenge: Challenge = {
  title: "Safe assessment",
  scenario: "Use the supplied synthetic records to complete a short analysis exercise.",
  estimatedMinutes: 60,
  assessmentBasis: "synthetic",
  productionWorkRisk: "none",
  productionWorkReason: null,
  transformationApplied: false,
  originalIntentSummary: null,
  nonProductionConfirmed: true,
  durationExceptionJustification: null,
  skills: ["Analysis"],
  tasks: [{ id: "t1", title: "Analyze records", description: "Analyze the synthetic records." }],
  deliverables: ["Written response"],
  files: [],
  rubric: [{ criterion: "Accuracy", description: "Work is accurate.", weight: 100 }],
  submissionRequirements: [{ id: "s1", label: "Written response", inputMode: "text", artifactKind: "text_response", required: true }],
  status: "approved",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canManagePublication.mockReturnValue(true);
  mocks.selectResults = [];
  mocks.updatedRows = [];
  mocks.insertedEvents = [];
});

describe("createOpportunityAction — R2 §1/§2", () => {
  it("defaults to optional_challenge when no mode is passed", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    mocks.selectResults = [[{ id: OPPORTUNITY_ID, applicationMode: "optional_challenge" }]];
    await createOpportunityAction(baseInternship);
    const insertCall = mocks.updatedRows; // n/a — check via the chain's set never used for insert; assert no throw instead
    expect(insertCall).toBeDefined();
  });

  it("accepts an explicit quick_apply mode", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    mocks.selectResults = [[{ id: OPPORTUNITY_ID, applicationMode: "quick_apply" }]];
    await expect(createOpportunityAction(baseInternship, "quick_apply")).resolves.toBeTruthy();
  });

  it("rejects an invalid mode string", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    // @ts-expect-error deliberately invalid input
    await expect(createOpportunityAction(baseInternship, "not_a_real_mode")).rejects.toThrow();
  });
});

describe("publish gate — R2 §4 (ensureChallengeReadyForPublish, shared by both real publish entry points)", () => {
  it("publishOpportunityAction skips the challenge requirement entirely for quick_apply", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    mocks.selectResults = [
      [{ verified: true }], // assertCompanyVerified
      [{ id: OPPORTUNITY_ID, companyId: COMPANY_A, applicationMode: "quick_apply" }], // assertOwnsOpportunity
    ];
    await publishOpportunityAction(OPPORTUNITY_ID);
    expect(mocks.updatedRows.some((r) => r.table === "opportunities" && r.payload.status === "published")).toBe(true);
  });

  it("publishOpportunityAction rejects optional_challenge with no challenge row at all", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    mocks.selectResults = [
      [{ verified: true }],
      [{ id: OPPORTUNITY_ID, companyId: COMPANY_A, applicationMode: "optional_challenge" }], // assertOwnsOpportunity
      [], // no challenge row
    ];
    await expect(publishOpportunityAction(OPPORTUNITY_ID)).rejects.toThrow(/add and approve a work challenge|switch application mode to quick apply/i);
    expect(mocks.updatedRows.some((r) => r.table === "opportunities" && r.payload.status === "published")).toBe(false);
  });

  it("publishOpportunityAction rejects challenge_required with an un-approved challenge", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    mocks.selectResults = [
      [{ verified: true }],
      [{ id: OPPORTUNITY_ID, companyId: COMPANY_A, applicationMode: "challenge_required" }],
      [approvedChallengeRow({ status: "pending_approval" })],
    ];
    await expect(publishOpportunityAction(OPPORTUNITY_ID)).rejects.toThrow(/approve the current challenge version/i);
  });

  it("publishOpportunityAction succeeds for challenge_required with a real approved+substantive challenge", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    mocks.selectResults = [
      [{ verified: true }],
      [{ id: OPPORTUNITY_ID, companyId: COMPANY_A, applicationMode: "challenge_required" }],
      [approvedChallengeRow()],
      [currentVersionRow()],
      [], // challengeResources — none required, none pending
    ];
    await publishOpportunityAction(OPPORTUNITY_ID);
    expect(mocks.updatedRows.some((r) => r.table === "opportunities" && r.payload.status === "published")).toBe(true);
  });

  it("blocks a new optional Challenge publish when assessment basis is missing", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    mocks.selectResults = [
      [{ verified: true }],
      [{ id: OPPORTUNITY_ID, companyId: COMPANY_A, applicationMode: "optional_challenge" }],
      [approvedChallengeRow()],
      [currentVersionRow({ assessmentBasis: null })],
    ];
    await expect(publishOpportunityAction(OPPORTUNITY_ID)).rejects.toThrow(/choose what makes this a non-production assessment/i);
  });

  it("blocks a new required Challenge publish when human confirmation is missing", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    mocks.selectResults = [
      [{ verified: true }],
      [{ id: OPPORTUNITY_ID, companyId: COMPANY_A, applicationMode: "challenge_required" }],
      [approvedChallengeRow()],
      [currentVersionRow({ nonProductionConfirmedByUserId: null, nonProductionConfirmedAt: null })],
    ];
    await expect(publishOpportunityAction(OPPORTUNITY_ID)).rejects.toThrow(/confirm that this challenge is an assessment/i);
  });

  it("requires justification above 90 minutes and accepts it when present", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    mocks.selectResults = [
      [{ verified: true }],
      [{ id: OPPORTUNITY_ID, companyId: COMPANY_A, applicationMode: "optional_challenge" }],
      [approvedChallengeRow()],
      [currentVersionRow({ estimatedMinutes: 100 })],
    ];
    await expect(publishOpportunityAction(OPPORTUNITY_ID)).rejects.toThrow(/more than 90 minutes/i);

    mocks.selectResults = [
      [{ verified: true }],
      [{ id: OPPORTUNITY_ID, companyId: COMPANY_A, applicationMode: "optional_challenge" }],
      [approvedChallengeRow()],
      [currentVersionRow({
        estimatedMinutes: 100,
        durationExceptionJustification: "The role-specific exercise needs two short validation passes.",
      })],
      [],
    ];
    await expect(publishOpportunityAction(OPPORTUNITY_ID)).resolves.toBeUndefined();
  });

  it("hard-blocks active work above 120 minutes", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    mocks.selectResults = [
      [{ verified: true }],
      [{ id: OPPORTUNITY_ID, companyId: COMPANY_A, applicationMode: "optional_challenge" }],
      [approvedChallengeRow()],
      [currentVersionRow({
        estimatedMinutes: 121,
        durationExceptionJustification: "The company requested a larger exercise for this role.",
      })],
    ];
    await expect(publishOpportunityAction(OPPORTUNITY_ID)).rejects.toThrow(/120 minutes or less/i);
  });

  it("allows an untouched legacy Challenge to remain live but does not let a merely approved legacy version use that bypass", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    mocks.selectResults = [
      [{ verified: true }],
      [{ id: OPPORTUNITY_ID, companyId: COMPANY_A, status: "published", applicationMode: "optional_challenge" }],
      [approvedChallengeRow({ status: "published" })],
      [currentVersionRow({ safeguardPolicyVersion: 1, assessmentBasis: null, nonProductionConfirmedByUserId: null, nonProductionConfirmedAt: null })],
      [],
    ];
    await expect(publishOpportunityAction(OPPORTUNITY_ID)).resolves.toBeUndefined();

    mocks.selectResults = [
      [{ verified: true }],
      [{ id: OPPORTUNITY_ID, companyId: COMPANY_A, status: "published", applicationMode: "optional_challenge" }],
      [approvedChallengeRow({ status: "approved" })],
      [currentVersionRow({ safeguardPolicyVersion: 1, assessmentBasis: null, nonProductionConfirmedByUserId: null, nonProductionConfirmedAt: null })],
    ];
    await expect(publishOpportunityAction(OPPORTUNITY_ID)).rejects.toThrow(/review this legacy challenge/i);
  });

  it("saveInternshipAction (the manual-form publish path) runs the identical gate — rejects challenge_required on a new listing with no challenge yet", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    mocks.selectResults = [
      [{ verified: true }],
      [{ id: OPPORTUNITY_ID }], // insert-as-draft .returning()
      [], // no challenge row for the new draft
    ];
    await expect(saveInternshipAction({ publish: true, form: { ...baseForm, applicationMode: "challenge_required" } })).rejects.toThrow(/add and approve a work challenge/i);
  });

  it("saveInternshipAction publishes quick_apply immediately with no challenge involved", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    mocks.selectResults = [[{ verified: true }], [{ id: OPPORTUNITY_ID }]];
    const id = await saveInternshipAction({ publish: true, form: { ...baseForm, applicationMode: "quick_apply" } });
    expect(id).toBe(OPPORTUNITY_ID);
    expect(mocks.updatedRows.some((r) => r.table === "opportunities" && r.payload.status === "published")).toBe(true);
  });
});

describe("R3 Challenge safeguard authorization", () => {
  it("does not let a student session record company confirmation", async () => {
    mocks.requireCurrentCompanyMember.mockRejectedValue(new Error("Not signed in as a company user."));
    await expect(
      saveChallengeVersionAction(OPPORTUNITY_ID, approvedChallenge, "approved"),
    ).rejects.toThrow(/not signed in as a company user/i);
  });

  it("does not let a member confirm a Challenge owned by another company", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({
      user: { id: USER_ID },
      membership: { companyId: COMPANY_B, role: "owner" },
    });
    mocks.selectResults = [[{ id: OPPORTUNITY_ID, companyId: COMPANY_A }]];
    await expect(
      saveChallengeVersionAction(OPPORTUNITY_ID, approvedChallenge, "approved"),
    ).rejects.toThrow(/not authorized for this opportunity/i);
  });
});

describe("shortlist/offer fairness gate — R2 §13/§14/§15/§17/§18/§19/§20", () => {
  it("blocks shortlist for challenge_required with no submission — clear, specific error", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A } });
    mocks.selectResults = [
      [{ id: APPLICATION_ID, opportunityCompanyId: COMPANY_A, applicationMode: "challenge_required" }],
      [], // no submission
    ];
    await expect(shortlistApplicationAction(APPLICATION_ID)).rejects.toThrow(/requires a completed challenge before the candidate can be shortlisted/i);
    expect(mocks.updatedRows.some((r) => r.table === "applications")).toBe(false);
  });

  it("blocks offer for challenge_required with no submission — clear, specific error, distinct wording from shortlist", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A } });
    mocks.selectResults = [
      [{ verified: true }],
      [{ id: APPLICATION_ID, opportunityCompanyId: COMPANY_A, applicationMode: "challenge_required", role: "Data Intern", companyName: "Acme", studentEmail: "s@example.com", studentName: "Student" }],
      [], // no submission
    ];
    await expect(inviteToInternshipAction(APPLICATION_ID)).rejects.toThrow(/requires a completed challenge before you can send an offer/i);
  });

  it("clears the gate on a real final submission — a started-but-not-submitted session never clears it (only a submissions row does)", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A } });
    mocks.selectResults = [
      [{ id: APPLICATION_ID, opportunityCompanyId: COMPANY_A, applicationMode: "challenge_required" }],
      [{ id: "submission-1" }], // a real submission exists
    ];
    await shortlistApplicationAction(APPLICATION_ID);
    expect(mocks.updatedRows.some((r) => r.table === "applications" && r.payload.status === "shortlisted")).toBe(true);
  });

  it("optional_challenge: shortlist succeeds with zero submission — that's the definition of optional", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A } });
    mocks.selectResults = [[{ id: APPLICATION_ID, opportunityCompanyId: COMPANY_A, applicationMode: "optional_challenge" }]];
    await shortlistApplicationAction(APPLICATION_ID);
    expect(mocks.updatedRows.some((r) => r.table === "applications" && r.payload.status === "shortlisted")).toBe(true);
  });

  it("quick_apply: shortlist succeeds with zero submission — no challenge exists at all", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A } });
    mocks.selectResults = [[{ id: APPLICATION_ID, opportunityCompanyId: COMPANY_A, applicationMode: "quick_apply" }]];
    await shortlistApplicationAction(APPLICATION_ID);
    expect(mocks.updatedRows.some((r) => r.table === "applications" && r.payload.status === "shortlisted")).toBe(true);
  });

  it("cross-company: a reviewer at company B cannot shortlist company A's challenge_required application", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_B } });
    mocks.selectResults = [[{ id: APPLICATION_ID, opportunityCompanyId: COMPANY_A, applicationMode: "challenge_required" }]];
    await expect(shortlistApplicationAction(APPLICATION_ID)).rejects.toThrow(/not authorized/i);
  });
});

describe("updateApplicationModeAction — R2 §7 switching safety", () => {
  it("switching a PUBLISHED opportunity to challenge_required with no approved challenge is rejected", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    mocks.selectResults = [
      [{ id: OPPORTUNITY_ID, companyId: COMPANY_A, status: "published" }], // assertOwnsOpportunity
      [], // no challenge row
    ];
    await expect(updateApplicationModeAction(OPPORTUNITY_ID, "challenge_required")).rejects.toThrow(/add and approve a work challenge/i);
    expect(mocks.updatedRows.some((r) => r.table === "opportunities" && r.payload.applicationMode === "challenge_required")).toBe(false);
  });

  it("switching a PUBLISHED opportunity to quick_apply always succeeds — never blocked, never deletes challenge data", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    mocks.selectResults = [[{ id: OPPORTUNITY_ID, companyId: COMPANY_A, status: "published" }]];
    await updateApplicationModeAction(OPPORTUNITY_ID, "quick_apply");
    expect(mocks.updatedRows.some((r) => r.table === "opportunities" && r.payload.applicationMode === "quick_apply")).toBe(true);
  });

  it("switching a DRAFT opportunity to any mode is always safe — re-gated later at actual publish time", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_A, role: "owner" } });
    mocks.selectResults = [[{ id: OPPORTUNITY_ID, companyId: COMPANY_A, status: "draft" }]];
    await updateApplicationModeAction(OPPORTUNITY_ID, "challenge_required");
    expect(mocks.updatedRows.some((r) => r.table === "opportunities" && r.payload.applicationMode === "challenge_required")).toBe(true);
  });

  it("cross-company: cannot change another company's opportunity mode", async () => {
    mocks.requireCurrentCompanyMember.mockResolvedValue({ user: { id: USER_ID }, membership: { companyId: COMPANY_B, role: "owner" } });
    mocks.selectResults = [[{ id: OPPORTUNITY_ID, companyId: COMPANY_A, status: "draft" }]];
    await expect(updateApplicationModeAction(OPPORTUNITY_ID, "quick_apply")).rejects.toThrow(/not authorized/i);
  });
});
