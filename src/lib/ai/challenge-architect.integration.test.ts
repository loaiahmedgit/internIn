import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { hasConfiguredModel } from "./model";
import { extractRoleReality, proposeAssessmentPlan } from "./challenge-architect";
import { assertArchitectReady } from "@/lib/challenges/architect";

config({ path: ".env.local" });

describe.skipIf(!hasConfiguredModel())("Challenge Architect — live structured contract", () => {
  it("preserves employer expectations and maps an existing task without inventing missing context", async () => {
    const reality = await extractRoleReality("Our intern will prioritize fictional support requests. Before joining we expect prioritization. We will teach our internal ticketing system. No tools or real customer data are needed for this written assessment.");
    expect(reality.expectedBeforeJoining).toMatch(/prioritiz/i);
    expect(reality.willTeach).toMatch(/ticketing/i);
    expect(reality.changingConditions).toBeNull();
    const tasks = [{ title: "Prioritize requests", description: "Using the supplied rule that outages come before routine requests, order a fictional outage and a signature-change request and explain why." }];
    const assessmentPlan = await proposeAssessmentPlan({ reality, tasks, activeMinutes: 15 });
    expect(assessmentPlan.foundations.length).toBeGreaterThan(0);
    expect(assessmentPlan.expectedBeforeJoining.join(" ")).not.toMatch(/ticketing/i);
    expect(assessmentPlan.foundations.flatMap((item) => item.taskTitles)).toEqual(expect.arrayContaining(["Prioritize requests"]));
    expect(() => assertArchitectReady({ roleReality: reality, assessmentPlan, tasks, estimatedMinutes: 15 })).not.toThrow();
  }, 90_000);
});
