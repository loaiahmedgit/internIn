import { describe, expect, it } from "vitest";

import { enforceChallengeDurationPolicy } from "./challenge-generation";
import type { ChallengeDraftGenerated, EmployerContext } from "./challenge-clarification-schemas";

function context(originalRequest: string): EmployerContext {
  return {
    originalRequest,
    role: "Data Analyst Intern",
    level: null,
    responsibilities: ["Clean data"],
    tools: ["SQL"],
    restrictions: [],
    additionalContext: null,
  };
}

function draft(overrides: Partial<ChallengeDraftGenerated> = {}): ChallengeDraftGenerated {
  return {
    role: "Data Analyst Intern",
    title: "Clean a customer dataset",
    scenario: "Review a synthetic customer dataset and prepare a concise findings summary.",
    skills: ["SQL"],
    tasks: Array.from({ length: 6 }, (_, index) => ({
      title: `Task ${index + 1}`,
      instructions: `Complete task ${index + 1}.`,
      deliverableType: "spreadsheet" as const,
    })),
    materials: [
      { name: "customers.csv", type: "text/csv" },
      { name: "data_dictionary.pdf", type: "application/pdf" },
      { name: "report_template.docx", type: "application/docx" },
    ],
    durationMinutes: 240,
    estimatedDurationLabel: "3-4 hours",
    deliverables: ["Cleaned dataset", "SQL queries", "Findings summary", "Recommendations"],
    rubric: [{ criterion: "Accuracy", weight: 100 }],
    submissionRequirements: [{ label: "Findings summary", inputMode: "text", artifactKind: "text_response", required: true }],
    aiUsagePolicyMode: "allowed_with_disclosure",
    aiUsagePolicyCustomText: null,
    assumptions: [],
    safetyNotes: [],
    ...overrides,
  };
}

describe("enforceChallengeDurationPolicy", () => {
  it("reduces an unrequested multi-hour challenge to a 60-90 minute scope", () => {
    const result = enforceChallengeDurationPolicy(draft(), context("Create a practical data analyst challenge."));
    expect(result.durationMinutes).toBe(75);
    expect(result.estimatedDurationLabel).toBe("60-90 minutes");
    expect(result.tasks).toHaveLength(4);
    expect(result.deliverables).toHaveLength(4);
  });

  it("uses the 30-60 minute default for a focused challenge", () => {
    const result = enforceChallengeDurationPolicy(
      draft({ tasks: draft().tasks.slice(0, 2), materials: draft().materials.slice(0, 2), deliverables: ["SQL queries"], durationMinutes: 180 }),
      context("Create a short SQL challenge."),
    );
    expect(result.durationMinutes).toBe(45);
    expect(result.estimatedDurationLabel).toBe("30-60 minutes");
    expect(result.tasks).toHaveLength(2);
  });

  it("honors an explicit 45 minute request and narrows the task count", () => {
    const result = enforceChallengeDurationPolicy(draft(), context("Make this a 45 minute assessment."));
    expect(result.durationMinutes).toBe(45);
    expect(result.estimatedDurationLabel).toBe("45 minutes");
    expect(result.tasks).toHaveLength(3);
  });

  it("allows a longer take-home only when the employer explicitly requested the duration", () => {
    const result = enforceChallengeDurationPolicy(draft(), context("Create a 3 hour take-home project."));
    expect(result.durationMinutes).toBe(180);
    expect(result.estimatedDurationLabel).toBe("180 minutes");
    expect(result.tasks).toHaveLength(6);
  });

  it("repairs a numeric duration that contradicts its human label", () => {
    const result = enforceChallengeDurationPolicy(
      draft({ tasks: draft().tasks.slice(0, 2), materials: draft().materials.slice(0, 2), deliverables: ["SQL queries"], durationMinutes: 30, estimatedDurationLabel: "60-90 minutes" }),
      context("Create a short SQL challenge."),
    );
    expect(result.durationMinutes).toBe(45);
    expect(result.estimatedDurationLabel).toBe("30-60 minutes");
  });

  it("does not confuse internship availability with challenge duration", () => {
    const result = enforceChallengeDurationPolicy(
      draft(),
      context("The internship is 20 hours/week."),
    );
    expect(result.durationMinutes).toBe(75);
    expect(result.estimatedDurationLabel).toBe("60-90 minutes");
  });
});
