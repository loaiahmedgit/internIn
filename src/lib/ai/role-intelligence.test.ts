import { describe, expect, it } from "vitest";
import { ROLE_INTELLIGENCE_FIXTURES } from "./role-intelligence-fixtures";
import { recommendRoleFromProfiles } from "./role-intelligence";
import { WorkNeedProfileSchema, type WorkNeedProfile } from "./role-intelligence-schemas";

function need(overrides: Partial<WorkNeedProfile>): WorkNeedProfile {
  return WorkNeedProfileSchema.parse({
    originalRequest: "We need help with some work.",
    explicitRoleTitle: null,
    problems: [],
    activities: [],
    systemsOrTools: [],
    desiredOutcomes: [],
    constraints: [],
    activityClarity: "clear",
    seniorityIntent: "intern/junior",
    ...overrides,
  });
}

describe("recommendRoleFromProfiles", () => {
  it("preserves an employer-named role instead of replacing it with a retrieved neighbor", () => {
    const result = recommendRoleFromProfiles(
      need({
        originalRequest: "I need an ERP Implementation Assistant Intern to help with SAP migration.",
        explicitRoleTitle: "ERP Implementation Assistant Intern",
        activities: ["data migration"],
        systemsOrTools: ["SAP"],
      }),
      ROLE_INTELLIGENCE_FIXTURES,
    );

    expect(result.roleSource).toBe("explicit");
    expect(result.recommendedRole?.title).toBe("ERP Implementation Assistant Intern");
    expect(result.clarificationNeeded).toBe(false);
  });

  it("asks before changing an explicitly named role when the work seriously conflicts", () => {
    const result = recommendRoleFromProfiles(
      need({
        originalRequest: "I need a graphic design intern to write backend APIs in Node.js.",
        explicitRoleTitle: "Graphic Design Intern",
        activities: ["build backend APIs", "implement server-side application logic"],
        systemsOrTools: ["Node.js", "REST APIs"],
      }),
      ROLE_INTELLIGENCE_FIXTURES,
    );

    expect(result.recommendedRole?.title).toBe("Graphic Design Intern");
    expect(result.clarificationNeeded).toBe(true);
    expect(result.alternatives[0]?.title).toBe("Backend Developer Intern");
    expect(result.clarificationQuestion).toMatch(/Should I use Backend Developer Intern/i);
  });

  it("ranks ERP implementation above adjacent finance and operations roles from work evidence", () => {
    const result = recommendRoleFromProfiles(
      need({
        originalRequest: "We need to hire someone to deal with messy operational or financial data and slow transition times when migrating to new enterprise planning systems like SAP or Oracle.",
        problems: ["messy operational or financial data", "slow ERP migration"],
        activities: ["data cleansing", "data mapping", "migration preparation", "migration validation", "implementation support", "process documentation"],
        systemsOrTools: ["SAP", "Oracle ERP"],
        desiredOutcomes: ["cleaner migration data", "faster ERP transition", "fewer migration issues"],
      }),
      ROLE_INTELLIGENCE_FIXTURES,
    );

    expect(result.recommendedRole?.title).toBe("ERP Implementation Assistant Intern");
    const financialSystemsIndex = result.alternatives.findIndex((role) => role.title === "Financial Systems Analyst Intern");
    const businessOperationsIndex = result.alternatives.findIndex((role) => role.title === "Business Operations Intern");
    expect(financialSystemsIndex).toBeGreaterThanOrEqual(0);
    if (businessOperationsIndex >= 0) expect(financialSystemsIndex).toBeLessThan(businessOperationsIndex);
  });

  it.each([
    {
      label: "IT support",
      profile: need({
        originalRequest: "We need someone fixing employee laptops, printers, and normal software issues.",
        problems: ["employee device and software issues"],
        activities: ["laptop troubleshooting", "printer troubleshooting", "software troubleshooting"],
        systemsOrTools: ["employee laptops", "printers"],
      }),
      expected: "IT Support Intern",
    },
    {
      label: "data reporting",
      profile: need({
        originalRequest: "We waste hours cleaning spreadsheets and creating weekly dashboards.",
        problems: ["manual spreadsheet cleanup", "slow weekly reporting"],
        activities: ["spreadsheet data cleaning", "weekly dashboard creation"],
        systemsOrTools: ["spreadsheets"],
        desiredOutcomes: ["faster weekly reporting"],
      }),
      expected: "Data Reporting Analyst Intern",
    },
    {
      label: "frontend development",
      profile: need({
        originalRequest: "We need someone building React interfaces and connecting APIs.",
        activities: ["build React interfaces", "connect user interfaces to APIs"],
        systemsOrTools: ["React", "APIs"],
      }),
      expected: "Frontend Developer Intern",
    },
    {
      label: "accounting",
      profile: need({
        originalRequest: "We need someone reconciling invoices and preparing monthly financial reports.",
        activities: ["invoice reconciliation", "prepare monthly financial reports"],
        desiredOutcomes: ["accurate monthly financial reporting"],
      }),
      expected: "Accounting Intern",
    },
    {
      label: "ERP migration",
      profile: need({
        originalRequest: "We need someone helping migrate data to SAP and validate the new ERP system.",
        activities: ["data migration", "ERP validation", "implementation support"],
        systemsOrTools: ["SAP", "ERP"],
      }),
      expected: "ERP Implementation Assistant Intern",
    },
  ])("matches the expected $label role from activities rather than title keywords", ({ profile, expected }) => {
    const result = recommendRoleFromProfiles(profile, ROLE_INTELLIGENCE_FIXTURES);
    expect(result.recommendedRole?.title).toBe(expected);
    expect(result.clarificationNeeded).toBe(false);
  });

  it("treats an activity-free CRM request as ambiguous and asks one discriminating question", () => {
    const result = recommendRoleFromProfiles(
      need({
        originalRequest: "We need help with our CRM.",
        problems: ["need help with CRM"],
        systemsOrTools: ["CRM"],
        activityClarity: "ambiguous",
      }),
      ROLE_INTELLIGENCE_FIXTURES,
    );

    expect(result.recommendedRole).toBeNull();
    expect(result.ambiguity).toBe("high");
    expect(result.clarificationNeeded).toBe(true);
    expect(result.clarificationQuestion).toMatch(/mainly/i);
    expect(result.clarificationQuestion).toMatch(/or/i);
  });
});
