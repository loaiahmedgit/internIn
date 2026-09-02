import { describe, expect, it } from "vitest";
import { normalizeWorkNeedProfile } from "./work-need-extraction";

describe("normalizeWorkNeedProfile", () => {
  it("preserves the exact request and removes protected-characteristic constraints", () => {
    const originalRequest = "We need someone to clean migration data for SAP.";
    const result = normalizeWorkNeedProfile(
      {
        originalRequest: "paraphrased",
        explicitRoleTitle: null,
        problems: ["messy migration data"],
        activities: ["data cleansing"],
        systemsOrTools: ["SAP"],
        desiredOutcomes: ["clean migration data"],
        constraints: ["must be a young woman", "view-only access"],
        activityClarity: "clear",
        seniorityIntent: "intern/junior",
      },
      originalRequest,
    );

    expect(result.originalRequest).toBe(originalRequest);
    expect(result.constraints).toEqual(["view-only access"]);
  });

  it("recognizes two employer-grounded activities even when extraction was overly cautious", () => {
    const originalRequest = "We waste hours cleaning spreadsheets and creating weekly dashboards.";
    const result = normalizeWorkNeedProfile(
      {
        originalRequest,
        explicitRoleTitle: null,
        problems: ["slow reporting"],
        activities: ["clean spreadsheets", "create weekly dashboards"],
        systemsOrTools: ["spreadsheets"],
        desiredOutcomes: [],
        constraints: [],
        activityClarity: "ambiguous",
        seniorityIntent: "intern/junior",
      },
      originalRequest,
    );
    expect(result.activityClarity).toBe("clear");
  });

  it("does not turn model-invented branches from a bare system request into clear work", () => {
    const originalRequest = "We need help with our CRM.";
    const result = normalizeWorkNeedProfile(
      {
        originalRequest,
        explicitRoleTitle: null,
        problems: ["need help with CRM"],
        activities: ["configure CRM", "analyze CRM data", "build CRM integrations"],
        systemsOrTools: ["CRM"],
        desiredOutcomes: [],
        constraints: [],
        activityClarity: "ambiguous",
        seniorityIntent: "intern/junior",
      },
      originalRequest,
    );
    expect(result.activityClarity).toBe("ambiguous");
  });
});
