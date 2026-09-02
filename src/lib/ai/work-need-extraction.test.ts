import { describe, expect, it } from "vitest";
import { workActivitySignals } from "./role-intelligence-schemas";
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
        domainSignals: ["enterprise systems implementation"],
        systemsOrTools: ["SAP"],
        desiredOutcomes: ["clean migration data"],
        constraints: ["must be a young woman", "view-only access"],
        activityClarity: "clear",
        domainClarity: "clear",
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
        domainSignals: ["business reporting"],
        systemsOrTools: ["spreadsheets"],
        desiredOutcomes: [],
        constraints: [],
        activityClarity: "ambiguous",
        domainClarity: "clear",
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
        domainSignals: ["customer relationship management systems"],
        systemsOrTools: ["CRM"],
        desiredOutcomes: [],
        constraints: [],
        activityClarity: "ambiguous",
        domainClarity: "clear",
        seniorityIntent: "intern/junior",
      },
      originalRequest,
    );
    expect(result.activityClarity).toBe("ambiguous");
  });

  it("retains grounded problem and outcome evidence when the model leaves activities empty", () => {
    const originalRequest = "Shipment records are unreliable and delivery windows conflict, so statuses and schedules need to become reliable.";
    const result = normalizeWorkNeedProfile(
      {
        originalRequest,
        explicitRoleTitle: null,
        problems: ["shipment records are unreliable", "delivery windows conflict"],
        activities: [],
        domainSignals: ["shipment logistics"],
        systemsOrTools: [],
        desiredOutcomes: ["reliable delivery status", "coordinated delivery schedule"],
        constraints: [],
        activityClarity: "ambiguous",
        domainClarity: "clear",
        seniorityIntent: "intern/junior",
      },
      originalRequest,
    );

    expect(result.activityClarity).toBe("clear");
    expect(workActivitySignals(result)).toEqual([
      "shipment records are unreliable",
      "delivery windows conflict",
      "reliable delivery status",
      "coordinated delivery schedule",
    ]);
  });

  it("does not promote one vague problem plus a tautological outcome into clear work", () => {
    const originalRequest = "Our team has a records problem.";
    const result = normalizeWorkNeedProfile(
      {
        originalRequest,
        explicitRoleTitle: null,
        problems: ["records problem"],
        activities: [],
        domainSignals: ["records management"],
        systemsOrTools: [],
        desiredOutcomes: ["resolution of records problem"],
        constraints: [],
        activityClarity: "ambiguous",
        domainClarity: "clear",
        seniorityIntent: "intern/junior",
      },
      originalRequest,
    );
    expect(result.activityClarity).toBe("ambiguous");
  });
});
